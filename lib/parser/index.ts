import { statSync } from "node:fs";
import path from "node:path";
import { Project, Node, ts } from "ts-morph";
import { extractExports, extractImports } from "./extract.ts";
import { dedupeEdges, fanCounts } from "./graph.ts";
import { createResolver } from "./resolver.ts";
import {
  SCHEMA_VERSION,
  type Coverage,
  type Edge,
  type ImportStatus,
  type ParseResult,
  type ParsedFile,
  type Route,
  type SkippedFile,
  type StatusCounts,
  type ParserOptions,
  type ParserInsight,
  type SpecParseResult,
  type SpecParsedFile,
  type SpecParsedEdge,
  type UnresolvedImportRow,
  type SpecEdgeKind,
} from "./types.ts";
import type { Role } from "../roles.ts";
import type { AdapterFile } from "./adapters/types.ts";
import { walkRepository, withinProject, type WalkResult } from "./walk.ts";

export type Selection = { root: string; walk: WalkResult };

export function parseRepository(directory: string): ParseResult {
  return parseSelection(selectFiles(directory));
}

// Selecting and parsing are separate calls so a caller can report which one
// it's in; together they are exactly parseRepository.
export function selectFiles(directory: string): Selection {
  const root = path.resolve(directory);
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }
  return { root, walk: walkRepository(root) };
}

export function parseSelection({ root, walk }: Selection): ParseResult {

  // Parsing only: no lib, no type resolution. Imports are resolved separately
  // so every outcome can be classified rather than left to the compiler.
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true, noLib: true, noResolve: true, types: [] },
  });
  const sourceFiles = walk.candidates.map((candidate) => ({
    candidate,
    sourceFile: project.createSourceFile(candidate.absolutePath, candidate.content, { overwrite: true }),
  }));
  const program = project.getProgram();

  const skipped: SkippedFile[] = [...walk.skipped];
  const parsed: typeof sourceFiles = [];
  for (const entry of sourceFiles) {
    const [first, ...rest] = program.getSyntacticDiagnostics(entry.sourceFile);
    if (!first) {
      parsed.push(entry);
      continue;
    }
    // A file that doesn't parse cleanly would give a partial import list. Absent beats approximate.
    const message = ts.flattenDiagnosticMessageText(first.compilerObject.messageText, " ");
    skipped.push({
      path: entry.candidate.path,
      reason: "syntax-error",
      detail: `line ${first.getLineNumber() ?? "?"}: ${message}${rest.length ? ` (+${rest.length} more)` : ""}`,
    });
  }
  skipped.sort((a, b) => a.path.localeCompare(b.path));

  const resolver = createResolver({
    root,
    nodes: new Set(parsed.map((entry) => entry.candidate.path)),
    skipped: new Map(skipped.map((file) => [file.path, file])),
    excludedDirectories: walk.excludedDirectories,
    workspacePackages: walk.workspacePackages,
  });

  const coverage: Coverage["imports"] = {
    total: emptyCounts(),
    byKind: { import: emptyCounts(), "re-export": emptyCounts(), "dynamic-import": emptyCounts(), require: emptyCounts() },
    external: { package: 0, builtin: 0, "outside-root": 0 },
    excluded: {},
    unresolvedByReason: {},
    unresolved: [],
  };
  const rawEdges: Edge[] = [];
  const exportsOf = new Map<string, string[]>();

  for (const { candidate, sourceFile } of parsed) {
    exportsOf.set(candidate.path, extractExports(sourceFile));
    for (const found of extractImports(sourceFile)) {
      const specifier = found.literal ? found.specifier : found.expression;
      const outcome: ImportStatus = found.literal
        ? resolver.resolve(candidate.absolutePath, found.specifier, found.kind)
        : {
            status: "unresolved",
            reason: found.kind === "require" ? "non-literal-require" : "non-literal-dynamic-import",
            detail: "the path is computed at runtime",
          };

      coverage.total.seen++;
      coverage.byKind[found.kind].seen++;
      coverage.total[outcome.status]++;
      coverage.byKind[found.kind][outcome.status]++;

      switch (outcome.status) {
        case "internal":
          rawEdges.push({
            source: candidate.path,
            target: outcome.target,
            kind: found.kind,
            typeOnly: found.typeOnly,
            specifier,
            line: found.line,
          });
          break;
        case "external":
          coverage.external[outcome.external]++;
          break;
        case "excluded":
          coverage.excluded[outcome.reason] = (coverage.excluded[outcome.reason] ?? 0) + 1;
          break;
        case "unresolved":
          coverage.unresolvedByReason[outcome.reason] = (coverage.unresolvedByReason[outcome.reason] ?? 0) + 1;
          coverage.unresolved.push({
            from: candidate.path,
            specifier,
            kind: found.kind,
            line: found.line,
            reason: outcome.reason,
            detail: outcome.detail,
          });
          break;
      }
    }
  }

  const edges = dedupeEdges(rawEdges);
  const paths = parsed.map((entry) => entry.candidate.path);
  const fan = fanCounts(paths, edges);
  const conventions = applyAdapters(walk, parsed, skipped);
  const files: ParsedFile[] = parsed
    .map(({ candidate }) => ({
      path: candidate.path,
      module: candidate.module,
      lines: candidate.lines,
      bytes: candidate.bytes,
      hash: candidate.hash,
      fanIn: fan.get(candidate.path)?.fanIn ?? 0,
      fanOut: fan.get(candidate.path)?.fanOut ?? 0,
      reachedBy: candidate.reachedBy,
      role: conventions.roles.get(candidate.path) ?? null,
      exports: exportsOf.get(candidate.path) ?? [],
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  if (files.length + skipped.length !== walk.found) {
    throw new Error(`Coverage doesn't add up: found ${walk.found}, parsed ${files.length}, skipped ${skipped.length}`);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    root,
    projects: walk.projects,
    files,
    edges,
    routes: conventions.routes,
    coverage: {
      files: {
        found: walk.found,
        parsed: files.length,
        skipped: skipped.length,
        skippedFiles: skipped,
        excludedDirectories: walk.excludedDirectories,
      },
      imports: coverage,
      routes: { omitted: conventions.omitted, withheld: conventions.withheld },
    },
    configs: resolver.configs(),
  };
}

/**
 * Parse a codebase into spec-compliant format (phase-03).
 * Validates rootDir, scans files with ts-morph, resolves imports,
 * and collects insights for unresolved imports, parse errors, and dynamic specifiers.
 */

export async function parseCodebase(options: ParserOptions): Promise<SpecParseResult> {
  // Validate rootDir - must be a non-empty string
  if (options.rootDir === undefined || options.rootDir === null) {
    throw new Error("options.rootDir must be a non-empty string");
  }
  if (typeof options.rootDir !== "string") {
    throw new Error("options.rootDir must be a string");
  }
  if (options.rootDir === "") {
    throw new Error("options.rootDir must not be empty");
  }

  const root = path.resolve(options.rootDir);
  const stat = statSync(root, { throwIfNoEntry: false });
  if (!stat?.isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }

  // Validate maxFiles - must be non-negative integer or undefined
  let maxFiles: number | undefined = options.maxFiles;
  if (maxFiles !== undefined) {
    if (maxFiles < 0) {
      throw new Error("options.maxFiles must be non-negative");
    }
    // Floor non-integers
    maxFiles = Math.floor(maxFiles);
  }

  // Walk the repository to collect candidate files.
  // maxFiles is applied after parse/resolve so the resolver node set stays complete.
  const walk = walkRepository(root);

  // Create ts-morph Project for parsing
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true, noLib: true, noResolve: true, types: [] },
  });

  // Parse source files
  const sourceFiles = walk.candidates.map((candidate) => ({
    candidate,
    sourceFile: project.createSourceFile(candidate.absolutePath, candidate.content, { overwrite: true }),
  }));

  const program = project.getProgram();
  const skipped: SkippedFile[] = [...walk.skipped];
  const parsed: typeof sourceFiles = [];
  const insights: ParserInsight[] = [];

  // Filter files, collecting syntax errors as insights
  for (const entry of sourceFiles) {
    const [first, ...rest] = program.getSyntacticDiagnostics(entry.sourceFile);
    if (!first) {
      parsed.push(entry);
      continue;
    }
    // Syntax error: add insight and skip file
    const message = ts.flattenDiagnosticMessageText(first.compilerObject.messageText, " ");
    const lineNumber = first.getLineNumber() ?? undefined;
    insights.push({
      category: "PARSE_ERROR",
      severity: "error",
      sourceFile: entry.candidate.path,
      lineNumber,
      title: "Parse Error",
      description: `Syntax error: ${message}`,
      metadata: {
        reason: "syntax-error",
        message,
        additionalDiagnostics: rest.length,
      },
    });
    skipped.push({
      path: entry.candidate.path,
      reason: "syntax-error",
      detail: `line ${lineNumber ?? "?"}: ${message}${rest.length ? ` (+${rest.length} more)` : ""}`,
    });
  }

  // Create resolver
  const resolver = createResolver({
    root,
    nodes: new Set(parsed.map((entry) => entry.candidate.path)),
    skipped: new Map(skipped.map((file) => [file.path, file])),
    excludedDirectories: walk.excludedDirectories,
    workspacePackages: walk.workspacePackages,
  });


  // Extract imports and build edges
  const unresolvedImports: UnresolvedImportRow[] = [];
  const fileEdges = new Map<string, SpecParsedEdge[]>();

  const collectImportedSymbols = (
    sf: (typeof parsed)[number]["sourceFile"],
    moduleSpecifier: string,
    line: number,
  ): string[] => {
    const symbols: string[] = [];
    for (const statement of sf.getStatements()) {
      if (statement.getStartLineNumber() !== line) continue;
      if (Node.isImportDeclaration(statement)) {
        if (statement.getModuleSpecifierValue() !== moduleSpecifier) continue;
        const clause = statement.getImportClause();
        if (!clause) continue;
        const def = clause.getDefaultImport();
        if (def) symbols.push(def.getText());
        for (const named of clause.getNamedImports()) {
          const name = named.getName();
          if (name) symbols.push(name);
        }
        const ns = clause.getNamespaceImport();
        if (ns) symbols.push(ns.getText());
      } else if (Node.isExportDeclaration(statement)) {
        if (statement.getModuleSpecifierValue() !== moduleSpecifier) continue;
        for (const named of statement.getNamedExports()) {
          const name = named.getName();
          if (name) symbols.push(name);
        }
      }
    }
    return symbols;
  };

  for (const { candidate, sourceFile } of parsed) {
    const edges: SpecParsedEdge[] = [];

    for (const found of extractImports(sourceFile)) {
      const specifier = found.literal ? found.specifier : found.expression;
      const outcome: ImportStatus = found.literal
        ? resolver.resolve(candidate.absolutePath, found.specifier, found.kind)
        : {
            status: "unresolved",
            reason: found.kind === "require" ? "non-literal-require" : "non-literal-dynamic-import",
            detail: "the path is computed at runtime",
          };

      // Map edge kind: import→static_import, re-export→re_export, dynamic-import→dynamic_import, require→commonjs_require
      const specEdgeKind: SpecEdgeKind =
        found.kind === "import"
          ? "static_import"
          : found.kind === "re-export"
            ? "re_export"
            : found.kind === "dynamic-import"
              ? "dynamic_import"
              : "commonjs_require";

      switch (outcome.status) {
        case "internal": {
          edges.push({
            edgeType: specEdgeKind,
            rawImportSpecifier: specifier,
            resolvedPath: outcome.target,
            isExternal: false,
            importedSymbols: found.literal ? collectImportedSymbols(sourceFile, found.specifier, found.line) : [],
          });
          break;
        }

        case "unresolved": {
          unresolvedImports.push({
            sourceFile: candidate.path,
            specifier,
            errorReason: outcome.detail,
            lineNumber: found.line,
          });

          // Fail-Loud: non-literal dynamic import() → DYNAMIC_SPECIFIER_UNRESOLVED;
          // non-literal require and other unresolved → UNRESOLVED_IMPORT.
          if (outcome.reason === "non-literal-dynamic-import") {
            insights.push({
              category: "DYNAMIC_SPECIFIER_UNRESOLVED",
              severity: "warning",
              sourceFile: candidate.path,
              specifier,
              lineNumber: found.line,
              title: "Dynamic Specifier",
              description: `Non-literal import path cannot be statically resolved: ${outcome.detail}`,
              metadata: {
                reason: outcome.reason,
                expression: specifier,
              },
            });
          } else {
            insights.push({
              category: "UNRESOLVED_IMPORT",
              severity: "warning",
              sourceFile: candidate.path,
              specifier,
              lineNumber: found.line,
              title: "Unresolved Import",
              description: `Cannot resolve "${specifier}": ${outcome.detail}`,
              metadata: {
                reason: outcome.reason,
                detail: outcome.detail,
              },
            });
          }
          break;
        }

        case "external": {
          // External imports: create edge with isExternal=true, resolvedPath=null
          edges.push({
            edgeType: specEdgeKind,
            rawImportSpecifier: specifier,
            resolvedPath: null,
            isExternal: true,
            importedSymbols: found.literal ? collectImportedSymbols(sourceFile, found.specifier, found.line) : [],
          });
          break;
        }

        case "excluded":
          // Excluded imports do not produce edges
          break;
      }
    }

    fileEdges.set(candidate.path, edges);
  }

  // Build SpecParsedFile entries with collected metadata
  let files: SpecParsedFile[] = parsed
    .map(({ candidate, sourceFile }) => {
      const ext = path.extname(candidate.path);
      // Count AST nodes via full descendant walk (cheap on fixture-scale files)
      const astNodeCount = 1 + sourceFile.getDescendants().length;
      return {
        relativePath: candidate.path,
        extension: ext,
        contentHash: candidate.hash,
        sizeBytes: candidate.bytes,
        lineCount: candidate.lines,
        astNodeCount,
        edges: fileEdges.get(candidate.path) ?? [],
      };
    })
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  // Cap returned files after a complete resolve pass (Math.floor already applied).
  if (maxFiles !== undefined) {
    files = files.slice(0, maxFiles);
  }

  return {
    files,
    unresolvedImports,
    insights,
  };
}

// Each project's adapter is asked about its own files, by project-relative
// path, and what it answers is mapped back to repository paths.
function applyAdapters(
  walk: WalkResult,
  parsed: readonly { candidate: { path: string; project: string }; sourceFile: AdapterFile["source"] }[],
  skipped: readonly SkippedFile[],
) {
  const roles = new Map<string, Role>();
  const routes: Route[] = [];
  const omitted: Coverage["routes"]["omitted"] = [];
  const withheld: Coverage["routes"]["withheld"] = [];

  for (const [project, adapter] of walk.adapters) {
    const toRepo = (p: string) => (project === "." ? p : `${project}/${p}`);
    const files: AdapterFile[] = [];
    for (const { candidate, sourceFile } of parsed) {
      if (candidate.project !== project) continue;
      const file = { path: withinProject(project, candidate.path), source: sourceFile };
      files.push(file);
      const role = adapter.roleOf(file);
      if (role) roles.set(candidate.path, role);
    }
    // A declaration file has no runtime code, so it can't hold anything an adapter reads.
    const unparsed = skipped
      .filter((f) => f.reason !== "declaration-file" && walk.projectOf.get(f.path) === project)
      .map((f) => withinProject(project, f.path));

    const report = adapter.routes({ files, unparsed });
    if (report.withheld !== null) {
      withheld.push({ project, reason: report.withheld });
      continue;
    }
    for (const r of report.routes) routes.push({ file: toRepo(r.path), method: r.method, pattern: r.pattern, line: r.line });
    for (const o of report.omitted) omitted.push({ file: toRepo(o.path), line: o.line, reason: o.reason });
  }

  // An array of paths on a decorator can name the same one twice.
  const unique = new Map(routes.map((r) => [`${r.method} ${r.pattern} ${r.file}`, r]));
  return {
    roles,
    routes: [...unique.values()].sort(
      (a, b) => a.pattern.localeCompare(b.pattern) || a.method.localeCompare(b.method) || a.file.localeCompare(b.file),
    ),
    omitted: omitted.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    withheld,
  };
}

function emptyCounts(): StatusCounts {
  return { seen: 0, internal: 0, external: 0, excluded: 0, unresolved: 0 };
}

export type * from "./types.ts";

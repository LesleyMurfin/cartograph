import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { FrameworkAdapter } from "./adapters/types.ts";
import type { ExcludedDirectory, SkippedFile } from "./types.ts";

export const CODE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const DECLARATION = /\.d\.(ts|mts|cts)$|\.d\.[^/.]+\.ts$/;

// Generated bundles and vendored blobs run past this; hand-written modules don't.
// A file over it is skipped and counted, never partially read.
export const MAX_FILE_BYTES = 1024 * 1024;

export type CandidateFile = {
  path: string;
  absolutePath: string;
  module: string;
  content: string;
  bytes: number;
  lines: number;
  hash: string;
};

export type WalkResult = {
  candidates: CandidateFile[];
  skipped: SkippedFile[];
  excludedDirectories: ExcludedDirectory[];
  /** Every code file seen, parsed or skipped. */
  found: number;
  /** Package names declared by package.json files inside the repository. */
  workspacePackages: Set<string>;
};

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

export function isCodeFile(p: string): boolean {
  return CODE_EXTENSIONS.includes(path.extname(p));
}

export function isDeclarationFile(p: string): boolean {
  return DECLARATION.test(p);
}

// The module is the containing folder: the finest grouping that is a fact
// about the repository rather than a judgement about it.
export function moduleOf(relativePath: string): string {
  const dir = path.posix.dirname(relativePath);
  return dir === "" ? "." : dir;
}

function countLines(content: string): number {
  if (content.length === 0) return 0;
  const breaks = content.split("\n").length;
  return content.endsWith("\n") ? breaks - 1 : breaks;
}

function genericExclusion(name: string): string | null {
  if (name === "node_modules") return "dependency directory";
  if (name.startsWith(".")) return "dot-directory";
  return null;
}

export function walkRepository(root: string, adapter: FrameworkAdapter): WalkResult {
  const result: WalkResult = {
    candidates: [],
    skipped: [],
    excludedDirectories: [],
    found: 0,
    workspacePackages: new Set(),
  };

  const visit = (absoluteDir: string): void => {
    const entries = readdirSync(absoluteDir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const absolutePath = path.join(absoluteDir, entry.name);
      const relativePath = toPosix(path.relative(root, absolutePath));

      if (entry.isDirectory()) {
        const reason = genericExclusion(entry.name) ?? adapter.excludeDirectory(relativePath);
        if (reason) {
          result.excludedDirectories.push({ path: relativePath, reason });
          continue;
        }
        visit(absolutePath);
        continue;
      }

      if (entry.isSymbolicLink()) {
        // Following links can leave the repository or loop; neither is walked.
        const target = safeStat(absolutePath);
        if (target === "directory") {
          result.excludedDirectories.push({ path: relativePath, reason: "symbolic link" });
        } else if (isCodeFile(entry.name)) {
          result.found++;
          result.skipped.push({ path: relativePath, reason: "symlink", detail: "symbolic link not followed" });
        }
        continue;
      }

      if (!entry.isFile()) continue;

      if (entry.name === "package.json") {
        const name = readPackageName(absolutePath);
        if (name) result.workspacePackages.add(name);
        continue;
      }

      if (!isCodeFile(entry.name)) continue;
      result.found++;

      if (isDeclarationFile(entry.name)) {
        result.skipped.push({ path: relativePath, reason: "declaration-file", detail: "types only, no runtime imports" });
        continue;
      }

      const candidate = readCandidate(absolutePath, relativePath);
      if ("reason" in candidate) result.skipped.push(candidate);
      else result.candidates.push(candidate);
    }
  };

  visit(root);
  return result;
}

function safeStat(absolutePath: string): "directory" | "file" | "missing" {
  const stat = statSync(absolutePath, { throwIfNoEntry: false });
  if (!stat) return "missing";
  return stat.isDirectory() ? "directory" : "file";
}

function readPackageName(absolutePath: string): string | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(absolutePath, "utf8"));
    if (typeof parsed === "object" && parsed !== null && "name" in parsed && typeof parsed.name === "string") {
      return parsed.name;
    }
  } catch {
    // An unreadable package.json declares nothing; it isn't a code file, so it isn't counted.
  }
  return null;
}

function readCandidate(absolutePath: string, relativePath: string): CandidateFile | SkippedFile {
  let buffer: Buffer;
  try {
    buffer = readFileSync(absolutePath);
  } catch (error) {
    return { path: relativePath, reason: "unreadable", detail: error instanceof Error ? error.message : String(error) };
  }
  if (buffer.byteLength > MAX_FILE_BYTES) {
    return {
      path: relativePath,
      reason: "too-large",
      detail: `${buffer.byteLength} bytes, limit ${MAX_FILE_BYTES}`,
    };
  }
  if (buffer.includes(0)) {
    return { path: relativePath, reason: "binary", detail: "contains NUL bytes" };
  }
  const content = buffer.toString("utf8");
  return {
    path: relativePath,
    absolutePath,
    module: moduleOf(relativePath),
    content,
    bytes: buffer.byteLength,
    lines: countLines(content),
    hash: createHash("sha256").update(buffer).digest("hex"),
  };
}

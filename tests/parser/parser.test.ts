import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCodebase } from "../../lib/parser/index.ts";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/sample-repo");

describe("parseCodebase", () => {
  it("parses sample-repo with deterministic hashes and nested edges", async () => {
    const first = await parseCodebase({ rootDir });
    const second = await parseCodebase({ rootDir });

    expect(first.files.length).toBeGreaterThanOrEqual(4);
    expect(first.files.map((f) => f.relativePath).sort()).toEqual(
      second.files.map((f) => f.relativePath).sort(),
    );

    for (const file of first.files) {
      const again = second.files.find((f) => f.relativePath === file.relativePath);
      expect(again?.contentHash).toBe(file.contentHash);
      expect(file.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(file.sizeBytes).toBeGreaterThan(0);
      expect(file.lineCount).toBeGreaterThan(0);
      expect(file.astNodeCount).toBeGreaterThan(0);
      expect(file.extension).toMatch(/^\./);
    }

    const index = first.files.find((f) => f.relativePath === "src/index.ts");
    expect(index).toBeDefined();
    const kinds = new Set(index!.edges.map((e) => e.edgeType));
    expect(kinds.has("static_import")).toBe(true);
    expect(kinds.has("re_export")).toBe(true);
    expect(kinds.has("dynamic_import")).toBe(true);
    expect(kinds.has("commonjs_require")).toBe(true);

    const utilEdge = index!.edges.find(
      (e) => e.rawImportSpecifier === "./util" && e.edgeType === "static_import",
    );
    expect(utilEdge?.resolvedPath).toBe("src/util.ts");
    expect(utilEdge?.isExternal).toBe(false);
    expect(utilEdge?.importedSymbols).toEqual(expect.arrayContaining(["helper", "VALUE"]));

    const lodashEdge = index!.edges.find((e) => e.rawImportSpecifier === "lodash");
    expect(lodashEdge?.isExternal).toBe(true);
    expect(lodashEdge?.resolvedPath).toBeNull();

    const aliasEdge = index!.edges.find((e) => e.rawImportSpecifier === "@/util");
    expect(aliasEdge?.resolvedPath).toBe("src/util.ts");
  });

  it("records unresolved imports and Fail-Loud insights including PARSE_ERROR", async () => {
    const result = await parseCodebase({ rootDir });

    expect(result.unresolvedImports.some((u) => u.specifier.includes("does-not-exist"))).toBe(true);
    expect(result.unresolvedImports.every((u) => u.sourceFile && u.errorReason && u.lineNumber > 0)).toBe(true);

    const categories = new Set(result.insights.map((i) => i.category));
    expect(categories.has("UNRESOLVED_IMPORT")).toBe(true);
    expect(categories.has("PARSE_ERROR")).toBe(true);
    expect(categories.has("DYNAMIC_SPECIFIER_UNRESOLVED")).toBe(true);

    const parseError = result.insights.find((i) => i.category === "PARSE_ERROR");
    expect(parseError?.sourceFile).toContain("broken.ts");
    expect(parseError?.severity).toBe("error");

    const dynamic = result.insights.find((i) => i.category === "DYNAMIC_SPECIFIER_UNRESOLVED");
    expect(dynamic?.sourceFile).toContain("template.ts");

    // broken syntax file is not a graph node
    expect(result.files.some((f) => f.relativePath.endsWith("broken.ts"))).toBe(false);
  });

  it("respects maxFiles", async () => {
    const limited = await parseCodebase({ rootDir, maxFiles: 2 });
    expect(limited.files.length).toBeLessThanOrEqual(2);
  });

  // Guard 1: rootDir validation
  it("throws when rootDir is undefined or null", async () => {
    await expect(parseCodebase({ rootDir: undefined as unknown as string })).rejects.toThrow();
    await expect(parseCodebase({ rootDir: null as unknown as string })).rejects.toThrow();
  });

  it("throws when rootDir is empty string", async () => {
    await expect(parseCodebase({ rootDir: "" })).rejects.toThrow();
  });

  it("throws when rootDir is a non-existent path", async () => {
    await expect(parseCodebase({ rootDir: "/nonexistent/invalid/path/12345" })).rejects.toThrow();
  });

  // Guard 2: maxFiles boundary
  it("returns empty files when maxFiles is 0", async () => {
    const result = await parseCodebase({ rootDir, maxFiles: 0 });
    expect(result.files).toEqual([]);
  });

  it("throws when maxFiles is negative", async () => {
    await expect(parseCodebase({ rootDir, maxFiles: -1 })).rejects.toThrow();
  });

  it("floors non-integer maxFiles and bounds file count", async () => {
    // Documented: non-integer maxFiles is accepted via Math.floor
    const result = await parseCodebase({ rootDir, maxFiles: 1.5 });
    expect(result.files.length).toBeLessThanOrEqual(Math.floor(1.5));
  });

  // Guard 3: tsconfigPath — undefined/"" discovery; explicit missing throws; valid uses path
  it("keeps @/ alias resolution when tsconfigPath is undefined", async () => {
    const result = await parseCodebase({ rootDir, tsconfigPath: undefined });
    expect(result.files.length).toBeGreaterThan(0);
    const index = result.files.find((f) => f.relativePath === "src/index.ts");
    expect(index).toBeDefined();
    const aliasEdge = index!.edges.find((e) => e.rawImportSpecifier === "@/util");
    expect(aliasEdge?.resolvedPath).toBe("src/util.ts");
  });

  it("does not throw when tsconfigPath is empty string and still returns files", async () => {
    const result = await parseCodebase({ rootDir, tsconfigPath: "" });
    expect(Array.isArray(result.files)).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);
  });

  it("throws when explicit tsconfigPath does not exist", async () => {
    await expect(
      parseCodebase({ rootDir, tsconfigPath: "/nonexistent/tsconfig.json" }),
    ).rejects.toThrow(/tsconfig not found/);
  });

  it("uses explicit valid tsconfigPath for alias resolution", async () => {
    const result = await parseCodebase({
      rootDir,
      tsconfigPath: path.join(rootDir, "tsconfig.json"),
    });
    expect(result.files.length).toBeGreaterThan(0);
    const index = result.files.find((f) => f.relativePath === "src/index.ts");
    expect(index).toBeDefined();
    const aliasEdge = index!.edges.find((e) => e.rawImportSpecifier === "@/util");
    expect(aliasEdge?.resolvedPath).toBe("src/util.ts");
  });
});

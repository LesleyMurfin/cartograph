import { readFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { AnalysisView } from "@/components/analysis-view";
import { deserializeParseResult } from "@/lib/parser/contract";

// Renders checked-in parser output through the real interface, so the canvas
// can be built without an account, a database or a network. Goes away once
// analyses are stored.
const DATA_FILE = path.join(process.cwd(), "app/preview/analysis.json");

export default async function PreviewPage() {
  // Read per request, not at build, so regenerating the data file doesn't need
  // a rebuild. Read through the contract so a stale file fails by field.
  await connection();
  const text = await readFile(DATA_FILE, "utf8").catch((error: unknown) => {
    throw new Error(`No preview data at ${DATA_FILE}. Run: pnpm parse <repo> --out app/preview/analysis.json`, {
      cause: error,
    });
  });
  const { root, projects, files, edges, coverage } = deserializeParseResult(text);

  // Only what the pane shows crosses to the browser, not the whole coverage
  // report or the absolute path the parser ran in.
  return (
    <AnalysisView
      files={files}
      edges={edges}
      repository={{
        name: path.basename(root),
        projects,
        skipped: coverage.files.skipped,
        unresolved: coverage.imports.total.unresolved,
      }}
    />
  );
}

import path from "node:path";
import { CODE_EXTENSIONS, toPosix } from "./walk.ts";

export { createResolver, type RepositoryIndex, type Resolver } from "./resolve.ts";

const DEFAULT_EXTENSIONS = [...CODE_EXTENSIONS];

/**
 * Lightweight path fallback for extensionless and directory-index imports.
 * Full alias/tsconfig resolution stays in createResolver (resolve.ts).
 */
export function resolveWithFallbacks(
  specifier: string,
  fromFilePath: string,
  knownFiles: Set<string>,
  extensions: string[] = DEFAULT_EXTENSIONS,
): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return null;

  const fromDir = path.posix.dirname(toPosix(fromFilePath));
  const joined = toPosix(path.posix.normalize(path.posix.join(fromDir, specifier)));
  const candidates = expandCandidates(joined, extensions);

  for (const candidate of candidates) {
    if (knownFiles.has(candidate)) return candidate;
  }
  return null;
}

function expandCandidates(base: string, extensions: string[]): string[] {
  const out: string[] = [base];
  if (path.posix.extname(base)) return out;
  for (const ext of extensions) out.push(`${base}${ext}`);
  for (const ext of extensions) out.push(`${base}/index${ext}`);
  return out;
}

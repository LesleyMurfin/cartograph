import type { FrameworkAdapter } from "./types.ts";

// Assumes no framework: applies to anything and excludes nothing beyond the
// generic rules, so every source file outside them becomes a node.
export const fallbackAdapter: FrameworkAdapter = {
  name: "none",
  detect: () => true,
  excludeDirectory: () => null,
};

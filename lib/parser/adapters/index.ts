import { fallbackAdapter } from "./fallback.ts";
import type { FrameworkAdapter } from "./types.ts";

// First match wins, so the fallback stays last.
const ADAPTERS: readonly FrameworkAdapter[] = [fallbackAdapter];

export function selectAdapter(root: string): FrameworkAdapter {
  return ADAPTERS.find((adapter) => adapter.detect(root)) ?? fallbackAdapter;
}

export type { FrameworkAdapter };

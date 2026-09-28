import { docusaurusAdapter } from "./docusaurus.ts";
import { fallbackAdapter } from "./fallback.ts";
import { nextjsAdapter } from "./nextjs.ts";
import type { FrameworkAdapter, ProjectInfo } from "./types.ts";

// First match wins, so the fallback stays last.
const ADAPTERS: readonly FrameworkAdapter[] = [nextjsAdapter, docusaurusAdapter, fallbackAdapter];

export function selectAdapter(project: ProjectInfo): FrameworkAdapter {
  return ADAPTERS.find((adapter) => adapter.detect(project)) ?? fallbackAdapter;
}

export type { FrameworkAdapter, ProjectInfo };

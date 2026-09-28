import { toolConventions } from "./conventions.ts";
import type { FrameworkAdapter } from "./types.ts";

// Next.js reaches files by where they sit: app/ and pages/ routing, and a few
// files at the project root. Either may live under src/.

const CODE = /\.(js|jsx|ts|tsx)$/;
// The file names the app router treats specially. Anything else under app/ is
// an ordinary module that something has to import.
const APP_FILES: Record<string, string> = {
  page: "Next.js page",
  layout: "Next.js layout",
  template: "Next.js template",
  loading: "Next.js loading UI",
  error: "Next.js error boundary",
  "global-error": "Next.js error boundary",
  "not-found": "Next.js not-found page",
  forbidden: "Next.js forbidden page",
  unauthorized: "Next.js unauthorized page",
  default: "Next.js parallel route default",
  route: "Next.js route handler",
  sitemap: "Next.js metadata file",
  robots: "Next.js metadata file",
  manifest: "Next.js metadata file",
  icon: "Next.js metadata file",
  "apple-icon": "Next.js metadata file",
  "opengraph-image": "Next.js metadata file",
  "twitter-image": "Next.js metadata file",
};
const ROOT_FILES: Record<string, string> = {
  middleware: "Next.js middleware",
  proxy: "Next.js proxy",
  instrumentation: "Next.js instrumentation",
  "instrumentation-client": "Next.js instrumentation",
};

export const nextjsAdapter: FrameworkAdapter = {
  name: "Next.js",
  detect: (project) => project.dependencies.has("next"),
  // Build output is dot-prefixed, so the generic rule already skips it.
  excludeDirectory: () => null,
  reachedBy(path) {
    return nextConvention(path) ?? toolConventions(path);
  },
};

function nextConvention(path: string): string | null {
  if (!CODE.test(path)) return null;
  const p = path.startsWith("src/") ? path.slice(4) : path;
  const name = p.slice(p.lastIndexOf("/") + 1).replace(CODE, "");

  if (p.startsWith("app/")) return APP_FILES[name] ?? null;
  if (p.startsWith("pages/api/")) return "Next.js API route";
  if (p.startsWith("pages/")) return "Next.js page";
  if (!p.includes("/")) return ROOT_FILES[name] ?? null;
  return null;
}

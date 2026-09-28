import { toolConventions } from "./conventions.ts";
import type { FrameworkAdapter } from "./types.ts";

// Docusaurus routes every file under src/pages, and swaps in any component
// under src/theme for the theme's own of the same name.
const CODE = /\.(js|jsx|ts|tsx)$/;

export const docusaurusAdapter: FrameworkAdapter = {
  name: "Docusaurus",
  detect: (project) => project.dependencies.has("@docusaurus/core"),
  excludeDirectory: () => null,
  reachedBy(path) {
    if (CODE.test(path)) {
      if (path.startsWith("src/pages/")) return "Docusaurus page";
      if (path.startsWith("src/theme/")) return "Docusaurus theme override";
      if (/^(docusaurus\.config|sidebars)\.[cm]?[jt]s$/.test(path)) return "Docusaurus config";
    }
    return toolConventions(path);
  },
};

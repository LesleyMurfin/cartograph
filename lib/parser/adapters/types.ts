// Framework knowledge enters the parser only through this interface. The parser
// asks the adapter questions; it never checks which framework it is looking at.
//
// A project is the repository root or any folder holding a package.json, and
// each project gets its own adapter, so a Next.js example inside a repository
// that isn't Next.js still has its pages recognised. Every path an adapter is
// asked about is relative to its project, not the repository.

export type ProjectInfo = {
  /** Absolute path of the project folder. */
  dir: string;
  /** Every name in the project's dependencies and devDependencies. */
  dependencies: ReadonlySet<string>;
};

export interface FrameworkAdapter {
  name: string;
  /** Whether this adapter applies to the project. */
  detect(project: ProjectInfo): boolean;
  /**
   * Called for each directory the walker is about to enter. Return a reason to
   * skip it, or null to walk it. Generic exclusions (node_modules,
   * dot-directories) are applied before this is asked.
   */
  excludeDirectory(projectRelativeDir: string): string | null;
  /**
   * How something other than an import reaches this file — the framework
   * routing to it, a tool loading it by name, a test runner collecting it — or
   * null when only imports would. Answered from the path alone, so it's a
   * convention the file sits in, never a guess about what it does.
   */
  reachedBy(projectRelativePath: string): string | null;
}

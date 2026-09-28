// Framework knowledge enters the parser only through this interface. The parser
// asks the adapter questions; it never checks which framework it is looking at.
export interface FrameworkAdapter {
  name: string;
  /** Whether this adapter applies to the repository at `root`. */
  detect(root: string): boolean;
  /**
   * Called for each directory the walker is about to enter (repository-relative).
   * Return a reason to skip it, or null to walk it. Generic exclusions
   * (node_modules, dot-directories) are applied before this is asked.
   */
  excludeDirectory(relativeDir: string): string | null;
}

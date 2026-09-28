// A file's category is its extension: a fact read off the path, not a guess
// about what the file does. Role-based categories come from adapters later.
export function categoryOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "(none)" : name.slice(dot + 1);
}

export function countByCategory(paths: readonly string[]): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of paths) counts.set(categoryOf(p), (counts.get(categoryOf(p)) ?? 0) + 1);
  return [...counts]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

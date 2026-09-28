import { categoryLabel, countByCategory } from "@/lib/graph/categories";
import { CategorySwatch } from "./map/swatch";

// Clicking a category dims what isn't in it on the map rather than hiding it,
// so the shape of the whole repository stays on screen. Clicking it again, or
// another one, moves on.
export function CategoryRail({
  paths,
  active,
  onToggle,
}: {
  paths: string[];
  active: string | null;
  onToggle: (category: string) => void;
}) {
  return (
    <div className="py-2">
      <h2 className="px-3 pb-1 text-[11px] text-fg-muted">
        Categories <span className="tabular-nums">· {paths.length} files</span>
      </h2>
      <ul>
        {countByCategory(paths).map(({ category, count }) => {
          const on = active === category;
          return (
            <li key={category}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(category)}
                className={`flex h-6 w-full items-center gap-2 px-3 text-left text-xs ${
                  on ? "bg-accent/15 shadow-[inset_2px_0_0_var(--accent)]" : active ? "text-fg-muted hover:bg-raised" : "hover:bg-raised"
                }`}
              >
                <CategorySwatch category={category} />
                <span className="flex-1 font-mono">{categoryLabel(category)}</span>
                <span className="text-fg-muted tabular-nums">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { useMemo, type ReactNode } from "react";
import { categoryLabel, categoryOf, countByCategory } from "@/lib/graph/categories";
import { neighboursOf, rankRepository, type Neighbour, type Ranked } from "@/lib/graph/detail";
import type { Folding } from "@/lib/graph/fold";
import type { Selection } from "@/lib/graph/highlight";
import { groupFan, groupId } from "@/lib/graph/view";
import type { Edge, ParsedFile } from "@/lib/parser/types";
import { CategorySwatch } from "./map/swatch";

export type Tab = "structure" | "explanation";

/** What the pane says about the repository that isn't in the file and edge lists. */
export type RepositoryFacts = {
  name: string;
  /** The adapter the parser chose. "none" is the fallback. */
  adapter: string;
  skipped: number;
  unresolved: number;
};

type Props = {
  files: ParsedFile[];
  byPath: ReadonlyMap<string, ParsedFile>;
  edges: Edge[];
  folding: Folding;
  repository: RepositoryFacts;
  selection: Selection;
  hover: Selection;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onReveal: (path: string) => void;
  onHover: (hover: Selection) => void;
};

export function DetailPane(props: Props) {
  const { selection, folding, byPath } = props;
  // Whether a path is what the pointer is over, on the map or in here. A
  // hovered folder marks every file inside it.
  const isHovered = (path: string) => {
    const h = props.hover;
    if (!h) return false;
    if (h.kind === "file") return h.path === path;
    const dir = folding.groupOf.get(path);
    return dir !== undefined && groupId(dir) === h.id;
  };
  const paths: PathActions = { isHovered, onReveal: props.onReveal, onHover: props.onHover };

  if (!selection) return <RepositorySummary {...props} paths={paths} />;

  if (selection.kind === "file") {
    const file = byPath.get(selection.path);
    if (!file) return null;
    return (
      <Selected title={<PathTitle path={file.path} paths={paths} />} caption="file" tab={props.tab} onTab={props.onTab}>
        <FileStructure file={file} edges={props.edges} paths={paths} />
      </Selected>
    );
  }

  const group = folding.groups.find((g) => groupId(g.dir) === selection.id);
  if (!group) return null;
  return (
    <Selected
      title={<span className="font-mono text-[12px] break-all">{group.dir === "." ? "(root)" : `${group.dir}/`}</span>}
      caption="folder"
      tab={props.tab}
      onTab={props.onTab}
    >
      <GroupStructure files={group.files} fan={groupFanOf(folding, props.edges, group.dir)} />
    </Selected>
  );
}

function groupFanOf(folding: Folding, edges: readonly Edge[], dir: string) {
  return groupFan(folding, edges).get(dir) ?? { fanIn: 0, fanOut: 0 };
}

type PathActions = {
  isHovered: (path: string) => boolean;
  onReveal: (path: string) => void;
  onHover: (hover: Selection) => void;
};

// ── Nothing selected ─────────────────────────────────────────────────────────

function RepositorySummary({ files, repository, paths }: Props & { paths: PathActions }) {
  const ranked = useMemo(() => rankRepository(files), [files]);
  // Distinct file-to-file pairs, the unit every file's own counts use, so this
  // is the sum of what the pane says for each file.
  const imports = useMemo(() => files.reduce((n, f) => n + f.fanOut, 0), [files]);
  return (
    <div className="pb-3">
      <header className="border-b border-line px-3 py-2">
        <h2 className="font-mono text-[13px] font-semibold break-all">{repository.name}</h2>
        <p className="mt-0.5 text-[11px] text-fg-muted">
          Framework{" "}
          <span className="text-fg">{repository.adapter === "none" ? "none detected" : repository.adapter}</span>
        </p>
      </header>

      <dl className="grid grid-cols-3 border-b border-line">
        <Count label="Files" value={files.length} note={repository.skipped > 0 ? `${repository.skipped} skipped` : null} />
        <Count
          label="Imports"
          value={imports}
          note={repository.unresolved > 0 ? `${repository.unresolved} unresolved` : null}
          title="Distinct file-to-file imports resolved inside this repository"
        />
        {/* The parse output carries no routes: none are recovered without a
            framework adapter, and zero would claim something never checked. */}
        <Count label="Routes" value={null} note="no adapter" title="No framework adapter ran, so no routes were recovered" />
      </dl>

      <RankedList
        title="Most depended on"
        hint="by files importing it"
        ranked={ranked.mostDependedOn}
        figure={(f) => <span className="text-incoming">←{f.fanIn}</span>}
        paths={paths}
      />
      <RankedList
        title="Imported by nothing"
        hint="where reading starts"
        ranked={ranked.unimported}
        figure={(f) => <span className="text-outgoing">{f.fanOut}→</span>}
        paths={paths}
      />

      {/* The parse output has no per-file role: the fallback adapter applies
          no conventions, so every file is one no convention identified. */}
      <section className="mt-3 px-3">
        <h3 className="flex items-baseline justify-between text-[11px] text-fg-muted">
          <span>Unidentified by convention</span>
          <span className="text-fg tabular-nums">{files.length}</span>
        </h3>
        <p className="mt-0.5 text-[11px] text-fg-muted">No framework adapter applied, so no file was matched to a role.</p>
      </section>
    </div>
  );
}

function Count({ label, value, note, title }: { label: string; value: number | null; note: string | null; title?: string }) {
  return (
    <div className="border-r border-line px-3 py-2 last:border-r-0" title={title}>
      <dt className="text-[11px] text-fg-muted">{label}</dt>
      <dd className="text-[15px] leading-5 tabular-nums">{value ?? <span className="text-fg-muted">—</span>}</dd>
      {note && <dd className="text-[10px] text-fg-muted tabular-nums">{note}</dd>}
    </div>
  );
}

function RankedList(props: {
  title: string;
  hint: string;
  ranked: Ranked;
  figure: (file: ParsedFile) => ReactNode;
  paths: PathActions;
}) {
  const { files, total } = props.ranked;
  return (
    <section className="mt-3">
      <h3 className="flex items-baseline gap-1.5 px-3 pb-0.5 text-[11px] text-fg-muted">
        <span className="text-fg">{props.title}</span>
        <span>{props.hint}</span>
        <span className="ml-auto tabular-nums">{total}</span>
      </h3>
      {files.length === 0 ? (
        <p className="px-3 text-[11px] text-fg-muted">None.</p>
      ) : (
        <ul>
          {files.map((f) => (
            <PathRow key={f.path} path={f.path} paths={props.paths} trailing={props.figure(f)} />
          ))}
        </ul>
      )}
      {total > files.length && (
        <p className="px-3 pt-0.5 text-[10px] text-fg-muted tabular-nums">{total - files.length} more not listed</p>
      )}
    </section>
  );
}

// ── Something selected ───────────────────────────────────────────────────────

function Selected(props: { title: ReactNode; caption: string; tab: Tab; onTab: (tab: Tab) => void; children: ReactNode }) {
  return (
    <div className="pb-3">
      <header className="border-b border-line px-3 pt-2">
        <p className="text-[10px] text-fg-muted">{props.caption}</p>
        <h2 className="leading-4">{props.title}</h2>
        <div role="tablist" className="mt-2 flex gap-3 text-[11px]">
          <TabButton tab="structure" label="Structure" current={props.tab} onTab={props.onTab} />
          <TabButton tab="explanation" label="Explanation" current={props.tab} onTab={props.onTab} />
        </div>
      </header>
      {props.tab === "structure" ? (
        props.children
      ) : (
        <div className="px-3 py-3 text-[11px] text-fg-muted">
          <p className="text-fg">No explanation yet.</p>
          <p className="mt-0.5">Explanations come from a model call, and nothing makes one yet.</p>
        </div>
      )}
    </div>
  );
}

function TabButton({ tab, label, current, onTab }: { tab: Tab; label: string; current: Tab; onTab: (tab: Tab) => void }) {
  const active = tab === current;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onTab(tab)}
      className={`-mb-px border-b pb-1.5 ${active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"}`}
    >
      {label}
    </button>
  );
}

// Clickable like every other path in the pane: it brings the file back into
// view on the map if its folder has been scrolled or closed since.
function PathTitle({ path, paths }: { path: string; paths: PathActions }) {
  const slash = path.lastIndexOf("/");
  return (
    <button
      type="button"
      onClick={() => paths.onReveal(path)}
      onMouseEnter={() => paths.onHover({ kind: "file", path })}
      onMouseLeave={() => paths.onHover(null)}
      className="text-left font-mono text-[12px] break-all hover:underline"
    >
      {slash >= 0 && <span className="text-fg-muted">{path.slice(0, slash + 1)}</span>}
      <span className="font-semibold">{path.slice(slash + 1)}</span>
    </button>
  );
}

function FileStructure({ file, edges, paths }: { file: ParsedFile; edges: Edge[]; paths: PathActions }) {
  const { imports, importedBy } = useMemo(() => neighboursOf(edges, file.path), [edges, file.path]);
  const category = categoryOf(file.path);
  // Counts are the lengths of the lists below them, so they can't disagree.
  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-b border-line px-3 py-2 text-[11px]">
        <Fact label="Kind">
          <span className="flex items-center gap-1.5 font-mono">
            <CategorySwatch category={category} />
            {categoryLabel(category)}
          </span>
        </Fact>
        <Fact label="Folder">
          <span className="font-mono break-all">{file.module}</span>
        </Fact>
        <Fact label="Length">
          {file.lines} {file.lines === 1 ? "line" : "lines"}
        </Fact>
        <Fact label="Depends on">
          <span className="text-outgoing">{imports.length}</span> {imports.length === 1 ? "file" : "files"}
        </Fact>
        <Fact label="Depended on by">
          <span className="text-incoming">{importedBy.length}</span> {importedBy.length === 1 ? "file" : "files"}
        </Fact>
      </dl>
      <NeighbourList title="Imports" count={<span className="text-outgoing">{imports.length}→</span>} rows={imports} paths={paths} />
      <NeighbourList
        title="Imported by"
        count={<span className="text-incoming">←{importedBy.length}</span>}
        rows={importedBy}
        paths={paths}
      />
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0 tabular-nums">{children}</dd>
    </>
  );
}

function NeighbourList(props: { title: string; count: ReactNode; rows: Neighbour[]; paths: PathActions }) {
  return (
    <section className="mt-3">
      <h3 className="flex items-baseline justify-between px-3 pb-0.5 text-[11px]">
        <span>{props.title}</span>
        <span className="tabular-nums">{props.count}</span>
      </h3>
      {props.rows.length === 0 ? (
        <p className="px-3 text-[11px] text-fg-muted">None.</p>
      ) : (
        <ul>
          {props.rows.map((n) => (
            <PathRow key={n.path} path={n.path} paths={props.paths} trailing={<EdgeMarks neighbour={n} />} />
          ))}
        </ul>
      )}
    </section>
  );
}

// Only what differs from a plain value import is marked, so most rows carry nothing.
function EdgeMarks({ neighbour }: { neighbour: Neighbour }) {
  const marks = [
    ...(neighbour.kinds.includes("re-export") ? ["re-export"] : []),
    ...(neighbour.kinds.includes("dynamic-import") ? ["dynamic"] : []),
    ...(neighbour.typeOnly ? ["type"] : []),
  ];
  if (marks.length === 0) return null;
  return <span className="text-fg-muted">{marks.join(" · ")}</span>;
}

function GroupStructure({ files, fan }: { files: string[]; fan: { fanIn: number; fanOut: number } }) {
  const kinds = useMemo(() => countByCategory(files), [files]);
  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-b border-line px-3 py-2 text-[11px]">
        <Fact label="Files">{files.length}</Fact>
        <Fact label="Imported from outside by">
          <span className="text-incoming">{fan.fanIn}</span> {fan.fanIn === 1 ? "file" : "files"}
        </Fact>
        <Fact label="Imports from outside">
          <span className="text-outgoing">{fan.fanOut}</span> {fan.fanOut === 1 ? "file" : "files"}
        </Fact>
      </dl>
      <section className="mt-3">
        <h3 className="px-3 pb-0.5 text-[11px]">Kinds of file inside</h3>
        <ul>
          {kinds.map(({ category, count }) => (
            <li key={category} className="flex h-[22px] items-center gap-2 px-3 text-[11px]">
              <CategorySwatch category={category} />
              <span className="flex-1 font-mono">{categoryLabel(category)}</span>
              <span className="text-fg-muted tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// ── Shared ───────────────────────────────────────────────────────────────────

// Every path in the pane is one of these: clicking moves the map's selection
// to it, hovering marks it on the map, and it's marked here when the map
// reports the pointer over it.
function PathRow({ path, paths, trailing }: { path: string; paths: PathActions; trailing?: ReactNode }) {
  const slash = path.lastIndexOf("/");
  const hovered = paths.isHovered(path);
  return (
    <li>
      <button
        type="button"
        title={path}
        onClick={() => paths.onReveal(path)}
        onMouseEnter={() => paths.onHover({ kind: "file", path })}
        onMouseLeave={() => paths.onHover(null)}
        className={`flex h-[22px] w-full min-w-0 items-center gap-2 px-3 text-left text-[11px] ${
          hovered ? "bg-accent/15 shadow-[inset_2px_0_0_var(--accent)]" : "hover:bg-raised"
        }`}
      >
        <span className="flex min-w-0 flex-1 font-mono">
          {slash >= 0 && <span className="truncate text-fg-muted">{path.slice(0, slash + 1)}</span>}
          <span className="shrink-0">{path.slice(slash + 1)}</span>
        </span>
        {trailing && <span className="shrink-0 text-[10px] tabular-nums">{trailing}</span>}
      </button>
    </li>
  );
}

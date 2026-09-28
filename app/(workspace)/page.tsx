import { auth } from "@clerk/nextjs/server";
import type { Enums } from "@/lib/supabase/database.types";
import { createServerSupabase } from "@/lib/supabase/server";

type Status = Enums<"analysis_status">;

const LIST_LIMIT = 100;
const STATUS_ORDER: Status[] = ["parsing", "queued", "complete", "failed"];

export default async function DashboardPage() {
  const { sessionClaims } = await auth();

  // Read off the token, never fetched from Clerk. If the claim is missing the
  // session token hasn't been customised yet, and that should be obvious.
  const orgName = sessionClaims?.org_name;
  if (!orgName) {
    throw new Error(
      'Session token has no org_name claim. Add "org_name": "{{org.name}}" in Clerk → Sessions → Customize session token.',
    );
  }

  // No organization filter: the row policy scopes this to the organization on
  // the token. Switching organization changes the token, not this query.
  const supabase = await createServerSupabase();
  const { data: analyses, error } = await supabase
    .from("analyses")
    .select("id, status, commit_sha, error, created_at, finished_at, projects(repo_owner, repo_name)")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Couldn't load analyses: ${error.message}`);

  const counts = new Map<Status, number>();
  for (const a of analyses) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-4 border-b border-line px-3">
        <h1 className="text-[13px] font-semibold">{orgName}</h1>
        <span className="text-xs text-fg-muted tabular-nums">
          {analyses.length === LIST_LIMIT
            ? `Latest ${LIST_LIMIT} analyses`
            : `${analyses.length} ${analyses.length === 1 ? "analysis" : "analyses"}`}
        </span>
        {analyses.length > 0 && (
          <ul className="ml-auto flex items-center gap-3 text-xs text-fg-muted tabular-nums">
            {STATUS_ORDER.filter((s) => counts.has(s)).map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <StateMark status={s} />
                {counts.get(s)} {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      {analyses.length === 0 ? (
        <div className="px-3 py-10 text-xs text-fg-muted">
          <p className="text-fg">No analyses yet.</p>
          <p className="mt-1">Repositories this organization analyses will be listed here.</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-xs">
            <colgroup>
              <col />
              <col className="w-28" />
              <col className="hidden w-20 sm:table-column" />
              <col className="w-20" />
              <col className="hidden w-20 sm:table-column" />
            </colgroup>
            <thead className="sticky top-0 bg-canvas text-left text-fg-muted">
              <tr className="h-7 border-b border-line">
                <th className="px-3 font-normal">Repository</th>
                <th className="px-3 font-normal">State</th>
                <th className="hidden px-3 font-normal sm:table-cell">Commit</th>
                <th className="px-3 text-right font-normal">Started</th>
                <th className="hidden px-3 text-right font-normal sm:table-cell">Finished</th>
              </tr>
            </thead>
            <tbody>
              {analyses.map((a) => (
                <tr key={a.id} className="border-b border-line align-top">
                  <td className="truncate px-3 py-1.5 font-mono">
                    {a.projects ? (
                      <>
                        <span className="text-fg-muted">{a.projects.repo_owner}/</span>
                        {a.projects.repo_name}
                      </>
                    ) : (
                      <span className="text-fg-muted">—</span>
                    )}
                    {a.error && (
                      <div className="mt-0.5 truncate font-sans text-fg-muted" title={a.error}>
                        {a.error}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`flex items-center gap-1.5 ${
                        a.status === "queued" ? "text-fg-muted" : "text-fg"
                      }`}
                    >
                      <StateMark status={a.status} />
                      {a.status}
                    </span>
                  </td>
                  <td className="hidden px-3 py-1.5 font-mono text-fg-muted sm:table-cell">
                    {a.commit_sha ? (
                      <span title={a.commit_sha}>{a.commit_sha.slice(0, 7)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right text-fg-muted tabular-nums">
                    <time dateTime={a.created_at} title={a.created_at}>
                      {ago(a.created_at)}
                    </time>
                  </td>
                  <td className="hidden px-3 py-1.5 text-right text-fg-muted tabular-nums sm:table-cell">
                    {a.finished_at ? (
                      <time dateTime={a.finished_at} title={a.finished_at}>
                        {ago(a.finished_at)}
                      </time>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// State is carried by shape, not hue: green, amber and blue already mean
// direction and interaction elsewhere, so status stays greyscale. The ring
// fills as an analysis progresses; failure crosses it out.
function StateMark({ status }: { status: Status }) {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5 shrink-0" aria-hidden="true">
      {status === "complete" ? (
        <circle cx="5" cy="5" r="4.5" fill="currentColor" />
      ) : (
        <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1" />
      )}
      {status === "parsing" && <path d="M5 1 A4 4 0 0 1 5 9 Z" fill="currentColor" />}
      {status === "failed" && (
        <path d="M2.2 2.2 L7.8 7.8 M7.8 2.2 L2.2 7.8" stroke="currentColor" strokeWidth="1" />
      )}
    </svg>
  );
}

// Relative rather than a clock time: the server doesn't know the viewer's
// timezone, and "3h ago" is right everywhere. Exact time is in the title.
function ago(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

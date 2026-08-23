import { Banner, EmptyState, PageHeader, TableShell, TBody, Td, Th } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { restoreConfig } from "@/lib/actions/config-history-actions";
import { RESTORABLE_PATHS, getConfigHistory, type CommitInfo } from "@/lib/config-history";

const FILE_LABELS: Record<string, string> = {
  "data/accounts.json": "accounts.json",
  "data/categories.json": "categories.json",
};

function isRestorablePathParam(value: string | undefined): boolean {
  return typeof value === "string" && (RESTORABLE_PATHS as readonly string[]).includes(value);
}

export default async function ConfigHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ file?: string; error?: string; restored?: string; sha?: string }>;
}) {
  const params = await searchParams;
  const file = isRestorablePathParam(params.file) ? params.file : RESTORABLE_PATHS[0];

  let commits: CommitInfo[] = [];
  let loadError: string | null = null;
  try {
    commits = await getConfigHistory().listCommits(file as (typeof RESTORABLE_PATHS)[number]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "failed to list history";
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader title="Config" subtitle="Every save is a commit — restore any prior revision as a fresh commit" />

      {params.error && <Banner variant="error">{params.error}</Banner>}
      {params.restored && (
        <Banner variant="info">
          Restored {FILE_LABELS[params.restored] ?? params.restored} to {(params.sha ?? "").slice(0, 7)}.
        </Banner>
      )}

      <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-surface p-1" data-testid="config-file-tabs">
        {RESTORABLE_PATHS.map((path) => (
          <a
            key={path}
            href={`/config?file=${encodeURIComponent(path)}`}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs transition-all duration-200 ease-brand outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
              file === path ? "bg-white/5 text-white" : "text-slate-muted hover:text-white"
            }`}
          >
            {FILE_LABELS[path] ?? path}
          </a>
        ))}
      </nav>

      {loadError ? (
        <Banner variant="error">{loadError}</Banner>
      ) : commits.length === 0 ? (
        <EmptyState message="No commits touch this file yet." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Commit</Th>
              <Th>Message</Th>
              <Th>When</Th>
              <Th right>Action</Th>
            </tr>
          </thead>
          <TBody>
            {commits.map((commit, index) => (
              <tr key={commit.sha}>
                <Td>{commit.shortSha}</Td>
                <Td>{commit.message}</Td>
                <Td>{new Date(commit.date).toISOString()}</Td>
                <td className="px-4 py-3 text-right">
                  {index === 0 ? (
                    <span className="font-mono text-[11px] uppercase tracking-wider text-slate-muted">current</span>
                  ) : (
                    <form action={restoreConfig} className="inline">
                      <input type="hidden" name="path" value={file} />
                      <input type="hidden" name="sha" value={commit.sha} />
                      <SubmitButton pendingLabel="Restoring…">Restore</SubmitButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </TBody>
        </TableShell>
      )}
    </div>
  );
}

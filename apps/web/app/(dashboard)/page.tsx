import { countPublishedSince, findFailedSince, findRecentPosts } from "core/src/db/dashboard-queries";
import { StatusBadge } from "@/components/StatusBadge";
import { getAccounts, getDbHandle } from "@/lib/db";
import { PageHeader, StatBlock, TableShell, TBody, Th, Td, EmptyState, Banner, TitaniumCard } from "@/components/ui";
import { RunNowForm } from "@/components/RunNowCard";
import { RunnerUnavailableError, getRunner } from "@/lib/runner";


export default async function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ dispatched?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const accounts = await getAccounts();
  const { db, close } = await getDbHandle();

  let recentRuns: Array<{ id: number; status: string; conclusion: string | null; createdAt: string; htmlUrl: string }> = [];
  let runnerHint: string | null = null;
  try {
    recentRuns = await getRunner().listRecentRuns();
  } catch (error) {
    if (error instanceof RunnerUnavailableError) runnerHint = error.message;
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [accountCounts, recentPosts, recentFailures] = await Promise.all([
      Promise.all(
        accounts.map(async (account) => ({
          account,
          count: await countPublishedSince(db, account.id, since),
        })),
      ),
      findRecentPosts(db, 5),
      findFailedSince(db, since),
    ]);

    const totalToday = accountCounts.reduce((sum, entry) => sum + entry.count, 0);

    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Overview" subtitle="Last 24 hours across all accounts · data as of last deploy" />

        {recentFailures.length > 0 && (
          <Banner variant="error">
            {recentFailures.length} failure{recentFailures.length === 1 ? "" : "s"} in the last 24h —{" "}
            {recentFailures.map((post) => post.accountId).join(", ")}
          </Banner>
        )}

        {params.dispatched && <Banner variant="info">post.yml dispatched — check Recent runs below.</Banner>}

        <TitaniumCard className="p-5" >
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-wider text-slate-muted">Runner</p>
          </div>
          <RunNowForm />
        </TitaniumCard>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="overview-stats">
          <StatBlock label="Published today" value={totalToday} detail={`cap ${accountCounts.length * 22}`} barPercent={accountCounts.length > 0 ? (totalToday / (accountCounts.length * 22)) * 100 : 0} />
          <StatBlock label="Accounts active" value={accounts.filter((a) => a.active).length} />
          <StatBlock label="Failures 24h" value={recentFailures.length} />
          <StatBlock label="Recent posts" value={recentPosts.length} />
        </div>

        <TitaniumCard className="p-5">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-muted">Per-account today</p>
          {accountCounts.length === 0 ? (
            <EmptyState message="No accounts configured yet — add one on the Accounts page." />
          ) : (
            <ul className="flex flex-col gap-2 font-mono text-sm">
              {accountCounts.map(({ account, count }) => (
                <li key={account.id} className="flex items-center justify-between">
                  <span className="text-platinum">{account.id}</span>
                  <span className="text-slate-muted">{count} / 22</span>
                </li>
              ))}
            </ul>
          )}
        </TitaniumCard>

        <div>
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-muted">Recent workflow runs</p>
          {recentRuns.length === 0 ? (
            <EmptyState message={runnerHint ?? "No workflow runs recorded yet."} />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Created</Th>
                  <Th>Status</Th>
                  <Th right>Conclusion</Th>
                </tr>
              </thead>
              <TBody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <Td>{new Date(run.createdAt).toISOString()}</Td>
                    <Td>{run.status}</Td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      <a href={run.htmlUrl} target="_blank" rel="noreferrer" className="text-platinum underline decoration-white/30 hover:text-white">
                        {run.conclusion ?? run.status}
                      </a>
                    </td>
                  </tr>
                ))}
              </TBody>
            </TableShell>
          )}
        </div>

        <div>
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-muted">Recent posts</p>
          {recentPosts.length === 0 ? (
            <EmptyState message="No posts yet." />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Account</Th>
                  <Th>Template</Th>
                  <Th>When</Th>
                  <Th right>Status</Th>
                </tr>
              </thead>
              <TBody>
                {recentPosts.map((post) => (
                  <tr key={post.id}>
                    <Td>{post.accountId}</Td>
                    <Td>{post.templateId}</Td>
                    <Td>{String(post.publishedAt ?? post.scheduledFor)}</Td>
                    <td className="px-4 py-3 text-right"><StatusBadge status={post.status} /></td>
                  </tr>
                ))}
              </TBody>
            </TableShell>
          )}
        </div>
      </div>
    );
  } finally {
    close();
  }
}

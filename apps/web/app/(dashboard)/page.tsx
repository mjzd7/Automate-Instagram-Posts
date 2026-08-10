import { countPublishedSince, findFailedSince, findRecentPosts } from "core/src/db/dashboard-queries";
import { StatusBadge } from "@/components/StatusBadge";
import { getAccounts, getDbHandle } from "@/lib/db";

export default async function OverviewPage() {
  const accounts = await getAccounts();
  const { db, close } = await getDbHandle();

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

    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <h1 className="font-display text-3xl font-light">Overview</h1>

        {recentFailures.length > 0 && (
          <section className="shadow-elevated rounded-control border border-red-500/30 bg-surface p-6">
            <h2 className="mb-4 text-sm font-medium text-red-400">
              {recentFailures.length} failure{recentFailures.length === 1 ? "" : "s"} in the last 24h
            </h2>
            <ul className="flex flex-col gap-2">
              {recentFailures.map((post) => (
                <li key={post.id} className="text-sm text-text-secondary">
                  <span className="text-text-primary">{post.accountId}</span> — {post.errorMessage ?? "unknown error"}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="shadow-elevated rounded-control border border-white/10 bg-surface p-6">
          <h2 className="mb-4 text-sm font-medium text-text-secondary">Accounts (published in last 24h)</h2>
          {accountCounts.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No accounts configured yet — add one on the Accounts page.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {accountCounts.map(({ account, count }) => (
                <li key={account.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-primary">{account.id}</span>
                  <span className="text-text-secondary">{count} / 22</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="shadow-elevated rounded-control border border-white/10 bg-surface p-6">
          <h2 className="mb-4 text-sm font-medium text-text-secondary">Recent posts</h2>
          {recentPosts.length === 0 ? (
            <p className="text-sm text-text-secondary">No posts yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {recentPosts.map((post) => (
                <li key={post.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-primary">
                    {post.accountId} — {post.templateId}
                  </span>
                  <StatusBadge status={post.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  } finally {
    close();
  }
}
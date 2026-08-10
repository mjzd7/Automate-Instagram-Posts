import { findPostsForAccount, findRecentPosts } from "core/src/db/dashboard-queries";
import { StatusBadge } from "@/components/StatusBadge";
import { getAccounts, getDbHandle } from "@/lib/db";

const HISTORY_LIMIT = 50;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const [accounts, { account: selectedAccount }] = await Promise.all([getAccounts(), searchParams]);
  const { db, close } = await getDbHandle();

  try {
    const posts = selectedAccount
      ? await findPostsForAccount(db, selectedAccount, HISTORY_LIMIT)
      : await findRecentPosts(db, HISTORY_LIMIT);

    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <h1 className="font-display text-3xl font-light">History</h1>

        <div className="flex flex-wrap gap-2">
          <a
            href="/history"
            className={`rounded-control px-3 py-1.5 text-sm transition-colors duration-150 ease-brand ${
              !selectedAccount ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            All accounts
          </a>
          {accounts.map((account) => (
            <a
              key={account.id}
              href={`/history?account=${encodeURIComponent(account.id)}`}
              className={`rounded-control px-3 py-1.5 text-sm transition-colors duration-150 ease-brand ${
                selectedAccount === account.id
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {account.id}
            </a>
          ))}
        </div>

        <section className="shadow-elevated rounded-control border border-white/10 bg-surface p-6">
          {posts.length === 0 ? (
            <p className="text-sm text-text-secondary">No posts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-text-secondary">
                    <th className="pb-2 pr-4 font-medium">Account</th>
                    <th className="pb-2 pr-4 font-medium">Template</th>
                    <th className="pb-2 pr-4 font-medium">Mode</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">When</th>
                    <th className="pb-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id} className="border-t border-white/5">
                      <td className="py-2 pr-4 text-text-primary">{post.accountId}</td>
                      <td className="py-2 pr-4 text-text-secondary">{post.templateId}</td>
                      <td className="py-2 pr-4 text-text-secondary">{post.mode}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={post.status} />
                      </td>
                      <td className="py-2 pr-4 text-text-secondary">
                        {post.publishedAt ?? post.scheduledFor}
                      </td>
                      <td className="py-2 text-text-secondary">
                        {post.status === "failed" ? (post.errorMessage ?? "unknown error") : (post.igPermalink ?? "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  } finally {
    close();
  }
}

import { findPostsForAccount, findRecentPosts } from "core/src/db/dashboard-queries";
import { StatusBadge } from "@/components/StatusBadge";
import { getAccounts, getDbHandle } from "@/lib/db";
import { EmptyState, PageHeader, TableShell, TBody, Td, Th } from "@/components/ui";

const HISTORY_LIMIT = 50;

function chipClass(active: boolean): string {
  return `rounded-lg px-3 py-1.5 font-mono text-xs transition-all duration-200 ease-brand outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
    active ? "bg-white/5 text-white" : "text-slate-muted hover:text-white"
  }`;
}

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
      <div className="flex flex-col gap-6">
        <PageHeader title="History" subtitle={`Last ${HISTORY_LIMIT} posts — as of the last deploy`} />

        <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-surface p-1" data-testid="history-filter">
          <a href="/history" className={chipClass(!selectedAccount)}>All accounts</a>
          {accounts.map((account) => (
            <a
              key={account.id}
              href={`/history?account=${encodeURIComponent(account.id)}`}
              className={chipClass(selectedAccount === account.id)}
            >
              {account.id}
            </a>
          ))}
        </nav>

        {posts.length === 0 ? (
          <EmptyState message="No posts yet." />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Account</Th>
                <Th>Template</Th>
                <Th>Mode</Th>
                <Th>Status</Th>
                <Th>When</Th>
                <Th right>Detail</Th>
              </tr>
            </thead>
            <TBody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <Td>{post.accountId}</Td>
                  <Td>{post.templateId}</Td>
                  <Td>{post.mode}</Td>
                  <td className="px-4 py-3"><StatusBadge status={post.status} /></td>
                  <Td>{String(post.publishedAt ?? post.scheduledFor)}</Td>
                  <Td right>{post.status === "failed" ? (post.errorMessage ?? "unknown error") : (post.igPermalink ?? "")}</Td>
                </tr>
              ))}
            </TBody>
          </TableShell>
        )}
      </div>
    );
  } finally {
    close();
  }
}

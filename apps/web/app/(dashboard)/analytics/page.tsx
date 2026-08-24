import { Banner, EmptyState, PageHeader, StatBlock, TableShell, TBody, Td, Th, TitaniumCard } from "@/components/ui";
import { getAccounts } from "@/lib/db";
import { AnalyticsUnavailableError, getAccountAnalytics } from "@/lib/analytics";

const SETUP_STEPS = [
  "IG account must be Business/Creator linked to a Facebook Page",
  "Meta app needs instagram_business_basic (+ read_insights for reach metrics)",
  "Re-auth the account so its stored token carries the scopes",
  "Set TOKEN_ENCRYPTION_KEY in this environment (see SETUP.md)",
];

function chip(active: boolean): string {
  return `rounded-lg px-3 py-1.5 font-mono text-xs transition-all duration-200 ease-brand outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
    active ? "bg-white/5 text-white" : "text-slate-muted hover:text-white"
  }`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; error?: string }>;
}) {
  const [accounts, params] = await Promise.all([getAccounts(), searchParams]);
  const selected = accounts.find((a) => a.id === params.account) ?? accounts[0];

  let overview: Awaited<ReturnType<typeof getAccountAnalytics>> | null = null;
  let hint: string | null = params.error ?? null;
  if (selected && !hint) {
    try {
      overview = await getAccountAnalytics(selected.id);
    } catch (error) {
      hint =
        error instanceof AnalyticsUnavailableError
          ? error.message
          : error instanceof Error
            ? error.message
            : "unknown analytics failure";
    }
  }

  const summary = overview
    ? {
        followers: overview.followersCount,
        mediaCount: overview.mediaCount,
        ...(() => {
          const posts = overview.posts;
          const totalLikes = posts.reduce((s2, p2) => s2 + p2.likeCount, 0);
          const totalComments = posts.reduce((s2, p2) => s2 + p2.commentsCount, 0);
          return {
            avgLikes: posts.length > 0 ? Math.round(totalLikes / posts.length) : 0,
            avgComments: posts.length > 0 ? Math.round(totalComments / posts.length) : 0,
          };
        })(),
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics" subtitle="Live IG Insights per account — tokens decrypted server-side only" />

      {accounts.length > 1 && (
        <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-surface p-1" data-testid="analytics-filter">
          {accounts.map((account) => (
            <a key={account.id} href={`/analytics?account=${encodeURIComponent(account.id)}`} className={chip(selected?.id === account.id)}>
              {account.id}
            </a>
          ))}
        </nav>
      )}

      {hint && (
        <>
          <Banner variant="error">{hint}</Banner>
          <TitaniumCard className="p-6">
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-muted">Enable checklist</p>
            <ul className="flex list-inside list-disc flex-col gap-1 font-mono text-sm text-platinum">
              {SETUP_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </TitaniumCard>
        </>
      )}

      {!selected && !hint && <EmptyState message="No accounts configured yet." />}

      {selected && summary && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="analytics-stats">
            <StatBlock label="Followers" value={summary.followers ?? "—"} />
            <StatBlock label="Media total" value={summary.mediaCount ?? "—"} />
            <StatBlock label="Avg likes (last)" value={summary.avgLikes} detail={`${overview!.posts.length} posts`} />
            <StatBlock label="Avg comments" value={summary.avgComments} />
          </div>

          {overview!.posts.length === 0 ? (
            <EmptyState message="No media returned for this account." />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Posted</Th>
                  <Th>Type</Th>
                  <Th right>Likes</Th>
                  <Th right>Comments</Th>
                  <Th right>Link</Th>
                </tr>
              </thead>
              <TBody>
                {overview!.posts.map((post) => (
                  <tr key={post.id}>
                    <Td>{new Date(post.timestamp).toISOString().slice(0, 16).replace("T", " ")}</Td>
                    <Td>{post.mediaProductType ?? post.mediaType}</Td>
                    <Td right>{post.likeCount}</Td>
                    <Td right>{post.commentsCount}</Td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {post.permalink ? (
                        <a href={post.permalink} target="_blank" rel="noreferrer" className="text-platinum underline decoration-white/30 hover:text-white">
                          open ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </TBody>
            </TableShell>
          )}
        </>
      )}
    </div>
  );
}

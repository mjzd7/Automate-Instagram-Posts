import { findPostsForAccount, findRecentPosts } from "core/src/db/dashboard-queries";
import { StatusBadge } from "@/components/StatusBadge";
import { getAccounts, getDbHandle } from "@/lib/db";
import { resolveAudioTitles } from "@/lib/audio-names";
import { EmptyState, PageHeader, TableShell, TBody, Td, Th } from "@/components/ui";

const HISTORY_LIMIT = 50;

function chipClass(active: boolean): string {
  return `rounded-lg px-3 py-1.5 font-mono text-xs transition-all duration-200 ease-brand outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
    active ? "bg-white/5 text-white" : "text-slate-muted hover:text-white"
  }`;
}

/** composedImagePath is stored as "data/posts/<account>/<file>" — the media route serves the rest. */
function mediaSrc(composedImagePath: string | null): string | null {
  return composedImagePath ? `/api/media/${composedImagePath.replace(/^data\/posts\//, "")}` : null;
}

function PreviewCell({ composedImagePath, permalink }: { composedImagePath: string | null; permalink: string | null }) {
  const src = mediaSrc(composedImagePath);
  const href = permalink ?? src;
  const media =
    !src ? (
      <span className="text-slate-muted">—</span>
    ) : /\.(mp4|mov)$/i.test(src) ? (
      <video
        src={src}
        poster={mediaSrc(composedImagePath?.replace(/-story\.mp4$/i, "-story-cover.jpg") ?? null) ?? undefined}
        controls
        preload="metadata"
        muted
        className="h-40 w-32 rounded-md border border-white/10 object-cover"
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- repo-served media, no next/image optimization wanted
      <img src={src} alt="composed post" className="h-20 w-16 rounded-md border border-white/10 object-cover" loading="lazy" />
    );
  if (!href) return media;
  return (
    <a href={href} target="_blank" rel="noreferrer" title="Open post" className="inline-block transition-opacity hover:opacity-80">
      {media}
    </a>
  );
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
    const audioTitles = await resolveAudioTitles(
      posts.map((p) => p.audioId).filter((id): id is string => Boolean(id)),
    );

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
                  <Th>Preview</Th>
                  <Th>Account</Th>
                  <Th>Template</Th>
                  <Th>Quote</Th>
                  <Th>Mode</Th>
                  <Th>Music</Th>
                  <Th>Status</Th>
                  <Th>When</Th>
                  <Th right>Detail</Th>
                </tr>
              </thead>
              <TBody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <Td>
                      <PreviewCell composedImagePath={post.composedImagePath} permalink={post.igPermalink} />
                    </Td>
                    <Td>{post.accountId}</Td>
                    <Td>{post.templateId}</Td>
                    <Td>
                      {post.quoteText ? (
                        <span
                          className="block max-w-72 font-mono text-xs leading-snug text-platinum line-clamp-3"
                          title={`${post.quoteText}${post.quoteAuthor ? `\n— ${post.quoteAuthor}` : ""}`}
                        >
                          {post.quoteText}
                          {post.quoteAuthor ? <span className="text-slate-muted"> — {post.quoteAuthor}</span> : null}
                        </span>
                      ) : (
                        <span className="text-slate-muted">—</span>
                      )}
                    </Td>
                    <Td>{post.mode}</Td>
                    <Td>
                      {post.audioId ? (
                        <span className="font-mono text-xs text-platinum" title={post.audioId}>
                          {audioTitles.get(post.audioId) ?? "—"}
                        </span>
                      ) : (
                        <span className="text-slate-muted">—</span>
                      )}
                    </Td>
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

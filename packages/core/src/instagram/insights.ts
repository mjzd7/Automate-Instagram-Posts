/**
 * IG Graph API v22 read surface for the dashboard's analytics page.
 * Field-level metrics (like_count/comments_count) ride on
 * instagram_business_basic; per-media reach/impressions would additionally
 * need instagram_business_read_insights and are fetched opportunistically.
 */

export interface MediaRow {
  id: string;
  caption?: string;
  mediaType: string;
  mediaProductType?: string;
  permalink?: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  reach?: number;
}

export type ReachMap = Record<string, number | null>;

/**
 * Per-media reach requires instagram_business_read_insights. Each media is
 * fetched independently and failures resolve to null (never reject the
 * whole batch): metric sets differ by type and older posts can be
 * out-of-window, so partial coverage is normal.
 */
export async function fetchReachForPosts(
  accessToken: string,
  posts: Pick<MediaRow, "id">[],
  fetchImpl: typeof fetch = fetch,
): Promise<ReachMap> {
  const entries = await Promise.all(
    posts.map(async (post): Promise<[string, number | null]> => {
      try {
        const body = await graphGet(`${post.id}/insights`, { metric: "reach", access_token: accessToken }, fetchImpl);
        const rows = (body.data ?? []) as Array<{ name: string; values?: Array<{ value?: number }> }>;
        const reachRow = rows.find((r) => r.name === "reach");
        const value = reachRow?.values?.[0]?.value;
        return [post.id, typeof value === "number" ? value : null];
      } catch {
        return [post.id, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}

export interface AccountOverview {
  followersCount: number | null;
  mediaCount: number | null;
  posts: MediaRow[];
}

const GRAPH = "https://graph.facebook.com/v22.0";

async function graphGet(path: string, params: Record<string, string>, fetchImpl: typeof fetch): Promise<Record<string, unknown>> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetchImpl(url.toString());
  const body = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(body.error?.message ?? `Graph API ${res.status} on ${path}`);
  }
  return body;
}

export async function fetchAccountOverview(
  accessToken: string,
  igUserId: string,
  fetchImpl: typeof fetch = fetch,
  postLimit = 12,
): Promise<AccountOverview> {
  const profile = await graphGet(
    igUserId,
    { fields: "followers_count,media_count", access_token: accessToken },
    fetchImpl,
  );

  type RawMedia = {
    id: string;
    caption?: string;
    media_type: string;
    media_product_type?: string;
    permalink?: string;
    timestamp: string;
    like_count?: number;
    comments_count?: number;
  };
  const mediaBody = await graphGet(
    `${igUserId}/media`,
    {
      fields: "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count",
      limit: String(postLimit),
      access_token: accessToken,
    },
    fetchImpl,
  );

  const rawMedia = (mediaBody.data ?? []) as RawMedia[];
  const posts: MediaRow[] = rawMedia.map((m) => ({
    id: m.id,
    caption: m.caption,
    mediaType: m.media_type,
    mediaProductType: m.media_product_type,
    permalink: m.permalink,
    timestamp: m.timestamp,
    likeCount: m.like_count ?? 0,
    commentsCount: m.comments_count ?? 0,
  }));

  const followers = typeof profile.followers_count === "number" ? profile.followers_count : null;
  const mediaTotal = typeof profile.media_count === "number" ? profile.media_count : null;
  return {
    followersCount: followers,
    mediaCount: mediaTotal,
    posts,
  };
}

/** Pure aggregation for stat blocks — unit-testable without network. */
export function summarizePosts(posts: Pick<MediaRow, "likeCount" | "commentsCount">[]): {
  totalLikes: number;
  totalComments: number;
  avgLikes: number;
  avgComments: number;
} {
  const n = posts.length;
  const totalLikes = posts.reduce((s, p) => s + p.likeCount, 0);
  const totalComments = posts.reduce((s, p) => s + p.commentsCount, 0);
  return {
    totalLikes,
    totalComments,
    avgLikes: n > 0 ? Math.round(totalLikes / n) : 0,
    avgComments: n > 0 ? Math.round(totalComments / n) : 0,
  };
}

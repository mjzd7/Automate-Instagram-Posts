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
  saved?: number;
  shares?: number;
  mediaUrl?: string;
  thumbnailUrl?: string;
}

export interface PostMetrics {
  reach: number | null;
  saved: number | null;
  shares: number | null;
}

/**
 * One Graph call per post fetches reach+saved+shares together (verified live
 * on v22: the combined metric list is accepted for reels and images alike).
 * Whole-call failures null all three for that post; a metric missing from the
 * response (e.g. shares on old posts) nulls just that one.
 */
export async function fetchPostMetrics(
  accessToken: string,
  posts: Pick<MediaRow, "id">[],
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, PostMetrics>> {
  const entries = await Promise.all(
    posts.map(async (post): Promise<[string, PostMetrics]> => {
      const empty: PostMetrics = { reach: null, saved: null, shares: null };
      try {
        const body = await graphGet(
          `${post.id}/insights`,
          { metric: "reach,saved,shares", access_token: accessToken },
          fetchImpl,
        );
        const rows = (body.data ?? []) as Array<{ name: string; values?: Array<{ value?: number }> }>;
        const pick = (name: string): number | null => {
          const value = rows.find((r) => r.name === name)?.values?.[0]?.value;
          return typeof value === "number" ? value : null;
        };
        return [post.id, { reach: pick("reach"), saved: pick("saved"), shares: pick("shares") }];
      } catch {
        return [post.id, empty];
      }
    }),
  );
  return Object.fromEntries(entries);
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
  const metrics = await fetchPostMetrics(accessToken, posts, fetchImpl);
  return Object.fromEntries(
    posts.map((post) => [post.id, metrics[post.id]?.reach ?? null]),
  );
}

export interface AccountOverview {
  followersCount: number | null;
  mediaCount: number | null;
  posts: MediaRow[];
}

export interface AccountInsights {
  /** Profile views for the most recent day (profile_views only accepts period=day on v22, verified live). */
  profileViews?: number | null;
  /** Website clicks for the most recent day — best-effort; null when the metric is unavailable. */
  websiteClicks?: number | null;
  /** Net follower change summed over the trailing 28 days of daily follower_count values. */
  followerDelta28d?: number | null;
}

/**
 * Account-level engagement extras. Each block degrades independently to
 * null/undefined: Meta gates these metrics inconsistently across API
 * versions (verified live on v22), and one rejection must not blank the rest.
 */
export async function fetchAccountInsights(
  accessToken: string,
  igUserId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AccountInsights> {
  const out: AccountInsights = {};

  try {
    const body = await graphGet(
      `${igUserId}/insights`,
      { metric: "profile_views", period: "day", metric_type: "total_value", access_token: accessToken },
      fetchImpl,
    );
    const rows = (body.data ?? []) as Array<{ name: string; total_value?: { value?: number } }>;
    const value = rows.find((r) => r.name === "profile_views")?.total_value?.value;
    out.profileViews = typeof value === "number" ? value : null;
  } catch {
    out.profileViews = null;
  }

  try {
    const body = await graphGet(
      `${igUserId}/insights`,
      { metric: "website_clicks", period: "day", metric_type: "total_value", access_token: accessToken },
      fetchImpl,
    );
    const rows = (body.data ?? []) as Array<{ name: string; total_value?: { value?: number } }>;
    const value = rows.find((r) => r.name === "website_clicks")?.total_value?.value;
    out.websiteClicks = typeof value === "number" ? value : null;
  } catch {
    out.websiteClicks = null;
  }

  try {
    const until = Math.floor(Date.now() / 1000);
    const since = until - 28 * 24 * 60 * 60;
    const body = await graphGet(
      `${igUserId}/insights`,
      { metric: "follower_count", period: "day", since: String(since), until: String(until), access_token: accessToken },
      fetchImpl,
    );
    const rows = (body.data ?? []) as Array<{ name: string; values?: Array<{ value?: number }> }>;
    const values = rows.find((r) => r.name === "follower_count")?.values ?? [];
    const sum = values.reduce((s, v) => s + (typeof v.value === "number" ? v.value : 0), 0);
    out.followerDelta28d = values.length > 0 ? sum : null;
  } catch {
    out.followerDelta28d = null;
  }

  return out;
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
    media_url?: string;
    thumbnail_url?: string;
  };
  const mediaBody = await graphGet(
    `${igUserId}/media`,
    {
      fields: "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,media_url,thumbnail_url",
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
    mediaUrl: m.media_url,
    thumbnailUrl: m.thumbnail_url,
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

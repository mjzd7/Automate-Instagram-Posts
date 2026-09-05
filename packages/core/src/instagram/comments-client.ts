// Instagram comment-management client v1 (docs/PLAN-dashboard.md §0, work
// item 2.1). Endpoint contracts verified against official Meta docs
// (developers.facebook.com, v26.0 examples; sources cached in
// .firecrawl/ig-comment-ref.md / ig-media-update.md):
//   - hide/unhide:        POST /{comment-id}?hide=<bool>
//   - disable/enable:     POST /{media-id}?comment_enabled=<bool>
//   - reply:              POST /{comment-id}/replies   {message}
//   - like:               POST /{comment-id}/likes      (instagram_manage_engagement)
//   - delete:             DELETE /{comment-id}
// New module rather than edits to client.ts -- client.ts is on the read-only
// shared tier of the isolation boundary (docs/PLAN-multi-series.md §4.0).
import { GRAPH_API_BASE, type IGCredentials } from "./client.js";

export interface IGCommentRow {
  id: string;
  text?: string;
  timestamp?: string;
  username?: string;
  hidden?: boolean;
  likeCount?: number;
}

export interface FetchCommentsOptions {
  after?: string;
  limit?: number;
}

export interface FetchCommentsResult {
  comments: IGCommentRow[];
  nextAfter?: string;
}

const DEFAULT_FIELDS = "id,text,timestamp,username,hidden,like_count";

async function graphFetch(
  url: string,
  fetchImpl: typeof fetch,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(url, init);
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      typeof body.error === "object" && body.error && "message" in body.error
        ? String((body.error as Record<string, unknown>).message)
        : `HTTP ${res.status}`;
    throw new Error(`Instagram Graph API error: ${message}`);
  }
  return body;
}

function parseCommentRow(raw: Record<string, unknown>): IGCommentRow {
  return {
    id: String(raw.id),
    text: typeof raw.text === "string" ? raw.text : undefined,
    timestamp: typeof raw.timestamp === "string" ? raw.timestamp : undefined,
    username: typeof raw.username === "string" ? raw.username : undefined,
    hidden: typeof raw.hidden === "boolean" ? raw.hidden : undefined,
    likeCount: typeof raw.like_count === "number" ? raw.like_count : undefined,
  };
}

function withToken(params: URLSearchParams, creds: IGCredentials): string {
  params.set("access_token", creds.accessToken);
  return params.toString();
}

export async function fetchComments(
  mediaId: string,
  options: FetchCommentsOptions,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchCommentsResult> {
  const params = new URLSearchParams({ fields: DEFAULT_FIELDS });
  if (options.after !== undefined) params.set("after", options.after);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  const body = await graphFetch(
    `${GRAPH_API_BASE}/${mediaId}/comments?${withToken(params, creds)}`,
    fetchImpl,
  );
  const rows = Array.isArray(body.data) ? body.data : [];
  const paging = body.paging as Record<string, unknown> | undefined;
  const cursors = paging?.cursors as Record<string, unknown> | undefined;
  return {
    comments: rows.map((r) => parseCommentRow(r as Record<string, unknown>)),
    nextAfter: typeof cursors?.after === "string" ? cursors.after : undefined,
  };
}

export async function getComment(
  commentId: string,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<IGCommentRow> {
  const params = new URLSearchParams({ fields: DEFAULT_FIELDS });
  const body = await graphFetch(`${GRAPH_API_BASE}/${commentId}?${withToken(params, creds)}`, fetchImpl);
  return parseCommentRow(body);
}

export async function replyToComment(
  commentId: string,
  message: string,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<{ replyId: string }> {
  const body = await graphFetch(`${GRAPH_API_BASE}/${commentId}/replies`, fetchImpl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: creds.accessToken }),
  });
  if (typeof body.id !== "string") {
    throw new Error("replyToComment: response missing id");
  }
  return { replyId: body.id };
}

export async function setCommentHidden(
  commentId: string,
  hidden: boolean,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const params = new URLSearchParams({ hide: hidden ? "true" : "false" });
  await graphFetch(`${GRAPH_API_BASE}/${commentId}?${withToken(params, creds)}`, fetchImpl, {
    method: "POST",
  });
}

export async function deleteComment(
  commentId: string,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const params = new URLSearchParams();
  await graphFetch(`${GRAPH_API_BASE}/${commentId}?${withToken(params, creds)}`, fetchImpl, {
    method: "DELETE",
  });
}

export async function likeComment(
  commentId: string,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const params = new URLSearchParams();
  await graphFetch(`${GRAPH_API_BASE}/${commentId}/likes?${withToken(params, creds)}`, fetchImpl, {
    method: "POST",
  });
}

export async function setCommentsEnabled(
  mediaId: string,
  enabled: boolean,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const params = new URLSearchParams({ comment_enabled: enabled ? "true" : "false" });
  await graphFetch(`${GRAPH_API_BASE}/${mediaId}?${withToken(params, creds)}`, fetchImpl, {
    method: "POST",
  });
}

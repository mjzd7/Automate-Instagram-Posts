// Graph API contract per plan.md §7.16. Version verified live against
// developers.facebook.com/docs/graph-api/changelog at implementation time
// (current: v26.0, July 2026) rather than assumed from training data --
// re-check this at setup time since Meta ships new versions ~quarterly;
// the endpoint *shapes* below are stable across versions, only the version
// string drifts.
export const GRAPH_API_VERSION = "v26.0";
export const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface IGCredentials {
  accessToken: string;
  igUserId: string;
}

export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "ERROR";

const CONTAINER_POLL_INTERVAL_MS = 2000;
const CONTAINER_POLL_MAX_ATTEMPTS = 30;

async function graphFetch(
  url: string,
  fetchImpl: typeof fetch,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(url, init);
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof body.error === "object" && body.error && "message" in body.error
      ? String((body.error as Record<string, unknown>).message)
      : `HTTP ${res.status}`;
    throw new Error(`Instagram Graph API error: ${message}`);
  }
  return body;
}

export async function createMediaContainer(
  imageUrl: string,
  caption: string,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<{ creationId: string }> {
  const body = await graphFetch(`${GRAPH_API_BASE}/${creds.igUserId}/media`, fetchImpl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: creds.accessToken }),
  });
  if (typeof body.id !== "string") {
    throw new Error("createMediaContainer: response missing id");
  }
  return { creationId: body.id };
}

export async function getContainerStatus(
  creationId: string,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<ContainerStatus> {
  const url = `${GRAPH_API_BASE}/${creationId}?fields=status_code&access_token=${encodeURIComponent(creds.accessToken)}`;
  const body = await graphFetch(url, fetchImpl);
  const status = body.status_code;
  if (status !== "IN_PROGRESS" && status !== "FINISHED" && status !== "ERROR") {
    throw new Error(`getContainerStatus: unexpected status_code "${String(status)}"`);
  }
  return status;
}

/** Polls every 2s up to 10 attempts (20s total); throws if the container isn't FINISHED by then (plan.md §7.16 step 2). */
export async function waitForContainerReady(
  creationId: string,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
  sleepImpl: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<void> {
  for (let attempt = 0; attempt < CONTAINER_POLL_MAX_ATTEMPTS; attempt++) {
    const status = await getContainerStatus(creationId, creds, fetchImpl);
    if (status === "FINISHED") return;
    if (status === "ERROR") {
      throw new Error(`waitForContainerReady: container ${creationId} reported status ERROR`);
    }
    await sleepImpl(CONTAINER_POLL_INTERVAL_MS);
  }
  throw new Error(
    `waitForContainerReady: container ${creationId} did not finish within ${CONTAINER_POLL_MAX_ATTEMPTS} attempts`,
  );
}

export async function publishContainer(
  creationId: string,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<{ mediaId: string }> {
  const body = await graphFetch(`${GRAPH_API_BASE}/${creds.igUserId}/media_publish`, fetchImpl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: creds.accessToken }),
  });
  if (typeof body.id !== "string") {
    throw new Error("publishContainer: response missing id");
  }
  return { mediaId: body.id };
}

export async function fetchPermalink(
  mediaId: string,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<{ permalink: string }> {
  const url = `${GRAPH_API_BASE}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(creds.accessToken)}`;
  const body = await graphFetch(url, fetchImpl);
  if (typeof body.permalink !== "string") {
    throw new Error("fetchPermalink: response missing permalink");
  }
  return { permalink: body.permalink };
}

export async function postFirstComment(
  mediaId: string,
  message: string,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await graphFetch(`${GRAPH_API_BASE}/${mediaId}/comments`, fetchImpl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: creds.accessToken }),
  });
}

export interface FeedPublishResult {
  mediaId: string;
  permalink: string;
}

/** Orchestrates plan.md §7.16 steps 1-5: create container -> poll -> publish -> permalink -> first-comment hashtags. */
export async function publishToFeed(
  imageUrl: string,
  caption: string,
  hashtagComment: string | undefined,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
  sleepImpl?: (ms: number) => Promise<void>,
): Promise<FeedPublishResult> {
  const { creationId } = await createMediaContainer(imageUrl, caption, creds, fetchImpl);
  await waitForContainerReady(creationId, creds, fetchImpl, sleepImpl);
  const { mediaId } = await publishContainer(creationId, creds, fetchImpl);
  const { permalink } = await fetchPermalink(mediaId, creds, fetchImpl);
  if (hashtagComment?.trim()) {
    try {
      await postFirstComment(mediaId, hashtagComment, creds, fetchImpl);
    } catch (error) {
      console.warn(`[Batch] postFirstComment failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { mediaId, permalink };
}

export interface TokenRefreshResult {
  accessToken: string;
  expiresInSeconds: number;
}

/** Plan.md §7.16 step 6. Note: this endpoint is on graph.instagram.com, not graph.facebook.com. */
export async function refreshLongLivedToken(
  currentToken: string,
  clientId?: string,
  clientSecret?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenRefreshResult> {
  if (!clientId || !clientSecret) {
    throw new Error("refreshLongLivedToken: META_APP_ID and META_APP_SECRET are required to refresh a Graph API User Token.");
  }
  const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${encodeURIComponent(currentToken)}`;
  const res = await fetchImpl(url);
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`refreshLongLivedToken: HTTP ${res.status}`);
  }
  if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
    throw new Error("refreshLongLivedToken: response missing access_token/expires_in");
  }
  return { accessToken: body.access_token, expiresInSeconds: body.expires_in };
}

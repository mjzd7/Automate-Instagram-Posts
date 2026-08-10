// Threads API contract, verified live against
// developers.facebook.com/docs/threads/posts and .../troubleshooting at
// implementation time (not assumed from the plan's "unverified as of
// planning" note, and NOT the same shape as instagram/client.ts's polling
// despite both being Meta Graph API family):
//   - field name is "status" (IG Feed uses "status_code")
//   - extra states EXPIRED/PUBLISHED exist alongside IN_PROGRESS/FINISHED/ERROR
//   - recommended cadence is once per minute for up to 5 minutes, not
//     IG Feed's 2s/10-attempts
export const THREADS_API_VERSION = "v1.0";
export const THREADS_API_BASE = `https://graph.threads.net/${THREADS_API_VERSION}`;

export interface ThreadsCredentials {
  accessToken: string;
  threadsUserId: string;
}

export type ThreadsContainerStatus = "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";

const CONTAINER_POLL_INTERVAL_MS = 60_000;
const CONTAINER_POLL_MAX_ATTEMPTS = 5;

async function threadsFetch(
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
    throw new Error(`Threads API error: ${message}`);
  }
  return body;
}

export async function createThreadsContainer(
  imageUrl: string,
  text: string,
  creds: ThreadsCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<{ creationId: string }> {
  const body = await threadsFetch(`${THREADS_API_BASE}/${creds.threadsUserId}/threads`, fetchImpl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "IMAGE",
      image_url: imageUrl,
      text,
      access_token: creds.accessToken,
    }),
  });
  if (typeof body.id !== "string") {
    throw new Error("createThreadsContainer: response missing id");
  }
  return { creationId: body.id };
}

export async function getThreadsContainerStatus(
  creationId: string,
  creds: ThreadsCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: ThreadsContainerStatus; errorMessage?: string }> {
  const url = `${THREADS_API_BASE}/${creationId}?fields=status,error_message&access_token=${encodeURIComponent(creds.accessToken)}`;
  const body = await threadsFetch(url, fetchImpl);
  const status = body.status;
  if (
    status !== "IN_PROGRESS" &&
    status !== "FINISHED" &&
    status !== "ERROR" &&
    status !== "EXPIRED" &&
    status !== "PUBLISHED"
  ) {
    throw new Error(`getThreadsContainerStatus: unexpected status "${String(status)}"`);
  }
  return {
    status,
    errorMessage: typeof body.error_message === "string" ? body.error_message : undefined,
  };
}

/** Polls once/minute up to 5 attempts (5 min total) per Threads' documented recommendation -- distinct cadence from Instagram Feed's 2s/10-attempts. */
export async function waitForThreadsContainerReady(
  creationId: string,
  creds: ThreadsCredentials,
  fetchImpl: typeof fetch = fetch,
  sleepImpl: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<void> {
  for (let attempt = 0; attempt < CONTAINER_POLL_MAX_ATTEMPTS; attempt++) {
    const { status, errorMessage } = await getThreadsContainerStatus(creationId, creds, fetchImpl);
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(
        `waitForThreadsContainerReady: container ${creationId} reported status ${status}${errorMessage ? `: ${errorMessage}` : ""}`,
      );
    }
    await sleepImpl(CONTAINER_POLL_INTERVAL_MS);
  }
  throw new Error(
    `waitForThreadsContainerReady: container ${creationId} did not finish within ${CONTAINER_POLL_MAX_ATTEMPTS} attempts`,
  );
}

export async function publishThreadsContainer(
  creationId: string,
  creds: ThreadsCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<{ mediaId: string }> {
  const body = await threadsFetch(`${THREADS_API_BASE}/${creds.threadsUserId}/threads_publish`, fetchImpl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: creds.accessToken }),
  });
  if (typeof body.id !== "string") {
    throw new Error("publishThreadsContainer: response missing id");
  }
  return { mediaId: body.id };
}

/** Orchestrates create -> poll -> publish. Best-effort surface (pipeline treats a Threads failure as non-fatal, plan.md §7.19 step 4l) -- this still throws on failure, the caller decides how to degrade. */
export async function publishToThreads(
  imageUrl: string,
  text: string,
  creds: ThreadsCredentials,
  fetchImpl: typeof fetch = fetch,
  sleepImpl?: (ms: number) => Promise<void>,
): Promise<{ mediaId: string }> {
  const { creationId } = await createThreadsContainer(imageUrl, text, creds, fetchImpl);
  await waitForThreadsContainerReady(creationId, creds, fetchImpl, sleepImpl);
  return publishThreadsContainer(creationId, creds, fetchImpl);
}

export interface ThreadsTokenRefreshResult {
  accessToken: string;
  expiresInSeconds: number;
}

/**
 * Verified live against developers.facebook.com/docs/threads/get-started/long-lived-tokens.
 * Distinct grant_type from Instagram's refresh endpoint ("th_refresh_token"
 * vs "ig_refresh_token") though otherwise the same request/response shape.
 */
export async function refreshThreadsToken(
  currentToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ThreadsTokenRefreshResult> {
  const url = `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(currentToken)}`;
  const res = await fetchImpl(url);
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`refreshThreadsToken: HTTP ${res.status}`);
  }
  if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
    throw new Error("refreshThreadsToken: response missing access_token/expires_in");
  }
  return { accessToken: body.access_token, expiresInSeconds: body.expires_in };
}

import {
  GRAPH_API_BASE,
  waitForContainerReady,
  type IGCredentials,
} from "./client.js";

/**
 * Same container-create/publish pattern as client.ts's Feed flow (plan.md
 * §7.17), with media_type: "STORIES" added to the container-create body.
 * No caption/first-comment step -- Stories don't support comments the same
 * way. Best-effort surface (pipeline treats a Stories failure as non-fatal,
 * per plan.md §7.19 step 4k), so this throws on failure like everything
 * else -- the caller decides how to degrade, not this module.
 */
export async function publishToStories(
  imageUrl: string,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
  sleepImpl?: (ms: number) => Promise<void>,
): Promise<{ mediaId: string }> {
  const createRes = await fetchImpl(`${GRAPH_API_BASE}/${creds.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      media_type: "STORIES",
      access_token: creds.accessToken,
    }),
  });
  const createBody = (await createRes.json()) as Record<string, unknown>;
  if (!createRes.ok || typeof createBody.id !== "string") {
    const message =
      typeof createBody.error === "object" && createBody.error && "message" in createBody.error
        ? String((createBody.error as Record<string, unknown>).message)
        : `HTTP ${createRes.status}`;
    throw new Error(`publishToStories: container creation failed: ${message}`);
  }
  const creationId = createBody.id;

  await waitForContainerReady(creationId, creds, fetchImpl, sleepImpl);

  const publishRes = await fetchImpl(`${GRAPH_API_BASE}/${creds.igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: creds.accessToken }),
  });
  const publishBody = (await publishRes.json()) as Record<string, unknown>;
  if (!publishRes.ok || typeof publishBody.id !== "string") {
    throw new Error(`publishToStories: publish failed: HTTP ${publishRes.status}`);
  }

  return { mediaId: publishBody.id };
}

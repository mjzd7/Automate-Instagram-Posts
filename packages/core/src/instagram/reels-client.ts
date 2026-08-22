import {
  GRAPH_API_BASE,
  waitForContainerReady,
  type IGCredentials,
} from "./client.js";

/**
 * Creates and publishes an Instagram Reel container.
 * Reels require `media_type: "REELS"` and a `video_url`.
 */
export async function publishToReels(
  videoUrl: string,
  caption: string,
  creds: IGCredentials,
  fetchImpl: typeof fetch = fetch,
  sleepImpl?: (ms: number) => Promise<void>,
  options?: { coverUrl?: string },
): Promise<{ mediaId: string }> {
  const mediaBody: Record<string, unknown> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    access_token: creds.accessToken,
  };

  if (options?.coverUrl) {
    mediaBody.cover_url = options.coverUrl;
  }

  const createRes = await fetchImpl(`${GRAPH_API_BASE}/${creds.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mediaBody),
  });
  
  const createBody = (await createRes.json()) as Record<string, unknown>;
  if (!createRes.ok || typeof createBody.id !== "string") {
    const message =
      typeof createBody.error === "object" && createBody.error && "message" in createBody.error
        ? String((createBody.error as Record<string, unknown>).message)
        : `HTTP ${createRes.status}`;
    throw new Error(`publishToReels: container creation failed: ${message}`);
  }
  const creationId = createBody.id;

  // Reels can take longer to process than simple images
  await waitForContainerReady(creationId, creds, fetchImpl, sleepImpl);

  const publishRes = await fetchImpl(`${GRAPH_API_BASE}/${creds.igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: creds.accessToken }),
  });
  
  const publishBody = (await publishRes.json()) as Record<string, unknown>;
  if (!publishRes.ok || typeof publishBody.id !== "string") {
    throw new Error(`publishToReels: publish failed: HTTP ${publishRes.status}`);
  }

  return { mediaId: publishBody.id };
}

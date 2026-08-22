import {
  GRAPH_API_BASE,
  waitForContainerReady,
  type IGCredentials,
} from "./client.js";

export interface PublishToReelsOptions {
  coverUrl?: string;
  /**
   * Numeric audio ID of a licensed track from Meta's ig_audio catalog.
   * Without it Instagram labels the reel's audio as "Original audio" even
   * when the MP4 has a licensed track mixed in. Fallback-catalog placeholder
   * IDs (e.g. "fallback-mindset-01") must NOT be passed here -- guard with
   * a numeric check at the call site.
   */
  audioId?: string;
}

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
  options?: PublishToReelsOptions,
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

  if (options?.audioId) {
    mediaBody.audio_id = options.audioId;
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

import {
  GRAPH_API_BASE,
  waitForContainerReady,
  type IGCredentials,
} from "./client.js";

export interface PublishToReelsOptions {
  coverUrl?: string;
  /**
   * Numeric audio ID of a licensed track from Meta's ig_audio catalog
   * (audio_type=music). Sent via audio_configuration so the reel displays
   * the track's title/artist and is searchable under that music. Top-level
   * audio_id fields are silently ignored by the Graph API. Placeholder
   * fallback-catalog IDs must be filtered out by the caller (numeric check).
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

  // The MP4 must still CONTAIN an audio stream (silent videos fail with
  // error 2207082); video_volume: 0 mutes our embedded ghost mix so the
  // catalog track plays without double-playing the same song.
  if (options?.audioId) {
    mediaBody.audio_configuration = JSON.stringify({
      audio_id: options.audioId,
      audio_volume: 100,
      video_volume: 0,
    });
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

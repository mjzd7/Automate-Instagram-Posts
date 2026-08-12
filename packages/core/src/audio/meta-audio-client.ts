export interface MetaAudioTrack {
  audioId: string;
  title: string;
  displayArtist: string;
  durationMs: number;
  audioType: string;
  downloadUrl?: string;
  previewUrl?: string;
  isAdsEligible: boolean;
  category?: string;
}

export interface SearchMetaAudioOptions {
  igUserId: string;
  accessToken: string;
  query?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Queries Meta's Instagram Audio API (`/v22.0/ig_audio`) for commercial music assets.
 * Enforces `is_ads_eligible: true` filter to protect Business & Creator accounts from copyright mutes.
 */
export async function searchMetaAudioTracks(
  options: SearchMetaAudioOptions,
): Promise<MetaAudioTrack[]> {
  const { igUserId, accessToken, query } = options;
  const fetchImpl = options.fetchImpl ?? fetch;

  const url = new URL(`https://graph.facebook.com/v22.0/ig_audio`);
  url.searchParams.set("audio_type", "music");
  url.searchParams.set("user_id", igUserId);
  url.searchParams.set("access_token", accessToken);
  if (query) {
    url.searchParams.set("q", query);
  }

  try {
    const res = await fetchImpl(url.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return [];
    }

    const json = (await res.json()) as {
      audio?: Array<{
        audio_id?: string;
        title?: string;
        display_artist?: string;
        duration_in_ms?: number;
        audio_type?: string;
        download_url?: string;
        on_platform_audio_preview_link?: string;
        is_ads_eligible?: boolean;
      }>;
    };

    if (!json.audio || !Array.isArray(json.audio)) {
      return [];
    }

    const tracks: MetaAudioTrack[] = json.audio
      .filter((item) => item.audio_id && item.is_ads_eligible !== false)
      .map((item) => ({
        audioId: item.audio_id!,
        title: item.title ?? "Original Sound",
        displayArtist: item.display_artist ?? "Unknown Artist",
        durationMs: item.duration_in_ms ?? 180000,
        audioType: item.audio_type ?? "music",
        downloadUrl: item.download_url,
        previewUrl: item.on_platform_audio_preview_link,
        isAdsEligible: item.is_ads_eligible ?? true,
      }));

    return tracks;
  } catch {
    return [];
  }
}

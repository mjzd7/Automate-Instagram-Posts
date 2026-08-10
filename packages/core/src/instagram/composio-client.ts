export interface PublishViaComposioOptions {
  imageUrl: string;
  caption: string;
  apiKey: string;
  entityId?: string;
  fetchImpl?: typeof fetch;
}

export interface ComposioPublishResult {
  mediaId: string;
  permalink?: string;
}

/**
  Publishes an image post to Instagram via Composio's managed API / tool execution.
  This allows posting without manually managing Meta Graph API tokens or App IDs.
 */
export async function publishViaComposio(
  options: PublishViaComposioOptions,
): Promise<ComposioPublishResult> {
  const { imageUrl, caption, apiKey, entityId = "default" } = options;
  const fetchImpl = options.fetchImpl ?? fetch;

  const res = await fetchImpl("https://backend.composio.dev/api/v1/actions/INSTAGRAM_CREATE_POST/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      entity_id: entityId,
      appName: "instagram",
      input: {
        image_url: imageUrl,
        caption,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Composio API error (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as {
    data?: {
      id?: string;
      media_id?: string;
      permalink?: string;
    };
    error?: string;
  };

  if (data.error) {
    throw new Error(`Composio Instagram execution failed: ${data.error}`);
  }

  const mediaId = data.data?.media_id ?? data.data?.id ?? `composio-${Date.now()}`;
  return {
    mediaId,
    permalink: data.data?.permalink,
  };
}

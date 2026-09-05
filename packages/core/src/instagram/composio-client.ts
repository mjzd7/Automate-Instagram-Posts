export interface PublishViaComposioOptions {
  imageUrl: string;
  caption: string;
  apiKey: string;
  entityId?: string;
  igUserId?: string;
  fetchImpl?: typeof fetch;
  coverUrl?: string;
  /**
   * Numeric audio ID from Meta's ig_audio catalog (see publishToReels).
   * Fallback-catalog placeholder IDs must be filtered out by the caller.
   */
  audioId?: string;
}

export interface ComposioPublishResult {
  mediaId: string;
  permalink?: string;
}

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Publishes an image post to Instagram via Composio's runtime or v3.1 tool execution.
 * 1. Creates a media container with the image URL & caption
 * 2. Publishes the container to the connected Instagram feed
 */
export async function publishViaComposio(
  options: PublishViaComposioOptions,
): Promise<ComposioPublishResult> {
  const { imageUrl, caption, apiKey, entityId = "default" } = options;

  // Use CLI runtime if no custom fetchImpl is provided and local CLI exists
  if (!options.fetchImpl) {
    const composioBin = process.env.COMPOSIO_BIN ?? `${process.env.HOME}/.composio/composio`;
    try {
    const script = `
      const container = await execute("INSTAGRAM_CREATE_MEDIA_CONTAINER", {
        image_url: ${JSON.stringify(imageUrl)},
        caption: ${JSON.stringify(caption)}
      });
      if (!container.data?.id) throw new Error("Failed to create container: " + JSON.stringify(container));
      const user = await execute("INSTAGRAM_GET_USER_INFO", {});
      const igUserId = user.data?.id;
      const published = await execute("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", {
        ig_user_id: igUserId,
        creation_id: container.data.id
      });
      if (!published.data?.id) throw new Error("Failed to publish container: " + JSON.stringify(published));
      const media = await execute("INSTAGRAM_GET_USER_MEDIA", {
        ig_user_id: igUserId,
        limit: 1
      });
      const permalink = media.data?.data?.[0]?.permalink;
      console.log(JSON.stringify({ mediaId: published.data.id, permalink }));
    `;

    const { stdout } = await execFileAsync(composioBin, ["run", script], {
      timeout: 60000,
    });

    const lines = stdout.trim().split("\n");
    const lastLine = lines[lines.length - 1] ?? "";
    if (lastLine) {
      const parsed = JSON.parse(lastLine) as { mediaId: string; permalink?: string };
      if (parsed.mediaId) {
        return parsed;
      }
    }
  } catch {
    // Fall back to direct HTTP tool execution
  }
}

  const fetchImpl = options.fetchImpl ?? fetch;

  // Step 1: Create Media Container
  const createRes = await fetchImpl(
    "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_CREATE_MEDIA_CONTAINER",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        entity_id: entityId,
        user_id: entityId,
        arguments: {
          image_url: imageUrl,
          caption,
        },
      }),
    },
  );

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Composio create container error (${createRes.status}): ${errorText}`);
  }

  const createData = (await createRes.json()) as {
    data?: { id?: string; creation_id?: string };
    error?: string | { message?: string };
    successful?: boolean;
  };

  if (createData.error) {
    const errMsg = typeof createData.error === "object" ? createData.error.message : createData.error;
    throw new Error(`Composio create container failed: ${errMsg}`);
  }

  const creationId = createData.data?.id ?? createData.data?.creation_id;
  if (!creationId) {
    throw new Error("Composio response missing container ID");
  }

  // Small delay for Meta container ingest
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Fetch ig_user_id if not provided explicitly
  let targetIgUserId = options.igUserId;
  if (!targetIgUserId) {
    try {
      const userRes = await fetchImpl(
        "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_GET_USER_INFO",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            entity_id: entityId,
            user_id: entityId,
            arguments: {},
          }),
        },
      );
      if (userRes.ok) {
        const userData = (await userRes.json()) as { data?: { id?: string } };
        if (userData.data?.id) {
          targetIgUserId = userData.data.id;
        }
      }
    } catch {}
  }

  // Step 2: Publish Media Container
  const publishRes = await fetchImpl(
    "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        entity_id: entityId,
        user_id: entityId,
        arguments: {
          ig_user_id: targetIgUserId,
          creation_id: creationId,
        },
      }),
    },
  );

  if (!publishRes.ok) {
    const errorText = await publishRes.text();
    throw new Error(`Composio publish error (${publishRes.status}): ${errorText}`);
  }

  const publishData = (await publishRes.json()) as {
    data?: { id?: string; media_id?: string; permalink?: string };
    error?: string | { message?: string };
    successful?: boolean;
  };

  if (publishData.error) {
    const errMsg = typeof publishData.error === "object" ? publishData.error.message : publishData.error;
    throw new Error(`Composio publish failed: ${errMsg}`);
  }

  const mediaId = publishData.data?.id ?? publishData.data?.media_id ?? `composio-${Date.now()}`;
  return {
    mediaId,
    permalink: publishData.data?.permalink,
  };
}

/**
 * Cross-posts an image to Instagram Stories via Composio's v3.1 tool execution
 * using media_type: "STORIES".
 */
export async function publishViaComposioStories(
  options: PublishViaComposioOptions,
): Promise<ComposioPublishResult> {
  const { imageUrl, apiKey, entityId = "default" } = options;
  const fetchImpl = options.fetchImpl ?? fetch;

  const isVideo = imageUrl.includes(".mp4");
  const storyArgs: Record<string, unknown> = {
    media_type: "STORIES",
  };
  if (isVideo) {
    storyArgs.video_url = imageUrl;
    storyArgs.max_wait_seconds = 300;
  } else {
    storyArgs.image_url = imageUrl;
  }

  const createRes = await fetchImpl(
    "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_CREATE_MEDIA_CONTAINER",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(360000),
      body: JSON.stringify({
        entity_id: entityId,
        user_id: entityId,
        arguments: storyArgs,
      }),
    },
  );

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Composio create story container error (${createRes.status}): ${errorText}`);
  }

  const createData = (await createRes.json()) as {
    data?: { id?: string; creation_id?: string };
    error?: string | { message?: string };
  };

  if (createData.error) {
    const errMsg = typeof createData.error === "object" ? createData.error.message : createData.error;
    throw new Error(`Composio create story container failed: ${errMsg}`);
  }

  const creationId = createData.data?.id ?? createData.data?.creation_id;
  if (!creationId) {
    throw new Error("Composio response missing story container ID");
  }

  // Delay for Meta video container ingest (video containers require longer processing time)
  await new Promise((resolve) => setTimeout(resolve, isVideo ? 10000 : 3000));

  let targetIgUserId = options.igUserId;
  if (!targetIgUserId) {
    try {
      const userRes = await fetchImpl(
        "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_GET_USER_INFO",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            entity_id: entityId,
            user_id: entityId,
            arguments: {},
          }),
        },
      );
      if (userRes.ok) {
        const userData = (await userRes.json()) as { data?: { id?: string } };
        if (userData.data?.id) {
          targetIgUserId = userData.data.id;
        }
      }
    } catch {}
  }

  const publishRes = await fetchImpl(
    "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(360000),
      body: JSON.stringify({
        entity_id: entityId,
        user_id: entityId,
        arguments: {
          ig_user_id: targetIgUserId,
          creation_id: creationId,
          max_wait_seconds: 300,
        },
      }),
    },
  );

  if (!publishRes.ok) {
    const errorText = await publishRes.text();
    throw new Error(`Composio publish story error (${publishRes.status}): ${errorText}`);
  }

  const publishData = (await publishRes.json()) as {
    data?: { id?: string; media_id?: string; permalink?: string };
    error?: string | { message?: string };
  };

  if (publishData.error) {
    const errMsg = typeof publishData.error === "object" ? publishData.error.message : publishData.error;
    throw new Error(`Composio publish story failed: ${errMsg}`);
  }

  const mediaId = publishData.data?.id ?? publishData.data?.media_id ?? `story-${Date.now()}`;
  return {
    mediaId,
    permalink: publishData.data?.permalink,
  };
}

/**
 * Publishes an MP4 video as a proper Instagram Reel via Composio's v3.1 tool execution.
 * Uses media_type: "REELS" — permanent post on the Reels tab, not an ephemeral 24h Story.
 */
export async function publishViaComposioReels(
  options: PublishViaComposioOptions,
): Promise<ComposioPublishResult> {
  const { imageUrl: videoUrl, caption, apiKey, entityId = "default" } = options;
  const fetchImpl = options.fetchImpl ?? fetch;

  const reelArgs: Record<string, unknown> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: true,
  };
  if (options.coverUrl) {
    reelArgs.cover_url = options.coverUrl;
  }
  if (options.audioId) {
    reelArgs.audio_id = options.audioId;
  }

  const createRes = await fetchImpl(
    "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_CREATE_MEDIA_CONTAINER",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(360000),
      body: JSON.stringify({
        entity_id: entityId,
        user_id: entityId,
        arguments: reelArgs,
      }),
    },
  );

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Composio create reel container error (${createRes.status}): ${errorText}`);
  }

  const createData = (await createRes.json()) as {
    data?: { id?: string; creation_id?: string };
    error?: string | { message?: string };
  };

  if (createData.error) {
    const errMsg = typeof createData.error === "object" ? createData.error.message : createData.error;
    throw new Error(`Composio create reel container failed: ${errMsg}`);
  }

  const creationId = createData.data?.id ?? createData.data?.creation_id;
  if (!creationId) {
    throw new Error("Composio reel response missing container ID");
  }

  // Reels require longer processing time for video ingest than images/stories
  await new Promise((resolve) => setTimeout(resolve, 15000));

  let targetIgUserId = options.igUserId;
  if (!targetIgUserId) {
    try {
      const userRes = await fetchImpl(
        "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_GET_USER_INFO",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            entity_id: entityId,
            user_id: entityId,
            arguments: {},
          }),
        },
      );
      if (userRes.ok) {
        const userData = (await userRes.json()) as { data?: { id?: string } };
        if (userData.data?.id) {
          targetIgUserId = userData.data.id;
        }
      }
    } catch {}
  }

  const publishRes = await fetchImpl(
    "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(360000),
      body: JSON.stringify({
        entity_id: entityId,
        user_id: entityId,
        arguments: {
          ig_user_id: targetIgUserId,
          creation_id: creationId,
        },
      }),
    },
  );

  if (!publishRes.ok) {
    const errorText = await publishRes.text();
    throw new Error(`Composio publish reel error (${publishRes.status}): ${errorText}`);
  }

  const publishData = (await publishRes.json()) as {
    data?: { id?: string; media_id?: string; permalink?: string };
    error?: string | { message?: string };
  };

  if (publishData.error) {
    const errMsg = typeof publishData.error === "object" ? publishData.error.message : publishData.error;
    throw new Error(`Composio publish reel failed: ${errMsg}`);
  }

  const mediaId = publishData.data?.id ?? publishData.data?.media_id ?? `reel-${Date.now()}`;
  return {
    mediaId,
    permalink: publishData.data?.permalink,
  };
}

export interface PublishViaComposioCarouselOptions {
  imageUrls: string[];
  caption: string;
  apiKey: string;
  entityId?: string;
  igUserId?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Publishes a multi-slide carousel to Instagram feed via Composio's v3.1 tool execution.
 * 1. Creates a container for each image item with is_carousel_item: true
 * 2. Creates the parent CAROUSEL container referencing children item IDs
 * 3. Publishes the carousel container
 */
export async function publishViaComposioCarousel(
  options: PublishViaComposioCarouselOptions,
): Promise<ComposioPublishResult> {
  const { imageUrls, caption, apiKey, entityId = "default" } = options;
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    throw new Error(`publishViaComposioCarousel: carousel must contain between 2 and 10 images (got ${imageUrls.length})`);
  }

  const fetchImpl = options.fetchImpl ?? fetch;

  // Step 1: Create Item Containers
  const childrenIds: string[] = [];
  for (const url of imageUrls) {
    const itemRes = await fetchImpl(
      "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_CREATE_MEDIA_CONTAINER",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          entity_id: entityId,
          user_id: entityId,
          arguments: {
            image_url: url,
            is_carousel_item: true,
          },
        }),
      },
    );

    if (!itemRes.ok) {
      const errorText = await itemRes.text();
      throw new Error(`Composio create carousel item error (${itemRes.status}): ${errorText}`);
    }

    const itemData = (await itemRes.json()) as {
      data?: { id?: string; creation_id?: string };
      error?: string | { message?: string };
    };

    if (itemData.error) {
      const errMsg = typeof itemData.error === "object" ? itemData.error.message : itemData.error;
      throw new Error(`Composio create carousel item failed: ${errMsg}`);
    }

    const childId = itemData.data?.id ?? itemData.data?.creation_id;
    if (!childId) {
      throw new Error("Composio response missing carousel item container ID");
    }
    childrenIds.push(childId);
  }

  // Brief delay for Meta container processing
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Step 2: Create Parent Carousel Container
  const carouselRes = await fetchImpl(
    "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_CREATE_MEDIA_CONTAINER",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        entity_id: entityId,
        user_id: entityId,
        arguments: {
          media_type: "CAROUSEL",
          children: childrenIds,
          caption,
        },
      }),
    },
  );

  if (!carouselRes.ok) {
    const errorText = await carouselRes.text();
    throw new Error(`Composio create carousel container error (${carouselRes.status}): ${errorText}`);
  }

  const carouselData = (await carouselRes.json()) as {
    data?: { id?: string; creation_id?: string };
    error?: string | { message?: string };
  };

  if (carouselData.error) {
    const errMsg = typeof carouselData.error === "object" ? carouselData.error.message : carouselData.error;
    throw new Error(`Composio create carousel container failed: ${errMsg}`);
  }

  const carouselCreationId = carouselData.data?.id ?? carouselData.data?.creation_id;
  if (!carouselCreationId) {
    throw new Error("Composio response missing carousel container ID");
  }

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Fetch ig_user_id if not provided
  let targetIgUserId = options.igUserId;
  if (!targetIgUserId) {
    try {
      const userRes = await fetchImpl(
        "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_GET_USER_INFO",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            entity_id: entityId,
            user_id: entityId,
            arguments: {},
          }),
        },
      );
      if (userRes.ok) {
        const userData = (await userRes.json()) as { data?: { id?: string } };
        if (userData.data?.id) {
          targetIgUserId = userData.data.id;
        }
      }
    } catch {}
  }

  // Step 3: Publish Carousel
  const publishRes = await fetchImpl(
    "https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        entity_id: entityId,
        user_id: entityId,
        arguments: {
          ig_user_id: targetIgUserId,
          creation_id: carouselCreationId,
        },
      }),
    },
  );

  if (!publishRes.ok) {
    const errorText = await publishRes.text();
    throw new Error(`Composio publish carousel error (${publishRes.status}): ${errorText}`);
  }

  const publishData = (await publishRes.json()) as {
    data?: { id?: string; media_id?: string; permalink?: string };
    error?: string | { message?: string };
  };

  if (publishData.error) {
    const errMsg = typeof publishData.error === "object" ? publishData.error.message : publishData.error;
    throw new Error(`Composio publish carousel failed: ${errMsg}`);
  }

  const mediaId = publishData.data?.id ?? publishData.data?.media_id ?? `carousel-${Date.now()}`;
  return {
    mediaId,
    permalink: publishData.data?.permalink,
  };
}

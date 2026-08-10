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
  } catch (_cliErr) {
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

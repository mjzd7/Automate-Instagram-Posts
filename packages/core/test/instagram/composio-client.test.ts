import { describe, expect, it, vi } from "vitest";
import { publishViaComposio } from "../../src/instagram/composio-client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("publishViaComposio", () => {
  it("creates media container and publishes via Composio v3.1 tools", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { id: "container-999" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: {
            id: "comp-media-123",
            permalink: "https://instagram.com/p/C123456/",
          },
        }),
      );

    const result = await publishViaComposio({
      imageUrl: "https://example.com/quote.jpg",
      caption: "Inspiring quote #motivation",
      apiKey: "test-composio-key",
      fetchImpl,
    });

    expect(result).toEqual({
      mediaId: "comp-media-123",
      permalink: "https://instagram.com/p/C123456/",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url1, init1] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url1).toBe("https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_CREATE_MEDIA_CONTAINER");
    expect(init1.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-api-key": "test-composio-key",
    });

    const [url2, init2] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(url2).toBe("https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH");
  });

  it("throws clear error message when Composio returns a non-200 response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: "Invalid Composio API key" }));

    await expect(
      publishViaComposio({
        imageUrl: "https://example.com/quote.jpg",
        caption: "Test",
        apiKey: "bad-key",
        fetchImpl,
      }),
    ).rejects.toThrow("Composio create container error (401)");
  });
});

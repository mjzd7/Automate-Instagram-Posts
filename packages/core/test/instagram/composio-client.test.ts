import { describe, expect, it, vi } from "vitest";
import { publishViaComposio } from "../../src/instagram/composio-client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("publishViaComposio", () => {
  it("sends request to Composio API and returns mediaId and permalink on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
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

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://backend.composio.dev/api/v1/actions/INSTAGRAM_CREATE_POST/execute");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-api-key": "test-composio-key",
    });

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      entity_id: "default",
      appName: "instagram",
      input: {
        image_url: "https://example.com/quote.jpg",
        caption: "Inspiring quote #motivation",
      },
    });
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
    ).rejects.toThrow("Composio API error (401)");
  });
});

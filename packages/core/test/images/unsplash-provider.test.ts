import { describe, expect, it, vi } from "vitest";
import { fetchUnsplashPhoto } from "../../src/images/unsplash-provider.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("fetchUnsplashPhoto", () => {
  it("sends the Authorization: Client-ID header and parses the response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: "photo-1",
        urls: { regular: "https://images.unsplash.com/photo-1" },
        description: "A calm ocean",
        user: { name: "Jane Doe" },
      }),
    );
    const result = await fetchUnsplashPhoto("ocean", "my-key", fetchImpl);
    expect(result).toEqual({
      id: "photo-1",
      url: "https://images.unsplash.com/photo-1",
      description: "A calm ocean",
      attribution: "Photo by Jane Doe on Unsplash",
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("query=ocean");
    expect((init.headers as Record<string, string>).Authorization).toBe("Client-ID my-key");
  });

  it("falls back to alt_description when description is null", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: "p1",
        urls: { regular: "https://x/img" },
        description: null,
        alt_description: "mountains at dusk",
        user: { name: "A" },
      }),
    );
    const result = await fetchUnsplashPhoto("mountains", "key", fetchImpl);
    expect(result.description).toBe("mountains at dusk");
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, {}));
    await expect(fetchUnsplashPhoto("q", "bad-key", fetchImpl)).rejects.toThrow(/401/);
  });

  it("throws when urls.regular is missing (edge case: unexpected shape)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "p1", urls: {} }));
    await expect(fetchUnsplashPhoto("q", "key", fetchImpl)).rejects.toThrow(/missing id\/urls/);
  });
});

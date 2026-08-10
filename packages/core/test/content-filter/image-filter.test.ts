import { describe, expect, it, vi } from "vitest";
import { imagePassesFilter } from "../../src/content-filter/image-filter.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Helper: build a full Vision API response with both safeSearch + labels */
function visionResponse(
  safeSearch: { adult?: string; violence?: string; racy?: string },
  labels: Array<{ description: string; score: number }> = [],
): Response {
  return jsonResponse(200, {
    responses: [{ safeSearchAnnotation: safeSearch, labelAnnotations: labels }],
  });
}

describe("imagePassesFilter", () => {
  // ─── Stage 1: SafeSearch (existing behaviour, unchanged) ──────────────────
  it("passes an image with all UNLIKELY levels", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      visionResponse({ adult: "VERY_UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" }),
    );
    const result = await imagePassesFilter("https://example.com/img.jpg", "key", fetchImpl);
    expect(result.passes).toBe(true);
  });

  it("rejects an image with LIKELY adult content", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      visionResponse({ adult: "LIKELY", violence: "UNLIKELY", racy: "UNLIKELY" }),
    );
    const result = await imagePassesFilter("https://example.com/img.jpg", "key", fetchImpl);
    expect(result.passes).toBe(false);
  });

  it("rejects an image with VERY_LIKELY violence", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      visionResponse({ adult: "UNLIKELY", violence: "VERY_LIKELY", racy: "UNLIKELY" }),
    );
    const result = await imagePassesFilter("https://example.com/img.jpg", "key", fetchImpl);
    expect(result.passes).toBe(false);
  });

  it("passes POSSIBLE levels (below the LIKELY/VERY_LIKELY reject threshold)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      visionResponse({ adult: "POSSIBLE", violence: "UNLIKELY", racy: "UNLIKELY" }),
    );
    const result = await imagePassesFilter("https://example.com/img.jpg", "key", fetchImpl);
    expect(result.passes).toBe(true);
  });

  it("throws on a non-2xx response (external deps plane)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(403, {}));
    await expect(imagePassesFilter("https://example.com/img.jpg", "key", fetchImpl)).rejects.toThrow(
      /403/,
    );
  });

  it("throws on a malformed response body (edge case: unexpected shape)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { unexpected: true }));
    await expect(imagePassesFilter("https://example.com/img.jpg", "key", fetchImpl)).rejects.toThrow(
      /missing responses/,
    );
  });

  it("sends the API key as a query parameter and the image URL in the request body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      visionResponse({ adult: "UNLIKELY" }),
    );
    await imagePassesFilter("https://example.com/img.jpg", "my-key", fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("key=my-key");
    const body = JSON.parse(init.body as string);
    expect(body.requests[0].image.source.imageUri).toBe("https://example.com/img.jpg");
  });

  it("requests both SAFE_SEARCH_DETECTION and LABEL_DETECTION in a single call", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(visionResponse({ adult: "UNLIKELY" }));
    await imagePassesFilter("https://example.com/img.jpg", "key", fetchImpl);

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const featureTypes: string[] = body.requests[0].features.map((f: { type: string }) => f.type);
    expect(featureTypes).toContain("SAFE_SEARCH_DETECTION");
    expect(featureTypes).toContain("LABEL_DETECTION");
  });

  // ─── Stage 2a: Religious label blocklist ─────────────────────────────────
  it("rejects a Bible-page image (root cause of Post 5 regression)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      visionResponse(
        { adult: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" },
        [
          { description: "Text", score: 0.98 },
          { description: "Book", score: 0.95 },
          { description: "Bible", score: 0.92 },
          { description: "Scripture", score: 0.89 },
        ],
      ),
    );
    const result = await imagePassesFilter("https://example.com/bible.jpg", "key", fetchImpl);
    expect(result.passes).toBe(false);
    expect(result.rejectedLabels).toContain("Bible");
  });

  it("rejects an image labelled as Church or religious symbol", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      visionResponse(
        { adult: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" },
        [
          { description: "Church", score: 0.91 },
          { description: "Architecture", score: 0.85 },
        ],
      ),
    );
    const result = await imagePassesFilter("https://example.com/church.jpg", "key", fetchImpl);
    expect(result.passes).toBe(false);
    expect(result.rejectedLabels).toContain("Church");
  });

  it("rejects an image labelled Cross (crucifix)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      visionResponse(
        { adult: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" },
        [{ description: "Cross", score: 0.88 }],
      ),
    );
    const result = await imagePassesFilter("https://example.com/cross.jpg", "key", fetchImpl);
    expect(result.passes).toBe(false);
  });

  // ─── Stage 2b: Text-heavy label blocklist ────────────────────────────────
  it("rejects a tattoo-text image (root cause of Post 3 regression)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      visionResponse(
        { adult: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" },
        [
          { description: "Tattoo", score: 0.97 },
          { description: "Body art", score: 0.84 },
          { description: "Text", score: 0.76 },
        ],
      ),
    );
    const result = await imagePassesFilter("https://example.com/tattoo.jpg", "key", fetchImpl);
    expect(result.passes).toBe(false);
    expect(result.rejectedLabels).toContain("Tattoo");
  });

  it("rejects an open-book image dominated by printed text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      visionResponse(
        { adult: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" },
        [
          { description: "Open book", score: 0.93 },
          { description: "Text", score: 0.91 },
          { description: "Printed text", score: 0.88 },
        ],
      ),
    );
    const result = await imagePassesFilter("https://example.com/book.jpg", "key", fetchImpl);
    expect(result.passes).toBe(false);
    expect(result.rejectedLabels).toContain("Open book");
  });

  // ─── Confidence threshold: low-score labels must NOT trigger rejection ────
  it("ignores labels below the 0.6 confidence threshold", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      visionResponse(
        { adult: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" },
        [
          // "Bible" appears as a faint label at 0.32 — below threshold, must pass
          { description: "Bible", score: 0.32 },
          { description: "Nature", score: 0.91 },
          { description: "Forest", score: 0.87 },
        ],
      ),
    );
    const result = await imagePassesFilter("https://example.com/forest.jpg", "key", fetchImpl);
    expect(result.passes).toBe(true);
  });

  // ─── Non-blocking benign labels ──────────────────────────────────────────
  it("passes a clean nature photo with no blocked labels", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      visionResponse(
        { adult: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" },
        [
          { description: "Mountain", score: 0.97 },
          { description: "Sky", score: 0.95 },
          { description: "Nature", score: 0.93 },
          { description: "Landscape", score: 0.89 },
        ],
      ),
    );
    const result = await imagePassesFilter("https://example.com/mountain.jpg", "key", fetchImpl);
    expect(result.passes).toBe(true);
    expect(result.rejectedLabels).toHaveLength(0);
  });
});

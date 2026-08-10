import { describe, expect, it, vi } from "vitest";
import { fetchFromTypeFit } from "../../../src/quotes/fallback-providers/typefit.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("fetchFromTypeFit", () => {
  it("picks a random entry from the bulk array response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, [{ text: "Only one quote.", author: "Solo Author" }]),
    );
    const result = await fetchFromTypeFit("motivational", fetchImpl);
    expect(result).toEqual({ text: "Only one quote.", author: "Solo Author", source: "typefit" });
  });

  it("treats a null author as undefined (the real API returns null for anonymous quotes)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, [{ text: "Anonymous wisdom.", author: null }]));
    const result = await fetchFromTypeFit("motivational", fetchImpl);
    expect(result.author).toBeUndefined();
  });

  it("throws on an empty array (edge case)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, []));
    await expect(fetchFromTypeFit("motivational", fetchImpl)).rejects.toThrow(/empty array/);
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(503, {}));
    await expect(fetchFromTypeFit("motivational", fetchImpl)).rejects.toThrow(/503/);
  });
});

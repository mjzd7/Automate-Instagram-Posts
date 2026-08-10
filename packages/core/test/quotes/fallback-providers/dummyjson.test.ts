import { describe, expect, it, vi } from "vitest";
import { fetchFromDummyJson } from "../../../src/quotes/fallback-providers/dummyjson.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("fetchFromDummyJson", () => {
  it("parses the flat {quote, author} response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: 1, quote: "Be water.", author: "Bruce Lee" }));
    const result = await fetchFromDummyJson("motivational", fetchImpl);
    expect(result).toEqual({ text: "Be water.", author: "Bruce Lee", source: "dummyjson" });
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    await expect(fetchFromDummyJson("motivational", fetchImpl)).rejects.toThrow(/500/);
  });

  it("throws when the quote field is missing (edge case: unexpected shape)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: 1 }));
    await expect(fetchFromDummyJson("motivational", fetchImpl)).rejects.toThrow(/missing quote/);
  });
});

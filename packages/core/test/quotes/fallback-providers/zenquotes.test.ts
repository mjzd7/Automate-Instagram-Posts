import { describe, expect, it, vi } from "vitest";
import { fetchFromZenQuotes } from "../../../src/quotes/fallback-providers/zenquotes.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("fetchFromZenQuotes", () => {
  it("parses the q/a array response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, [{ q: "Stay hungry.", a: "Steve Jobs" }]));
    const result = await fetchFromZenQuotes("motivational", fetchImpl);
    expect(result).toEqual({ text: "Stay hungry.", author: "Steve Jobs", source: "zenquotes" });
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    await expect(fetchFromZenQuotes("motivational", fetchImpl)).rejects.toThrow(/500/);
  });

  it("throws on an empty array (edge case)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, []));
    await expect(fetchFromZenQuotes("motivational", fetchImpl)).rejects.toThrow(/missing quote/);
  });
});

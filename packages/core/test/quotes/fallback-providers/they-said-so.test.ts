import { describe, expect, it, vi } from "vitest";
import { fetchFromTheySaidSo } from "../../../src/quotes/fallback-providers/they-said-so.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("fetchFromTheySaidSo", () => {
  it("parses the nested contents.quotes[0] response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { contents: { quotes: [{ quote: "Just do it.", author: "Anon" }] } }),
    );
    const result = await fetchFromTheySaidSo("motivational", "secret", fetchImpl);
    expect(result).toEqual({ text: "Just do it.", author: "Anon", source: "they_said_so" });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("category=motivational");
    expect((init.headers as Record<string, string>)["X-TheySaidSo-Api-Secret"]).toBe("secret");
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { message: "Not authenticated" }));
    await expect(fetchFromTheySaidSo("motivational", "bad", fetchImpl)).rejects.toThrow(/401/);
  });

  it("throws when contents.quotes is missing (edge case: unexpected shape)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    await expect(fetchFromTheySaidSo("motivational", "secret", fetchImpl)).rejects.toThrow(
      /missing contents.quotes/,
    );
  });
});

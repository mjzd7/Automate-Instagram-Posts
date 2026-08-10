import { describe, expect, it, vi } from "vitest";
import { fetchFromApiNinjas } from "../../../src/quotes/fallback-providers/api-ninjas.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("fetchFromApiNinjas", () => {
  it("sends the category as a query param and the key as X-Api-Key header", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, [{ quote: "Discipline equals freedom.", author: "Jocko" }]));
    const result = await fetchFromApiNinjas("motivational", "my-key", fetchImpl);
    expect(result).toEqual({ text: "Discipline equals freedom.", author: "Jocko", source: "api_ninjas" });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("category=motivational");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("my-key");
  });

  it("throws on a non-2xx response (e.g. missing/invalid key)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: "Invalid API Key." }));
    await expect(fetchFromApiNinjas("motivational", "bad-key", fetchImpl)).rejects.toThrow(/401/);
  });

  it("throws on an empty array (edge case)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, []));
    await expect(fetchFromApiNinjas("motivational", "key", fetchImpl)).rejects.toThrow(/missing quote/);
  });
});

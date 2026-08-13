import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DbHandle } from "../../src/db/client.js";
import { insertQuote } from "../../src/db/repositories/quotes.repo.js";
import { categories, quotes } from "../../src/db/schema.js";
import { getNextQuote } from "../../src/quotes/provider.js";
import { eq } from "drizzle-orm";

let handle: DbHandle;

beforeEach(async () => {
  handle = await openDb(":memory:");
  await handle.db.insert(categories).values({ id: "motivational", name: "Motivational" });
});

afterEach(() => {
  handle.close();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Routes a mocked fetch by URL substring, since getNextQuote's fallback chain calls multiple distinct hosts in sequence. */
function routedFetch(routes: Record<string, () => Response>) {
  const impl: typeof fetch = (input) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [substring, respond] of Object.entries(routes)) {
      if (url.includes(substring)) return Promise.resolve(respond());
    }
    return Promise.resolve(jsonResponse(500, { error: "unmocked route" }));
  };
  return vi.fn(impl);
}

describe("getNextQuote", () => {
  it("returns a curated quote without touching any external provider", async () => {
    await insertQuote(handle.db, { id: "q1", text: "Discipline beats motivation.", categoryId: "motivational" });
    const fetchImpl = vi.fn();
    const result = await getNextQuote(handle.db, "acct1", "motivational", { fetchImpl });
    expect(result.id).toBe("q1");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls through to the first fallback provider (dummyjson) when the curated pool is empty", async () => {
    const fetchImpl = routedFetch({
      "dummyjson.com": () => jsonResponse(200, { quote: "From dummyjson.", author: "DJ" }),
    });
    const result = await getNextQuote(handle.db, "acct1", "motivational", { fetchImpl });
    expect(result.text).toBe("From dummyjson.");
  });

  it("inserts a fetched fallback quote into the curated pool with source set to the provider name", async () => {
    const fetchImpl = routedFetch({
      "dummyjson.com": () => jsonResponse(200, { quote: "From dummyjson.", author: "DJ" }),
    });
    const result = await getNextQuote(handle.db, "acct1", "motivational", { fetchImpl });
    const rows = await handle.db.select().from(quotes).where(eq(quotes.id, result.id));
    expect(rows[0]?.source).toBe("dummyjson");
  });

  it("falls through multiple providers in order when earlier ones fail", async () => {
    const fetchImpl = routedFetch({
      "dummyjson.com": () => jsonResponse(500, {}),
      "type.fit": () => jsonResponse(200, [{ text: "From typefit.", author: "TF" }]),
    });
    const result = await getNextQuote(handle.db, "acct1", "motivational", { fetchImpl });
    expect(result.text).toBe("From typefit.");
  });

  it("skips api-ninjas/they-said-so entirely when their keys are not configured", async () => {
    const fetchImpl = routedFetch({
      "dummyjson.com": () => jsonResponse(500, {}),
      "type.fit": () => jsonResponse(500, {}),
      "zenquotes.io": () => jsonResponse(200, [{ q: "From zenquotes.", a: "ZQ" }]),
    });
    const result = await getNextQuote(handle.db, "acct1", "motivational", { fetchImpl });
    expect(result.text).toBe("From zenquotes.");
    const calledUrls = fetchImpl.mock.calls.map((call) => call[0] as string);
    expect(calledUrls.some((url) => url.includes("api-ninjas"))).toBe(false);
    expect(calledUrls.some((url) => url.includes("theysaidso") || url.includes("quotes.rest"))).toBe(false);
  });

  it("skips a fallback quote that fails the content filter and tries the next provider", async () => {
    const fetchImpl = routedFetch({
      "dummyjson.com": () => jsonResponse(200, { quote: "This is such shit.", author: "Bad" }),
      "type.fit": () => jsonResponse(200, [{ text: "Clean quote here.", author: "Good" }]),
    });
    const result = await getNextQuote(handle.db, "acct1", "motivational", { fetchImpl });
    expect(result.text).toBe("Clean quote here.");
  });

  it("skips a fallback quote that fails the length filter and tries the next provider", async () => {
    const longQuote = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
    const fetchImpl = routedFetch({
      "dummyjson.com": () => jsonResponse(200, { quote: longQuote, author: "Long" }),
      "type.fit": () => jsonResponse(200, [{ text: "Short one.", author: "Short" }]),
    });
    const result = await getNextQuote(handle.db, "acct1", "motivational", { fetchImpl });
    expect(result.text).toBe("Short one.");
  });

  it("throws an aggregated error when every provider fails or is unconfigured", async () => {
    const fetchImpl = routedFetch({});
    await expect(getNextQuote(handle.db, "acct1", "motivational", { fetchImpl })).rejects.toThrow(
      /CRITICAL: Database has 0 active quotes/,
    );
  });

  it("attempts api-ninjas and they-said-so when keys ARE configured", async () => {
    const fetchImpl = routedFetch({
      "dummyjson.com": () => jsonResponse(500, {}),
      "type.fit": () => jsonResponse(500, {}),
      "zenquotes.io": () => jsonResponse(500, {}),
      "api-ninjas.com": () => jsonResponse(200, [{ quote: "From api ninjas.", author: "AN" }]),
    });
    const result = await getNextQuote(handle.db, "acct1", "motivational", {
      fetchImpl,
      apiNinjasKey: "key",
      theySaidSoKey: "secret",
    });
    expect(result.text).toBe("From api ninjas.");
  });
});

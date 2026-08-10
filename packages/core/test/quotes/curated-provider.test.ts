import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type DbHandle } from "../../src/db/client.js";
import { insertQuote } from "../../src/db/repositories/quotes.repo.js";
import { getCuratedQuote } from "../../src/quotes/curated-provider.js";
import { categories } from "../../src/db/schema.js";

let handle: DbHandle;

beforeEach(async () => {
  handle = await openDb(":memory:");
  await handle.db.insert(categories).values({ id: "motivational", name: "Motivational" });
});

afterEach(() => {
  handle.close();
});

describe("getCuratedQuote", () => {
  it("returns a clean, unused candidate", async () => {
    await insertQuote(handle.db, { id: "q1", text: "Discipline beats motivation.", categoryId: "motivational" });
    const result = await getCuratedQuote(handle.db, "acct1", "motivational");
    expect(result?.id).toBe("q1");
  });

  it("returns undefined when the category has no candidates at all (falls through to fallback chain)", async () => {
    const result = await getCuratedQuote(handle.db, "acct1", "motivational");
    expect(result).toBeUndefined();
  });

  it("skips a candidate that fails the content filter and returns the next clean one", async () => {
    await insertQuote(handle.db, { id: "q-bad", text: "This is such shit.", categoryId: "motivational" });
    await insertQuote(handle.db, { id: "q-good", text: "Stay the course.", categoryId: "motivational" });
    const result = await getCuratedQuote(handle.db, "acct1", "motivational", 5);
    expect(result?.id).toBe("q-good");
  });

  it("skips a candidate that fails the length filter (>25 words) and returns undefined if it was the only one (user directive: never truncate, find a shorter one instead)", async () => {
    const longQuote = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
    await insertQuote(handle.db, { id: "q-long", text: longQuote, categoryId: "motivational" });
    const result = await getCuratedQuote(handle.db, "acct1", "motivational", 5);
    expect(result).toBeUndefined();
  });

  it("skips an over-length candidate and returns a valid shorter one from the same batch", async () => {
    const longQuote = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
    await insertQuote(handle.db, { id: "q-long", text: longQuote, categoryId: "motivational" });
    await insertQuote(handle.db, { id: "q-short", text: "Short and sweet.", categoryId: "motivational" });
    const result = await getCuratedQuote(handle.db, "acct1", "motivational", 5);
    expect(result?.id).toBe("q-short");
  });

  it("skips candidates whose author contains religious honorifics or titles like (R.A)", async () => {
    await insertQuote(handle.db, {
      id: "q-rel",
      text: "The days of life pass away like clouds.",
      author: "Ali ibn Abi Talib (R.A)",
      categoryId: "motivational",
    });
    await insertQuote(handle.db, {
      id: "q-secular",
      text: "Discipline is destiny.",
      author: "Ryan Holiday",
      categoryId: "motivational",
    });
    const result = await getCuratedQuote(handle.db, "acct1", "motivational", 5);
    expect(result?.id).toBe("q-secular");
  });
});

import { describe, expect, it } from "vitest";
import { normalizeQuoteCapitalization } from "../../src/content-filter/capitalization-normalizer.js";

describe("normalizeQuoteCapitalization", () => {
  // ─── ALL CAPS → sentence case ─────────────────────────────────────────────
  it("converts ALL CAPS to sentence case", () => {
    expect(normalizeQuoteCapitalization("BELIEVE IN YOURSELF AND ALL THAT YOU ARE")).toBe(
      "Believe in yourself and all that you are",
    );
  });

  it("converts ALL CAPS short quote to sentence case (not title case)", () => {
    expect(normalizeQuoteCapitalization("JUST DO IT")).toBe("Just do it");
  });

  // ─── Apostrophe contraction fix (Can'T → can't) & Sentence Boundaries ───
  it("fixes API title-case apostrophe contractions: Can'T → can't and capitalizes after sentence boundary", () => {
    expect(
      normalizeQuoteCapitalization(
        "Success Is A Lousy Teacher. It Seduces Smart People Into Thinking They Can'T Lose.",
      ),
    ).toBe("Success is a lousy teacher. It seduces smart people into thinking they can't lose.");
  });

  it("fixes Won'T and Don'T contractions and capitalizes pronoun I", () => {
    expect(
      normalizeQuoteCapitalization("You Won'T Regret Trying But You'Ll Regret Not Trying. I Promise."),
    ).toBe("You won't regret trying but you'll regret not trying. I promise.");
  });

  it("capitalizes standalone pronoun I and multiple sentences", () => {
    expect(
      normalizeQuoteCapitalization("TELL ME AND I FORGET. TEACH ME AND I REMEMBER. INVOLVE ME AND I LEARN."),
    ).toBe("Tell me and I forget. Teach me and I remember. Involve me and I learn.");
  });

  // ─── API Title Case → sentence case for long quotes ───────────────────────
  it("converts long API title case (> 6 words) to sentence case", () => {
    expect(
      normalizeQuoteCapitalization("Failure Is A Detour, Not A Dead-End Street."),
    ).toBe("Failure is a detour, not a dead-end street.");
  });

  it("converts long API title case motivation quote to sentence case", () => {
    expect(
      normalizeQuoteCapitalization("The Only Way To Do Great Work Is To Love What You Do."),
    ).toBe("The only way to do great work is to love what you do.");
  });

  // ─── API Title Case → keep for short (≤ 6 words) quotes ───────────────────
  it("keeps API title case for short punchy quotes (≤ 6 words)", () => {
    // "Fate Is In Your Hands" = 5 words
    expect(normalizeQuoteCapitalization("Fate Is In Your Hands")).toBe(
      "Fate Is In Your Hands",
    );
  });

  it("keeps API title case for 6-word quote", () => {
    expect(normalizeQuoteCapitalization("Just Do It Every Single Day")).toBe(
      "Just Do It Every Single Day",
    );
  });

  // ─── Already sentence case → passthrough ──────────────────────────────────
  it("leaves already-sentence-cased quote unchanged", () => {
    const q = "The secret of getting ahead is getting started.";
    expect(normalizeQuoteCapitalization(q)).toBe(q);
  });

  it("preserves proper nouns in sentence-cased text", () => {
    const q = "Do unto others as you would have them do unto you.";
    expect(normalizeQuoteCapitalization(q)).toBe(q);
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────
  it("trims leading/trailing whitespace", () => {
    expect(normalizeQuoteCapitalization("  just do it  ")).toBe("Just do it");
  });

  it("handles single-word input without crashing", () => {
    expect(normalizeQuoteCapitalization("Perseverance")).toBe("Perseverance");
  });

  it("handles empty string", () => {
    expect(normalizeQuoteCapitalization("")).toBe("");
  });

  // ─── Real API examples from previous test run ─────────────────────────────
  it("real API example: Zig Ziglar quote (8 words, title case)", () => {
    expect(
      normalizeQuoteCapitalization("Failure Is A Detour, Not A Dead-End Street."),
    ).toBe("Failure is a detour, not a dead-end street.");
  });

  it("real API example: Byron Pulsifer quote (already sentence case)", () => {
    const q = "Fate is in your hands and no one elses";
    expect(normalizeQuoteCapitalization(q)).toBe(q);
  });
});

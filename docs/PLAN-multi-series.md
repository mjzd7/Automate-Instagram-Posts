# Multi-Series Content Automation Plan

> **Status**: Draft v2 (refined). Derived from an adversarial deep-dive of `prompts.md` + `prompt-results.md` against the pipeline architecture in `README.md`.
> **Scope**: ≥5 parallel content series on @success.for.sure, git-native, no hosted DB.
> **Maturity**: Planning artifact only — no code changed yet. When implementation starts, L1 gates (G1–G4) + §9 DoD apply per slice.

---

## 1. Bio rewrite (@success.for.sure)

Grounded in Result 1 (profile optimization): one clear promise, verifiable social proof beats "top 1%", searchable name field, CTA arrow must point somewhere real.

**Companion changes (required for any option):**

| Field | New value | Why |
|---|---|---|
| Name field (not username) | `Success For Sure \| Daily Motivation & Motivation & Mindset` ❌ → use **`Success For Sure \| Daily Motivation & Mindset`** | IG search indexes the *name* field; surfaces for "motivation"/"mindset" queries |
| Link-in-bio | Point 👇 at a real destination (Notion quote-pack page; later: Mindset Manual archive) | Current arrow leads nowhere — every visit without next step is lost |

**Bio options (IG limit: 150 chars total):**

- **A ✅ SELECTED (2026-08-22)** — value-forward, matches multi-series reality:
  ```
  Daily mindset tools, not just quotes ⚡
  Frameworks · discipline · honest talk 📈
  Join 2,900+ achievers 👇
  ```
  ≈105 chars. "Tools, not just quotes" differentiates from the 10M generic-quote accounts Result 3 warns about.

- **B (rejected)** — save-led variant; primes the saves behaviour the strategy targets:
  ```
  1 mindset shift in your feed daily 📈
  Frameworks you'll actually save 🔖
  2,900+ achievers levelling up 👇
  ```
  ≈100 chars.

- **C (rejected)** — voice-preserving variant; keeps current brand line, upgrades proof + promise:
  ```
  Grow through what you go through 📈
  Daily quotes + frameworks that get saved 🔖
  Join 2,900+ achievers 👇
  ```
  ≈107 chars.

All three drop "Join the top 1%" (unverifiable claim, flagged in Result 1) in favour of the real follower count.

---

## 2. Series roster

Each series traces to executed tactics in `prompt-results.md` — nothing invented from thin air.

| # | Series | Source tactic(s) | Signal driven | Form |
|---|---|---|---|---|
| S1 | **Mindset Manual #N** | R6.1 frameworks + R6.4 named/numbered collectible series | Saves | Carousel (weekly flagship) + single mini-card |
| S2 | **Hook Lab** | R2 hooks + usage tip ("hook IS cover text") | Views | Single card, hook-as-cover-text |
| S3 | **Confession Cards** | R3.1 specific pain, R3.3 first-person tone, R3.5 identity-flattering; absorbs R5.2 identity badge as Story-safe variant | Likes (+Story shares) | Single card |
| S4 | **Villain Roasts** | R5.4 gentle anti-villain roast + R5.1 accountability tag CTA | Shares | Single card + tag CTA footer |
| S5 | **Fill-the-Blank** | R4.2 blank-word card + R4.1 binary caption question | Comments | Single card with gap line |
| S6 | **Season Reset** | R3.4 emotional seasons scheduling | Relevance | Single card, calendar-keyed variant |
| S7 | Monthly Recap carousel | R6.5 | Archive/saves | **Deferred** — blocked on analytics (planned feature in README) |

---

## 3. Cadence grid v2 (post-bio-rewrite)

14 posts/week (2/day avg) — inside `POST_RATE_LIMIT=5`/24h hard cap, honours the rewritten "daily" promise, every ranking signal covered ≥1×/week.

| Day | Slot AM (~11:00 local) | Slot PM (~19:00 local) |
|---|---|---|
| Mon | Hook Lab | Confession Cards |
| Tue | Confession Cards | Fill-the-Blank |
| Wed | **Mindset Manual #N** (carousel) | Hook Lab |
| Thu | Confession Cards | Villain Roast |
| Fri | Hook Lab | Season Reset |
| Sat | Fill-the-Blank | Confession Cards |
| Sun | Season Reset (Sunday-dread variant) | Mindset Manual mini-card |

Weekly totals: Hook 3 · Confession 4 · Manual 2 · Blank 2 · Roast 1 · Season 2 = **14/wk**.

---

## 4. Architecture refinements

### 4.0 Isolation boundary (binding user constraint, 2026-08-22)

The **current posting pipeline is frozen** — no modifications to `pipeline/generate-and-publish-batch.ts`, existing templates, or any live posting path. The multi-series system is developed as a **separate module tree** that uses the current pipeline as a template by *copying* what it needs:

| Tier | Modules | Rule |
|---|---|---|
| **Shared (read-only imports)** | image primitives (`text-render`, `grain`, `scrim`, `glass-card`), background provider + Vision safety filter, IG/Threads clients, db client/schema/repos, crypto, `notify/discord`, duplicate detector | Import freely; **never edit** |
| **Copied & modified** (under `src/multi-series/`) | batch orchestrator ← copy of `generate-and-publish-batch.ts`; quote supply = content-pack loader (new); series templates (new namespace); CLI entry `scripts/run-series-batch.ts` | Free to diverge; zero imports FROM `pipeline/` orchestrator |
| **Untouched** | everything in the live posting path | No diff allowed |

Additive DB changes (Phase 0's nullable columns) are the only shared-surface touch and are behavior-neutral for the legacy pipeline.

### 4.1 Config/state split (git-native discipline)

- **Definitions** (versioned in repo): `data/series.json`
  ```json
  {
    "id": "mindset-manual",
    "name": "Mindset Manual",
    "templateIds": ["framework-carousel", "framework-mini"],
    "captionPromptRef": "captions/mindset-manual.txt",
    "hashtagCategory": "mindset",
    "slots": [{ "dayOfWeek": 3, "slot": "am" }, { "dayOfWeek": 0, "slot": "pm" }],
    "maxPerDay": 1,
    "active": true
  }
  ```
- **Runtime state** (SQLite): `series(id PK, counter INT, lastPostedAt)`; `posts.seriesId`, `posts.archetype` columns.
- Episode counters increment **only on approved+published post** — rejected drafts never burn a number.

### 4.2 Content packs (generated supply, committed as data)

Current pipeline *fetches* quotes; these series need *generated* content. Supply chain:

```
LLM batch script → Zod validate → moderation lint → dedupe check
  → status:"draft" in data/content-packs/<seriesId>/YYYY-MM.json
  → dashboard approval queue → status:"approved" → pipeline consumes
```

Pack item schema:

```json
{
  "id": "confession-2026-09-014",
  "seriesId": "confession",
  "archetype": null,
  "text": "Replaying that conversation from 2019 while running a 7-minute mile.",
  "captionQuestion": "Discipline or motivation — which dragged you through this week?",
  "utilityLine": "Try it today: name the task you're avoiding.",
  "ctaTag": null,
  "status": "draft",
  "generatedAt": "2026-08-22T00:00:00Z"
}
```

### 4.3 Per-series generation prompt contracts

| Series | Inputs | Output shape | Hard constraints |
|---|---|---|---|
| S1 Manual | theme list rotation | `{episodeNo?, title, steps[3–5], utilityLine}` | Title pattern `The N-N-N <name>` or numbered list; steps imperative ≤8 words |
| S2 Hook Lab | topic/quote | `{archetype, hookText}` | Archetype ∈ {controversy, stat, callout, negative, story-open}; ≤12 words; no archetype repeated within last 3 published |
| S3 Confession | pain-inventory pointer | `{text, badgeVariant?}` | First-person mandatory; ≥2 specificity markers (time/place/object/number); 90–160 chars; banned abstractions: "grind", "hustle", "dream big" |
| S4 Roast | villain inventory (doomscrolling, fake gurus, comfort zone, snooze button) | `{text, ctaTag}` | Punchline ≤100 chars; CTA from fixed set ("Send this to your accountability partner."); no named individuals/groups |
| S5 Blank | sentence stem | `{sentenceWithBlank, binaryQuestion}` | Exactly one `{{BLANK}}` token; ≤120 chars; gap must be comment-obvious |
| S6 Season | static calendar map (month→themes + Sunday-dread/Monday-reset keys) | inherits S3 constraints | Date-keyed at generation time; stale >7 days → discard |

Few-shot examples lifted verbatim from Results 2/3/5 — the file's own output is the quality bar.

### 4.4 Moderation lint (pre-approval gate, new lightweight module)

1. Financial/medical guarantee patterns (`guarantee`, `cure`, `get rich`, passive-income promises)
2. Self-harm/despair lexicon reject
3. Per-series length caps enforced
4. ALL-CAPS ratio <30% (exception: S2 stat archetype)
5. S4 target-safety: no individuals, demographics, or protected groups
6. Emoji policy: max 2 per card text

Google Vision background filtering unchanged — this gates generated *text* only.

### 4.5 Degradation policy (skip vs fall back)

| Pack state | Format-bound series (S1, S4, S5) | Generic-compatible (S2, S3, S6) |
|---|---|---|
| Approved items available | consume oldest approved | consume oldest approved |
| Empty/expired pack | **SKIP slot** + Discord warning — never substitute a random quote into a fixed format | Fall back to existing quote provider chain |

Rationale: filling "Mindset Manual #15" with a fetched Zenquotes aphorism destroys the format contract; a Hook Lab card can carry any quote.

### 4.6 Pipeline deltas

- **Templates**: 4 variants — framework-numbered layout (S1), hook-cover text-zone top-third (S2, reused by S6), prominent gap-line slot rendering `{{BLANK}}` as styled underscores through the normal fit-shrink loop (S5), roast/tag-CTA footer + Story-crop-safe margins for badge variants (S3/S4).
- **Duplicate detection**: extend embedding detector with per-series recency windows + cross-series n-gram check.
- **Utility line** (R6.3) becomes a template-level constant rendered under the quote across all series.
- **Caption generator**: binary question suffix (R4.1) injected for all series.
- **Dry-run**: `--series` flag emits one composed sample per series to `out/dry-run/` for visual QA before enabling anything.
- **Discord notifications**: include series name + episode number.
- **Dashboard**: series badge in review queue; group-by-series batch approve/reject.

### 4.7 Empirical Graph API Audit Calibration (2026-09-05)

Analysis of live account data (@success.for.sure, 168 published posts, 100 recent API media items) calibrates series visual and algorithmic execution:

1. **Serif & High-Contrast Typography Mandate**: `general-cormorant` achieved **31.4 avg views** (over 2x to 9x higher than sans/minimalist templates). Series templates must maintain strong serif or high-impact typography (`PlayfairDisplayBold`, `MontserratBold`, `Cormorant`) and high-contrast glass-cards across all modes.
2. **Preserve Signature Checkerboard Finish**: The account's alternating dark/light checkerboard grid pattern is strictly maintained on the feed. Rather than abandoning light mode, light-mode templates receive reinforced typography and higher-contrast scrims/cards so the aesthetic integrity of the 3-column checkerboard grid remains flawless.
3. **DM Shares as Viral Engine**: Posts with send-to-friend hooks (S4 Villain Roasts, S3 Confession Cards) target Instagram's primary ranking signal (DM sends).
4. **Hashtags Refinement**: High-performing niche tags (`#investing`, `#mindset`, `#wealth`, `#entrepreneur`) replace bloated low-conversion tags (`#success`, `#growth`).

---

## 5. Implementation phases

Sequencing note: **All Phase 1–3 code lives under `src/multi-series/` + `scripts/run-series-batch.ts` per §4.0 isolation.**

| Phase | Work | Status | Verification gate |
|---|---|---|---|
| **0** | `data/series.json` + Zod schema; DB migration (`series` table, `posts.seriesId/archetype`) | ✅ Completed | 14/14 new tests green; full suite 378/378 |
| **1a** | Content-pack loader (`src/multi-series/quotes/content-pack.ts`) — pack schema, approved-only filter, oldest-first consumption | ✅ Completed | Red-first tests: schema rejects, filtering, sort order |
| **1b** | Batch-generation script per series contract (§4.3) + moderation lint module — under `src/multi-series/` | ✅ Completed | Red-first lint rejection cases; Zod rejects malformed packs |
| **2a** | Series template variants in separate template registry (`src/multi-series/images/registry.ts`, `compose-series-card.ts`) | ✅ Completed | Dry-run composes all variants without `QuoteTruncatedError`; visual QA pass |
| **2b** | Series-aware orchestrator (`src/multi-series/pipeline/series-batch.ts`, `slot-scheduler.ts`) honoring cadence grid + rate caps | ✅ Completed | Full `pnpm test` green (531/531 tests passing) |
| **3** | Web dashboard series review & batch approval queue (`apps/web/app/(dashboard)/series/`); generate Month-1 packs (~30 posts); live canary run | 🟡 In Progress | End-to-end dry-run test passes; dashboard review actions operational |

---

## 6. Remaining Work to Launch & Test Series

1. **Generate Initial Content Packs**: Run `pnpm generate-pack` with active LLM key for each of the 6 series (`mindset-manual`, `hook-lab`, `confession-cards`, `villain-roasts`, `fill-the-blank`, `season-reset`).
2. **Review & Approve Items**: Use dashboard (`/series`) to approve generated draft cards.
3. **Schedule & Test Multi-Series Batch**: Run `scripts/run-series-batch.ts` in dry-run mode, verify composed 4:5 cards and 9:16 reels.
4. **Deploy Cron Trigger**: Enable scheduled execution for multi-series cadence grid.

---

## 7. Operational log

| Date | Finding | Disposition |
|---|---|---|
| 2026-08-22 | Hardcoded LLM model IDs rot at the provider's API surface (stale Gemini model reference → HTTP 404 on first real generation attempt; follow-up pin to another retired ID also 404'd). | Model name lives behind injectable adapter (default pinned to GA flash model). |
| 2026-09-05 | Live IG Graph API audit of 168 posts revealed `general-cormorant` (31.4 avg views) outperforming other templates by up to 9x, and dark mode outperforming light mode by 41%. | Calibrated multi-series template styling, dark-mode default, and wealth/mindset hashtag focus. |


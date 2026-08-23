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

---

## 5. Implementation phases

Sequencing note: Phases 1 and 2 parallelize once Phase 0 lands (pack generation doesn't depend on templates; templates don't depend on packs). **All Phase 1–3 code lives under `src/multi-series/` + `scripts/run-series-batch.ts` per §4.0 isolation.**

| Phase | Work | Verification gate |
|---|---|---|
| **0** ✅ | `data/series.json` + Zod schema; DB migration (`series` table, `posts.seriesId/archetype`) | 14/14 new tests green; full suite 378/378 |
| **1a** | Content-pack loader (`src/multi-series/quotes/content-pack.ts`) — pack schema, approved-only filter, oldest-first consumption | Red-first tests: schema rejects, filtering, sort order |
| **1b** | Batch-generation script per series contract (§4.3) + moderation lint module — under `src/multi-series/` | Red-first lint rejection cases; Zod rejects malformed packs |
| **2a** | Series template variants in separate template registry (`src/multi-series/images/templates.ts`) — copies of compositor assembly, not edits to it | Dry-run composes all 4 without `QuoteTruncatedError`; visual QA pass |
| **2b** | Series-aware orchestrator copy (`src/multi-series/pipeline/series-batch.ts` ← adapted from generate-and-publish-batch) honoring cadence grid + rate caps + skip-vs-fallback matrix | Full `pnpm test` green; rate-cap simulation test |
| **3** | CLI entry, Discord fields, dashboard badge + batch actions; generate Month-1 packs (~30 posts); human review; enable cron | End-to-end dry-run week, then live with approval queue active |

---

## 6. Open items

1. **FR-013 promotion** (logged in LEARNINGS.md): awaiting user approval to add model-routing rule to `docs/TOOLS.md` §3.
2. **Analytics dependency**: S7 Monthly Recap unblocks once post-metrics ingestion ships (README planned feature).
3. **Archetype analytics**: `posts.archetype` column collects data now so future A/B analysis is retroactive.
4. **Frozen-module model rot** (found 2026-08-22): shared `matching/visual-concept-extractor.ts` and `content-filter/text-filter.ts` still hardcode the retired Gemini model ID — their LLM paths will 404/degrade at runtime in the live pipeline too. Off-limits under §4.0 isolation; needs a user decision.

---

## 7. Operational log

| Date | Finding | Disposition |
|---|---|---|
| 2026-08-22 | Hardcoded LLM model IDs rot at the provider's API surface (stale Gemini model reference → HTTP 404 on first real generation attempt; follow-up pin to another retired ID also 404'd). Test suite cannot catch this by design — real-provider calls stay out of test scope, so breakage surfaces at generation time, not CI time. | Model name lives behind the injectable provider adapter (one-line swap, default now pinned to Google's advertised GA flash model). Month-1 pack generation is a manual ritual; when it fails, check model-ID freshness first. |

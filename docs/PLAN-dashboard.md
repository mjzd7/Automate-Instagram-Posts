# Instagram Account Management Dashboard — Refined Roadmap

> **Status**: APPROVED for Phase 1 (2026-08-25). Decisions D1–D5 locked, architecture locked (A+B mixed). Doc verification against official Meta docs completed via Firecrawl — sources cached in `.firecrawl/ig-*.md`.
> **Relationship to other plans**: builds on `docs/PLAN-multi-series.md` (series roster S1–S6, packs, cadence grid). Does NOT modify that plan's isolation boundary (§4.0) — the legacy posting path in `packages/core/src/pipeline/` stays frozen.
> **Maturity**: L1. Every slice ships with G1–G4 gates + §9 DoD per AGENTS.md.

---

## 0. Verified API facts (cross-checked against developers.facebook.com, v26.0 examples)

| Capability | Endpoint | Permission(s) | Notes |
|---|---|---|---|
| Get comments | `GET /{ig-media-id}/comments` | `instagram_manage_comments` | Docs recommend webhooks over polling to avoid rate limiting; GHA cron polling accepted at this scale (~dozens calls/day vs ~200/hr budget). Webhook receiver = documented upgrade path, still deferred. |
| Reply | `POST /{ig-comment-id}/replies` (`message`) | `instagram_manage_comments` | |
| Hide/unhide | `POST /{ig-comment-id}?hide=<bool>` | `instagram_manage_comments` | Owner-authored comments always display even when hidden → auto-hide rules must skip own replies. Hidden comments stay visible to their author. |
| Delete | `DELETE /{ig-comment-id}` | `instagram_manage_comments` | Only the post owner can delete — true on all owned media. Irreversible → hard confirm + audit log mandatory. |
| Like comment/media | like endpoints on comment & media objects | **`instagram_manage_engagement`** | Changelog: "Like Media and Comments API — The new instagram_manage_engagement permission is required." Roadmap originally missed this scope. |
| Disable/enable comments per post | `POST /{ig-media-id}?comment_enabled=<bool>`; readable via `is_comment_enabled` field | `instagram_manage_comments` | Confirms "disable-per-post" is feasible (earlier doubt resolved — feature exists). |
| Commenter `username` field | gated since 2024-08-27 | `instagram_manage_comments` | Inbox display depends on same scope as actions. |

**Token requirement**: one re-auth flow requesting `instagram_manage_comments` + `instagram_manage_engagement` (+ existing deps `instagram_basic`, `pages_read_engagement`, `pages_show_list`). Pre-flight before any live call: verify current long-lived token's granted scopes (App Dashboard or `/debug_token`). Code-level check of the OAuth grant list happens first.

## 1. Corrections register (roadmap vs code reality)

| # | Original claim | Reality | Consequence |
|---|---|---|---|
| C1 | "existing instagram_fetch_comments stub" | Doesn't exist. Only comment code: `postFirstComment()` (`packages/core/src/instagram/client.ts:116`, hashtag POST). | 2.1 is greenfield ("comment client v1"), not stub-completion. |
| C2 | "/api/preview-style child process" | Actual route: `apps/web/app/api/preview/route.ts`. | Naming fixed; 1.2 thumbnails must read its real contract first. |
| C3 | Counter derivable from series.json | Definitions in `data/series.json`; counters in SQLite `series` table (`schema.ts:31`), incremented only on published, pushed back by `post.yml`. | Series page joins two sources; counter UI labels freshness ("as of last run"). |
| C4 | 3.3 reel path framed as new build | Reels already publish (`post.yml` `single` input); `stories-client.ts` exists. | Phase 3 heavy path is mostly reuse. |
| C5 | dispatch plumbing implied new | `apps/web/lib/runner.ts` already dispatches workflows via `DASHBOARD_ACTIONS_PAT`. | Fast path rides existing pattern. |

## 2. Locked decisions

| Decision | Locked value |
|---|---|
| Architecture | **A+B mixed** — Vercel server actions call Graph directly for interactive comment ops (<1s UX); GHA workflow dispatch for reel/heavy post-now. Story/photo post-now decided at Phase 3 after Vercel function-limit check. |
| D1 auto-hide moderation | **OFF first (audit-only)**. Dry-run log view ships before cron enables. One-click unhide built BEFORE auto-hide flips on. Starter ruleset seeds from existing `multi-series/moderation/text-lint.ts` patterns. Delete never automatic. |
| D2 light-mode share | Yes ~20%, config-driven `lightShare` enforced in slot scheduler as deterministic rotation (not per-post randomness). Uses existing `posts.mode dark\|light` + `backgrounds.darkness` enum. |
| D3 post-now confirmation | Confirm dialog + Discord echo (echo carries permalink on success, error detail on failure). |
| D4 series toggles | Active/pause immediately (writes `data/series.json` via Contents-API writer), confirm-on-pause. |
| D5 brand | Keep "poster" internally; optional user-facing nav label rename only. |

## 3. Phases

### Phase 1 — Series surface + Pipeline as posts (IN PROGRESS)
| # | Work item | Acceptance |
|---|---|---|
| 1.1 | `/series` roster: name, signal (saves/views/comments/shares), weekly cadence grid, counter join (SQLite `series` + `data/series.json`) w/ freshness label, pack health (approved/draft counts from `data/content-packs/<id>/YYYY-MM.json`), active toggle round-trip via Contents-API writer | e2e: page renders 6 series; toggle writes JSON and reverts cleanly |
| 1.2 | Series drill-in `[seriesId]`: pack gallery w/ approval state, card thumbnails via `/api/preview` contract (verify route first), counter history | renders for all 6 series incl. empty-pack state |
| 1.3 | Pipeline = post cards not slots: thumbnail (today+tomorrow only), series badge, caption preview, "planned (not locked)" label; slot↔series-slots↔next-approved-item join at render time | chips resolve to concrete items for current week |
| 1.4 | History/Overview series badges | badges render from `posts.seriesId` |

Parallel batch: **1.1 ∥ 1.2 ∥ 2.1** (2.1 pulled forward from Phase 2 — zero deps, de-risks token scopes earliest).

### Phase 2 — Comment stack
2.1 client v1 (in progress) → 2.2 Inbox `/comments` (threads, reply/hide/delete/like/disable-per-post, "live from IG" label) → 2.3 inbox links from History/Analytics rows → 2.4 `data/moderation-rules.json` (dashboard-editable via writer, 409 re-read-retry) + GHA poll cron → hide matches → `data/moderation-log.json` + one-click unhide → 2.5 Discord new-comment alerts.
Gate: moderate real comments a few days before Phase 3.

### Phase 3 — Post-now
Core script `{mediaType: post|reel|story, source: pack-item\|ad-hoc, templateId?, background?}` → compose variants → publish → record row. Fast path (story/photo) via runner PAT dispatch; heavy (reel) via `workflow_dispatch` reuse of existing reel machinery (C4/C5). Compose form on Preview page.
Absorbed gaps: container-poll ERROR path + composed-but-unpublished partial states + retry idempotency (never double-post); post-now consumes `POST_RATE_LIMIT=5`/24h unless explicit override flag; caption length validation (2,200 chars); Discord echo carries permalink-or-error.

### Deferred (unchanged)
DMs/webhook receiver (design-only), media library, hashtag research, team flows, multi-account UI, impression metrics (v22+ gates).

## 4. Standing rules for every slice
- Isolation §4.0: never edit `packages/core/src/pipeline/*` legacy paths or shared read-only modules.
- No type suppression / empty catches / secret logging; no commits unless explicitly asked.
- Tests red-first for new behavior; mocked `fetchImpl` only — no real network in tests.
- e2e specs under `apps/web/e2e/` for page round-trips (Playwright infra exists).
- Timezone labels on pipeline calendar chips (account-local vs viewer).

## 5. Open items
1. Live-token scope pre-flight (`/debug_token` or App Dashboard) — blocks first real Graph call of 2.1, not the client build itself.
2. `/api/preview/route.ts` contract confirmation before 1.2 thumbnail wiring.
3. Vercel function limits for story/photo fast-path decision (Phase 3).

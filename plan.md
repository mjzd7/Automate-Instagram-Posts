# Automated Instagram Quote-Poster — Implementation Plan (v6: fully specified, zero-ambiguity edition)

## 0. How to use this document

This plan is written so a less capable ("free tier") model can implement it correctly without making judgment calls. Rules for using it:

- **Section 2 (Global Constants) is the single source of truth for every number.** If a later section seems to imply a different number, Section 2 wins — flag the discrepancy rather than silently picking one.
- Where an exact value depends on a **third-party library's current API surface** (e.g. exact `sharp` method names, exact `drizzle-orm` syntax), this plan gives the **exact required behavior** and a **realistic code sketch**, but instructs verifying the live method signature against the installed package's docs before writing it — per the adopted kokanee doctrine ("no inventing APIs from memory when retrieval is possible," `docs/DOCTRINE.md` §1.3). This is not an ambiguity gap; it is the correct way to stay unambiguous about *behavior* without hard-coding possibly-stale *syntax*.
- Where an exact value depends on a **third-party HTTP API's current version/quota** (e.g. Graph API version string, a free-tier quota number), this plan states the value as known at planning time (Aug 2026) and instructs checking the provider's current docs at setup time if it's been a while — quotas and version strings drift; endpoint shapes and required parameters do not, and those are specified exactly below.
- Every module below has: **Purpose, Inputs, Outputs, Exact algorithm/steps, Failure handling.** Implement in the order given in Section 13.

---

## 1. Process & governance — kokanee's AGENTS.md contract

The user wants this project set up and built under the rules, gates, and workflow already defined in the sibling `kokanee/` folder (its `AGENTS.md` "Zero-Slop" agent operating contract + `docs/*.md`). `kokanee/` is a **separate git repo**, nested but not merged into this one, so its `CLAUDE.md`/`AGENTS.md` is not automatically discovered by tooling while working at this repo's root.

1. **Copy** `kokanee/AGENTS.md` + `kokanee/docs/*.md` + `kokanee/.claude/hooks/*` + `.claude/settings.json` into this repo's root (not a symlink across repos — independently versioned). `kokanee/` itself stays untouched. First action taken, before any application code.
2. **Maturity level jumps L0 → L1 immediately** (contract's own §0 rule: "when a real code project is initialized: set level to L1... do not defer it"). L1 makes **G1–G4 mandatory**, G5–G7 optional:
   - **G1 (types)** → `pnpm -r exec tsc --noEmit`
   - **G2 (lint/format)** → ESLint + Prettier, repo-wide
   - **G3 (tests)** → `pnpm test` (Vitest), failure-matrix targeted (`docs/TESTING.md`'s 12 planes)
   - **G4 (slop scan)** → semgrep against `docs/SLOP.md`'s appendix rules if installed (opt-in, not auto-installed), else the manual `rg` scan in `docs/TOOLS.md` §3.5 plus an eyeball pass for the 12 slop patterns
   - Fill `docs/TOOLS.md` §3.4/§3.5 stubs with real commands once `package.json` exists.
3. **DOX adoption fires at the same L0→L1 trigger** (`docs/DOX.md`): root `AGENTS.md` is already the DOX root. As each top-level code subtree is created (`apps/web`, `packages/core`, `scripts`, `data`, `research`), add a child `AGENTS.md` (Purpose, Ownership, Local Contracts, Work Guidance, Verification, Child DOX Index) — only as each subtree is actually built.
4. **Workflow loop** (`docs/WORKFLOW.md`, all 12 steps) applies per item in Section 13's build order: INIT → REALITY → CONTEXT → **PLAN** (stop for explicit approval on cross-module/public-API/security-sensitive changes — e.g. token encryption, GitHub Contents API write-back) → RED → GREEN (decision ladder: exist at all? → already in codebase? → stdlib? → native platform feature? → installed dependency? → one line? → only then minimum viable implementation; ≤250 LOC net-new logic per slice) → VERIFY (paste gate command + output) → SLOP PASS → SKEPTIC (optional at L1) → DoD (`AGENTS.md` §9 checklist) → DISTILL (log recurring failures to `docs/LEARNINGS.md` immediately) → **STOP** (no commit/push/deploy unless explicitly asked).
5. **Hard blocks stay in force**: no type suppression; no commit/push/deploy unless asked; stop after 2 failed fix attempts on the same defect, escalate; no scope balloon; no unrequested scaffolding beyond what's copied from kokanee.
6. **Skeptic review (G6) and mutation testing (G5) stay optional at L1** — only on risky/security-sensitive changes or if asked.
7. **Skill availability — honest degradation**: none of kokanee's preferred skills (`/programming`, `/tdd`, `/remove-ai-slops`, `/caveman-compress`, `/land-and-deploy`, `/ponytail-review`, `/design-an-interface`) are loadable in a typical session — every one falls to its documented fallback (manual TDD loop, manual slop scan + `rg`, manual decision-ladder application, no auto-deploy). Do not claim to have run a skill that wasn't actually invoked.

---

## 2. Global constants reference (single source of truth)

### 2.1 Image & layout
| Constant | Value |
|---|---|
| `IMAGE_WIDTH` | `1080` px |
| `IMAGE_HEIGHT` | `1350` px (4:5 portrait) |
| `SAFE_MARGIN_PX` | `80` px from each edge — no text or critical content outside this |
| `FONT_SIZE_MAX` | `72` px |
| `FONT_SIZE_MIN` | `32` px (hard floor — if text still doesn't fit at this size, truncate quote with `…` rather than go smaller) |
| `FONT_SIZE_STEP` | `4` px (step down from MAX toward MIN until wrapped text fits within the safe area) |
| `LINE_HEIGHT_RATIO` | `1.3` × font size |
| `TARGET_MAX_CHARS_PER_LINE` | `32` (soft wrap target — short-line-length best practice) |
| `AUTHOR_LINE_FONT_SIZE` | `0.4` × final quote font size, minimum `24` px |

### 2.2 Scrim & blending
| Constant | Value |
|---|---|
| `SCRIM_BAND_PADDING_PX` | `60` px above and below the rendered text block's bounding box |
| `SCRIM_PEAK_OPACITY_NORMAL` | `0.45` (45%) at vertical center of the scrim band |
| `SCRIM_PEAK_OPACITY_BUSY` | `0.60` (60%) — used when `suitability-scorer` flags the region as busy (§2.4) |
| `SCRIM_COLOR_DARK_MODE` | `#000000` (black, used when background is classified `dark` per §2.3 — text will be white) |
| `SCRIM_COLOR_LIGHT_MODE` | `#FFFFFF` (white, used when background is classified `light` — text will be charcoal `#1A1A1A`) |
| `SCRIM_GRADIENT_STOPS` | 3-stop vertical linear gradient over the band: `0%` → opacity `0`, `50%` → opacity `SCRIM_PEAK_OPACITY_*`, `100%` → opacity `0` |
| `GRAIN_TEXTURE_OPACITY` | `0.08` (8%) |
| `GRAIN_BLEND_MODE` | `overlay` |
| `TEXT_SHADOW_BLUR_PX` | `8` |
| `TEXT_SHADOW_OFFSET_Y_PX` | `2` |
| `TEXT_SHADOW_COLOR_DARK_MODE` | `rgba(0,0,0,0.35)` |
| `TEXT_SHADOW_COLOR_LIGHT_MODE` | `rgba(0,0,0,0.15)` (still a dark, low-opacity shadow even on light mode — a soft shadow under dark text on a light image, not a glow) |

### 2.3 Darkness classification
| Constant | Value |
|---|---|
| `ANALYSIS_THUMBNAIL_SIZE` | `64×64` px (resize candidate image to this before per-pixel scan, for performance) |
| `LUMINANCE_FORMULA` | `L = 0.299·R + 0.587·G + 0.114·B` (ITU-R BT.601), computed per pixel, `0–255` scale |
| `DARK_PIXEL_LUMINANCE_CUTOFF` | `90` (pixel counted as "dark" if `L < 90`) |
| `DARK_FRACTION_THRESHOLD` | `0.6` — if ≥60% of the 64×64 sampled pixels are "dark" per the cutoff above, classify the whole image `dark`; else `light` |

### 2.4 Suitability / busyness scoring
| Constant | Value |
|---|---|
| `TEXT_ZONE_HORIZONTAL_CROP` | center `80%` of image width |
| `TEXT_ZONE_VERTICAL_CROP` | middle band, `45%`–`70%` of image height (where the quote text is placed — see §7.11 layout) |
| `BUSYNESS_METRIC` | standard deviation of per-pixel luminance (same `LUMINANCE_FORMULA`) within the crop above, computed on the crop resized to `64×64` for performance |
| `BUSYNESS_HIGH_THRESHOLD` | stdev `> 45` → region is "busy" → use `SCRIM_PEAK_OPACITY_BUSY` and apply a `6px` Gaussian blur to the crop region before compositing text over it |

### 2.5 Embeddings & matching
| Constant | Value |
|---|---|
| `DUPLICATE_SIMILARITY_THRESHOLD` | `0.92` cosine similarity — reject candidate quote as near-duplicate if similarity to any of the account's last `DUPLICATE_LOOKBACK_COUNT` used quotes ≥ this |
| `DUPLICATE_LOOKBACK_COUNT` | `200` most-recently-used quotes for this account |
| `IMAGE_MATCH_CANDIDATE_POOL_SIZE` | `5` candidate background images fetched per quote; pick the one with highest cosine similarity between quote-text embedding and image description embedding |
| `EMBEDDING_VECTOR_CACHE` | store every computed embedding (quote text and image description) in the DB (`embedding_cache` table, §5.7) keyed by a hash of the input text, to avoid re-embedding the same string twice — real savings since curated quotes/backgrounds repeat across accounts |

### 2.6 Rate limits & scheduling
| Constant | Value |
|---|---|
| `SOFT_TARGET_POSTS_PER_DAY` | `20` per account |
| `HARD_STOP_POSTS_PER_DAY` | `22` per account (buffer under Instagram's documented 25/24h cap — abort the batch, do not attempt further publishes, if a rolling-24h count query returns ≥ this) |
| `BATCH_SIZE` | `5` posts per batch run |
| `BATCHES_PER_DAY` | `4` (4 × 5 = 20, matches `SOFT_TARGET_POSTS_PER_DAY` exactly) |
| `DEFAULT_POSTING_HOURS_LOCAL` | `[10, 13, 17, 20]` (24h, account-local time per its configured IANA timezone — the default for a new account; editable per-account in `data/accounts.json`) |
| `POST_INTERVAL_BASE_SECONDS` | `480` (8 minutes) between posts within a batch |
| `POST_INTERVAL_JITTER_SECONDS` | `±180` (±3 minutes) — actual sleep per gap = random integer in `[300, 660]` seconds |
| `WORKFLOW_CRON` | `"0 * * * *"` (hourly, top of every hour UTC) — each account's job checks whether the current hour (converted to that account's local timezone) is in its `postingHoursLocal` list; if not, the job exits immediately (no-op) |

### 2.7 Content moderation & safety
| Constant | Value |
|---|---|
| `TEXT_WORDLIST_ACTION` | reject quote candidate outright and re-pick (no partial-mask/censor attempt) if any wordlist term matches (case-insensitive, word-boundary match) |
| `IMAGE_SAFESEARCH_REJECT_LEVELS` | reject candidate image if Google Vision SafeSearch returns `LIKELY` or `VERY_LIKELY` for `adult`, `violence`, or `racy` |
| `BANNED_HASHTAG_ACTION` | drop the flagged tag, draw a replacement from the same category's hashtag pool, re-check the replacement too (loop until clean or pool exhausted) |
| `HASHTAG_SET_SIZE` | `5` hashtags per post (1 fixed, 1 category, 3 trending) per latest 2026 guidelines avoiding "hashtag spam" |

### 2.8 Mode & template weighting
| Constant | Value |
|---|---|
| `MODE_WEIGHTING_LOOKBACK_COUNT` | last `20` publish attempts per account, per dimension (dark/light, and separately per caption template) |
| `MODE_WEIGHTING_FLOOR` | `0.20` (20%) — minimum selection probability for any mode/template even if its recent success rate is 0, so it's never fully starved out and can recover |
| `MODE_WEIGHTING_ALGORITHM` | selection probability for option *i* = `max(FLOOR, successRate_i) / sum(max(FLOOR, successRate_j) for all j)` — weighted random draw using these normalized probabilities |

### 2.9 Git batching
| Constant | Value |
|---|---|
| `GIT_COMMIT_MESSAGE_FORMAT` | `"post-batch: {account_id} {ISO date} {n} posts ({success}/{attempted} succeeded)"` |
| `GIT_PUSH_CONFLICT_RETRY_COUNT` | `1` (on push rejection: `git pull --rebase origin main`, retry push once; if it fails again, fail the job loudly rather than force-push) |
| `IMAGE_RETENTION_DAYS` | `3` — composited images in `data/posts/` older than this, whose post is `status='published'`, are deleted in the same batch commit (Instagram already has the permanent copy via the media permalink) |

### 2.10 Token lifecycle & permanent zero-re-setup automation
| Constant / Feature | Value / Details |
|---|---|
| `TOKEN_REFRESH_CRON` | `"0 3 * * 0"` (weekly, Sunday 03:00 UTC workflow trigger) |
| `TOKEN_REFRESH_TRIGGER_WINDOW_DAYS` | `10` — refresh if current token's `expires_at` is within 10 days of expiration |
| `TOKEN_EXPIRY_WARNING_DAYS` | `5` — if token is within 5 days of expiry and refresh attempts have failed, trigger emergency Discord alert |
| `IG_LONG_LIVED_TOKEN_LIFETIME_DAYS` | `60` (Meta Graph API long-lived token lifespan; refreshing extends by another 60 days) |
| `BACKUP_SECRET_MIRRORING` | Synchronizes refreshed 60-day token to `IG_TOKEN_{ACCOUNT_ID}` in GitHub Secrets via `GH_PAT_FOR_SECRETS` |
| `ZERO_RE_SETUP_GUARANTEE` | Once initial token is seeded, weekly cron auto-refreshes tokens perpetually without manual human intervention unless Meta password/credentials are reset |

#### 2.10.1 Key Zero-Re-Setup Operational Guidelines
1. **GitHub PAT Setup**: Provide `GH_PAT_FOR_SECRETS` (`Secrets: write` permission) so token auto-refresh writes backup secrets to GitHub Secrets.
2. **Discord Alerting**: Provide `DISCORD_WEBHOOK_URL` to receive proactive alerts 10 and 5 days prior to token expiration if Meta's API ever rejects a refresh call.
3. **Prevent Invalidation**: Avoid changing the connected Facebook account password or unlinking the Instagram Business Page, as Meta invalidates active tokens on credential changes.
4. **Cron Inactivity Protection**: Since `post.yml` regularly commits post history to the repo, GitHub Actions' 60-day inactivity cron pauser will never trigger.


---

## 3. Tech stack & package list

- **Runtime**: Node.js 20 LTS (or newer LTS current at setup time — check `node --version`; pin in `.nvmrc` and GitHub Actions `setup-node` action to whatever LTS is current).
- **Package manager**: pnpm, workspace-based monorepo (`pnpm-workspace.yaml` listing `apps/*` and `packages/*`).
- **Language**: TypeScript throughout, `strict: true` in `tsconfig.base.json`.
- **Core packages** (exact versions must be resolved via `npm view <pkg> version` or `pnpm add <pkg>` picking latest stable at install time — do not hardcode a version number from training data, per §0's doctrine note; the list below is the **package name and role**, not a version pin):
  - `next` — dashboard framework
  - `react`, `react-dom` — required by Next.js
  - `typescript`, `@types/node` — typing
  - `zod` — env + config schema validation
  - `sharp` — image processing (resize, composite, raw pixel access for darkness/suitability analysis)
  - `libsql`/`@libsql/client` — local embedded SQLite-compatible DB (the same client library used for hosted Turso also supports a local `file:` URL — confirm this in its docs at setup; if the local-file mode isn't supported by whichever exact client is current, fall back to `better-sqlite3` with the same schema, which is the direct precedent this design assumes)
  - `drizzle-orm` + its libSQL/SQLite driver adapter — typed schema/queries
  - `vitest` — test runner
  - `eslint`, `prettier`, relevant TypeScript/React plugin packages — lint/format
  - `@octokit/rest` — GitHub Contents API calls from the dashboard's write-back routes, and from the token-refresh workflow's GitHub-secret mirror step
  - `next-auth` — dashboard single-user credentials auth
  - `tsx` — running TypeScript CLI scripts directly (`scripts/*.ts`) without a separate build step
- **No Turso/Upstash/Cloudinary/Redis packages** — fully git-native per the architecture decision in §4.

---

## 4. Architecture summary (unchanged decisions, restated for completeness)

Fully git-native: **public repo**, no hosted DB/cache/object-storage vendor. State (`data/app.db`, a local libSQL/SQLite file) and generated images (`data/posts/*.jpg`) are committed to the repo by GitHub Actions and served to Instagram via `raw.githubusercontent.com` URLs (requires the repo to be public — private-repo raw URLs need an auth token Instagram's servers can't send). Batched commits: one commit+push per batch run (§2.9), not per post. GitHub Actions `concurrency:` group scoped per account (`post-<account_id>`, `cancel-in-progress: false`) so accounts run independently and a slow batch isn't killed by the next hourly trigger.

---

## 5. Database schema (exact DDL)

Use Drizzle's schema-as-TypeScript as the source of truth (`packages/core/src/db/schema.ts`); DDL shown here for clarity — translate directly, do not redesign.

```sql
CREATE TABLE accounts (
  id                  TEXT PRIMARY KEY,          -- slug, e.g. 'main', 'stoic-quotes'
  ig_user_id          TEXT NOT NULL,
  fb_page_id          TEXT NOT NULL,
  threads_user_id     TEXT,                       -- NULL if Threads not linked
  category_focus      TEXT NOT NULL,               -- JSON array of category ids, e.g. '["motivational","stoic"]'
  timezone            TEXT NOT NULL,               -- IANA tz, e.g. 'America/New_York'
  posting_hours_local TEXT NOT NULL,               -- JSON array of ints 0-23, e.g. '[10,13,17,20]'
  active              INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE quotes (
  id            TEXT PRIMARY KEY,
  text          TEXT NOT NULL,
  author        TEXT,
  category_id   TEXT NOT NULL REFERENCES categories(id),
  source         TEXT NOT NULL DEFAULT 'curated',  -- 'curated' | 'quotable' | 'api_ninjas' | 'quote_garden' | 'zenquotes' | 'they_said_so'
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_quotes_text_author ON quotes(text, author);

CREATE TABLE backgrounds (
  id            TEXT PRIMARY KEY,
  source        TEXT NOT NULL,                     -- 'curated' | 'unsplash'
  external_id   TEXT,
  source_url    TEXT NOT NULL,
  description   TEXT,                               -- alt/description text, used for embedding match (§7.7)
  attribution   TEXT,                               -- required for Unsplash API TOS compliance
  category_id   TEXT REFERENCES categories(id),
  darkness      TEXT,                               -- 'dark' | 'light', cached from darkness-classifier so it's not recomputed every run
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_backgrounds_external ON backgrounds(source, external_id);

CREATE TABLE posts (
  id                  TEXT PRIMARY KEY,
  account_id          TEXT NOT NULL REFERENCES accounts(id),
  quote_id            TEXT REFERENCES quotes(id),
  background_id       TEXT REFERENCES backgrounds(id),
  template_id         TEXT NOT NULL,                -- one of the 4 font-pairing templates, §7.12
  caption_template_id TEXT NOT NULL,
  mode                TEXT NOT NULL,                -- 'dark' | 'light'
  composed_image_path TEXT,                          -- relative path under data/posts/
  ig_media_id         TEXT,
  ig_permalink        TEXT,
  threads_post_id     TEXT,
  stories_media_id    TEXT,
  status              TEXT NOT NULL,                -- 'pending' | 'published' | 'failed'
  error_message       TEXT,
  scheduled_for        TEXT NOT NULL,
  published_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_posts_account_status ON posts(account_id, status);
CREATE INDEX idx_posts_account_published_at ON posts(account_id, published_at);

CREATE TABLE quote_usage (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  quote_id   TEXT NOT NULL REFERENCES quotes(id),
  post_id    TEXT NOT NULL REFERENCES posts(id),
  used_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, quote_id, post_id)
);

CREATE TABLE background_usage (
  account_id    TEXT NOT NULL REFERENCES accounts(id),
  background_id TEXT NOT NULL REFERENCES backgrounds(id),
  post_id       TEXT NOT NULL REFERENCES posts(id),
  used_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, background_id, post_id)
);

CREATE TABLE settings (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,                          -- JSON-encoded
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, key)
);
-- keys used: 'mode_weighting' -> { dark: {attempts,successes}, light: {attempts,successes} }
--            'caption_template_weighting' -> { [templateId]: {attempts,successes} }

CREATE TABLE ig_token (
  account_id            TEXT PRIMARY KEY REFERENCES accounts(id),
  access_token_encrypted TEXT NOT NULL,               -- AES-GCM, key from TOKEN_ENCRYPTION_KEY env
  expires_at            TEXT NOT NULL,
  threads_access_token_encrypted TEXT,
  threads_expires_at    TEXT,
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE embedding_cache (
  text_hash  TEXT PRIMARY KEY,                        -- sha256 of the input string
  input_text TEXT NOT NULL,
  vector     TEXT NOT NULL,                            -- JSON array of floats
  provider   TEXT NOT NULL,                             -- which of the 4 embedding providers produced it
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 6. JSON config file schemas (dashboard-editable, git-native)

### 6.1 `data/accounts.json`
```json
[
  {
    "id": "main",
    "igUserId": "1784...",
    "fbPageId": "1029...",
    "threadsUserId": null,
    "categoryFocus": ["motivational", "stoic"],
    "timezone": "America/New_York",
    "postingHoursLocal": [10, 13, 17, 20],
    "active": true
  }
]
```
This file is the **input** used to (re)populate the `accounts` DB table (via `scripts/seed-db.ts --sync-accounts`, idempotent upsert by `id`) and to build the GitHub Actions matrix (a preliminary workflow job reads this file and emits the account id list as a JSON matrix — see §9.1).

### 6.2 `data/categories.json`
```json
[
  { "id": "motivational", "name": "Motivational", "description": "General encouragement and drive", "active": true },
  { "id": "stoic", "name": "Stoic", "description": "Stoic philosophy quotes", "active": true }
]
```

### 6.3 `data/templates.json`
```json
[
  {
    "id": "bold-modern",
    "name": "Bold / Modern",
    "quoteFont": "Montserrat",
    "authorFont": "Merriweather",
    "active": true
  },
  { "id": "editorial-elegant", "name": "Editorial / Elegant", "quoteFont": "Bodoni Moda", "authorFont": "Raleway", "active": true },
  { "id": "soft-curvy", "name": "Soft / Curvy", "quoteFont": "Abril Fatface", "authorFont": "Work Sans", "active": true },
  { "id": "authentic-personal", "name": "Authentic / Personal", "quoteFont": "Caveat", "authorFont": "Lato", "active": true }
]
```

### 6.4 `data/hashtags.json`
Per-category pool the `hashtags/selector.ts` draws from (§2.7).
```json
{
  "motivational": ["#motivationdaily", "#dailyinspiration", "..."],
  "stoic": ["#stoicism", "#stoicquotes", "..."]
}
```

### 6.5 `data/settings.json`
Global (non-per-account, non-secret) settings — caption templates, retention window override, etc. Per-account weighting state lives in the DB (`settings` table, §5), not here.

---

## 7. Module-by-module exact specs

### 7.1 `packages/core/src/config/env.ts`
**Purpose**: fail fast on missing/malformed config. **Exact required env vars** (zod schema, all `z.string().min(1)` unless noted):
```
TOKEN_ENCRYPTION_KEY          (hex, exactly 64 chars = 32 bytes)
GOOGLE_CLOUD_VISION_API_KEY
UNSPLASH_ACCESS_KEY
JINA_API_KEY
COHERE_API_KEY                (optional — fallback chain, warn if absent, don't fail)
HUGGINGFACE_API_KEY           (optional)
GEMINI_API_KEY                (optional)
API_NINJAS_KEY                (for quote fallback provider)
DISCORD_WEBHOOK_URL           (z.string().url())
GH_PAT_FOR_SECRETS            (only required in refresh-token workflow context)
```
At least one embeddings provider key must be present; `env.ts` throws a clear error listing exactly which required var is missing, not a generic "invalid config."

### 7.2 `packages/core/src/config/accounts.ts`
**Purpose**: load and validate `data/accounts.json` against a zod schema matching §6.1. **Output**: `Account[]` typed array. Used by the pipeline entrypoint (given an `account_id` CLI arg, look up the matching entry) and by the matrix-generation step in CI.

### 7.3 `packages/core/src/db/*`
`client.ts` opens the libSQL client against `file:./data/app.db` (relative to repo root — the workflow always runs with the repo checkout as CWD). `schema.ts` is the Drizzle schema matching §5 exactly, field-for-field. `repositories/*.repo.ts` — one file per table, exposing typed query functions (e.g. `quotesRepo.findUnusedForAccount(accountId, categoryId, limit)` implementing the anti-join: `SELECT * FROM quotes WHERE category_id = ? AND active = 1 AND id NOT IN (SELECT quote_id FROM quote_usage WHERE account_id = ?) ORDER BY RANDOM() LIMIT ?`).

### 7.4 `packages/core/src/content-filter/text-filter.ts`
**Purpose**: reject quote candidates containing flagged terms. **Input**: quote text string. **Output**: `boolean` (true = passes, false = rejected). **Exact approach**: bundle a static, offline profanity/explicit-term wordlist (a small JSON array shipped in the package, not fetched at runtime — pick an existing MIT/permissive-licensed wordlist package such as `bad-words`'s default list, or a hand-curated `packages/core/src/content-filter/wordlist.json`; verify license before bundling). Match case-insensitive, word-boundary (`\bterm\b` regex per entry, not naive substring match, to avoid false positives like "assessment" matching "ass"). Per §2.7: any match → reject outright.

### 7.5 `packages/core/src/content-filter/image-filter.ts`
**Purpose**: reject candidate background images via Google Cloud Vision SafeSearch. **Exact API contract**:
```
POST https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_CLOUD_VISION_API_KEY}
Body: {
  "requests": [{
    "image": { "source": { "imageUri": "<candidate image URL>" } },
    "features": [{ "type": "SAFE_SEARCH_DETECTION" }]
  }]
}
```
Response contains `responses[0].safeSearchAnnotation.{adult,violence,racy}`, each one of `UNKNOWN|VERY_UNLIKELY|UNLIKELY|POSSIBLE|LIKELY|VERY_LIKELY`. Per §2.7: reject if any of the three fields is `LIKELY` or `VERY_LIKELY`. **Setup flag**: this endpoint requires a GCP project with billing enabled even though usage stays within the free 1,000-units/month tier — the one exception to "no credit card needed" in this stack; document explicitly in `docs/SETUP.md`.

### 7.6 `packages/core/src/matching/embeddings-client.ts`
**Purpose**: produce a numeric embedding vector for a string, trying providers in order until one succeeds, with DB caching (§5, `embedding_cache`). **Exact fallback order and contracts**:

1. **Jina AI Embeddings**:
```
POST https://api.jina.ai/v1/embeddings
Headers: Authorization: Bearer {JINA_API_KEY}, Content-Type: application/json
Body: { "model": "jina-embeddings-v3", "input": ["<text>"] }
Response: { "data": [{ "embedding": [0.123, ...] }] }
```
2. **Cohere Embed** (fallback if Jina fails or key absent):
```
POST https://api.cohere.com/v1/embed
Headers: Authorization: Bearer {COHERE_API_KEY}, Content-Type: application/json
Body: { "texts": ["<text>"], "model": "embed-english-v3.0", "input_type": "search_document" }
Response: { "embeddings": [[0.123, ...]] }
```
3. **HuggingFace Inference API** (fallback):
```
POST https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2
Headers: Authorization: Bearer {HUGGINGFACE_API_KEY}
Body: { "inputs": "<text>" }
Response: [0.123, ...]   (a plain array, not wrapped)
```
4. **Google Gemini text-embedding** (final fallback):
```
POST https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={GEMINI_API_KEY}
Body: { "content": { "parts": [{ "text": "<text>" }] } }
Response: { "embedding": { "values": [0.123, ...] } }
```

**Exact algorithm**: hash input text (SHA-256) → check `embedding_cache` → if hit, return cached vector. If miss, try provider 1; on any non-2xx response or network error, log and try provider 2; continue through the chain; if all 4 fail, throw (the caller — duplicate-detector or image-quote-matcher — must decide whether to skip the check or abort the post; see those modules). On success, write `{text_hash, input_text, vector, provider}` to `embedding_cache` before returning.

**Cosine similarity function** (shared util, `packages/core/src/matching/cosine-similarity.ts`): standard dot-product-over-magnitudes formula, exact:
```
cosineSimilarity(a, b) = dot(a,b) / (magnitude(a) * magnitude(b))
```
Note: different providers' vectors have different dimensionality (Jina/Cohere/Gemini ~768-1024 dims, MiniLM 384 dims) — **never compare embeddings produced by different providers to each other**. When comparing two texts, both must be embedded by the same provider in the same call sequence; if the primary provider changed mid-comparison due to a fallback, re-embed the first text with the new provider rather than mixing vector spaces. Store `provider` in the cache specifically so callers can enforce this.

### 7.7 `packages/core/src/matching/image-quote-matcher.ts`
**Purpose**: pick the best-matching background for a quote from `IMAGE_MATCH_CANDIDATE_POOL_SIZE` (§2.5) candidates. **Algorithm**: embed the quote text once; for each candidate background, embed its `description` field (from `backgrounds` table — Unsplash's `alt_description`/`description` response field, or the curated entry's stored description); compute cosine similarity (same-provider constraint from §7.6); return the candidate with the highest score. **Failure handling**: if embeddings fail entirely (all 4 providers down), fall back to random selection among the filtered (darkness/SafeSearch-passed) candidates rather than aborting the post — log this degradation clearly, do not claim a match was made.

### 7.8 `packages/core/src/matching/duplicate-detector.ts`
**Purpose**: reject near-duplicate quotes (paraphrases). **Algorithm**: embed candidate quote text; fetch the `DUPLICATE_LOOKBACK_COUNT` most recent quote embeddings used by this account (join `quote_usage` → `quotes` → `embedding_cache`, ordered by `used_at DESC LIMIT 200`); compute cosine similarity against each; if max similarity ≥ `DUPLICATE_SIMILARITY_THRESHOLD` (0.92), reject and signal caller to re-pick. **Failure handling**: if embeddings unavailable, skip this check (log degradation) rather than block posting entirely — exact-text dedup via `quote_usage`'s anti-join still applies regardless.

### 7.9 `packages/core/src/images/darkness-classifier.ts`
**Purpose**: classify a background image `dark` or `light`. **Exact algorithm**:
1. Resize the source image to `ANALYSIS_THUMBNAIL_SIZE` (64×64) using `sharp` (any interpolation is fine at this size).
2. Extract raw RGB pixel buffer (`sharp`'s raw-output mode — verify exact method name against the installed version's docs, e.g. `.raw().toBuffer({ resolveWithObject: true })`).
3. For each pixel, compute `L` via `LUMINANCE_FORMULA` (§2.3).
4. Count the fraction of the 4,096 pixels with `L < DARK_PIXEL_LUMINANCE_CUTOFF` (90).
5. If fraction ≥ `DARK_FRACTION_THRESHOLD` (0.6) → `'dark'`, else `'light'`.
6. Cache the result on the `backgrounds.darkness` column so it's computed once per background image, not once per use.

### 7.10 `packages/core/src/images/suitability-scorer.ts`
**Purpose**: score how "busy" the text-placement region of a chosen image is, to drive scrim/blur strength. **Exact algorithm**:
1. Crop the source image to `TEXT_ZONE_HORIZONTAL_CROP` × `TEXT_ZONE_VERTICAL_CROP` (§2.4: center 80% width, 45%-70% height band).
2. Resize crop to 64×64, extract raw pixels, compute per-pixel luminance (same formula as §7.9).
3. Compute the **standard deviation** of the 4,096 luminance values → `BUSYNESS_METRIC`.
4. If `> BUSYNESS_HIGH_THRESHOLD` (45) → return `{ busy: true, scrimOpacity: SCRIM_PEAK_OPACITY_BUSY, blurRegion: true }`; else `{ busy: false, scrimOpacity: SCRIM_PEAK_OPACITY_NORMAL, blurRegion: false }`.

### 7.11 `packages/core/src/images/compositor.ts`
**Purpose**: render the final post image. **Exact steps**:
1. Load/resize background to exactly `IMAGE_WIDTH × IMAGE_HEIGHT` (1080×1350), cover-fit + center-crop (no distortion).
2. If `suitability-scorer` flagged `blurRegion: true`, apply a Gaussian blur (radius `6px`) to just the `TEXT_ZONE` crop region before compositing further layers (composite the blurred crop back over the original at its exact coordinates).
3. Composite the grain texture layer: a pre-generated static noise PNG asset (`packages/core/src/images/assets/grain.png`, generated once at build time — see note below — not regenerated per post), tiled/stretched to `1080×1350`, blended with mode `overlay` at opacity `GRAIN_TEXTURE_OPACITY` (0.08).
   - *Generating `grain.png` once*: use `sharp` to create a noise buffer (e.g. via a small script using `sharp`'s `create` with random per-pixel values, or a simple deterministic pseudo-random noise generator) sized 1080×1350, saved as a static asset checked into the repo — this is a one-time build artifact, not a per-post computation.
4. Determine mode (`dark`/`light`) from `darkness-classifier`'s cached result for the chosen background.
5. Wrap the quote text: break into lines targeting `TARGET_MAX_CHARS_PER_LINE` (32) chars/line at word boundaries (never mid-word).
6. Determine font size: start at `FONT_SIZE_MAX` (72); render (measure, don't necessarily rasterize yet) the wrapped text block; if its bounding box (width or height) exceeds the safe area (`IMAGE_WIDTH - 2×SAFE_MARGIN_PX` wide, generous vertical allowance within the `TEXT_ZONE_VERTICAL_CROP` band), step down by `FONT_SIZE_STEP` (4px) and re-wrap/re-measure; repeat until it fits or `FONT_SIZE_MIN` (32) is reached. If still doesn't fit at the minimum, truncate the quote text with a trailing `…` and re-measure once more (do not loop indefinitely — this is a hard stop, not a further size reduction).
7. Composite the scrim: an SVG linear gradient (3-stop per §2.2/`SCRIM_GRADIENT_STOPS`) sized to the text block's bounding box plus `SCRIM_BAND_PADDING_PX` (60px) on top and bottom, colored `SCRIM_COLOR_DARK_MODE`/`SCRIM_COLOR_LIGHT_MODE` per the mode, peak opacity from `suitability-scorer`'s output (`SCRIM_PEAK_OPACITY_NORMAL` or `_BUSY`).
8. Render the quote text (font per the selected template's `quoteFont`, §6.3) centered horizontally and vertically within the text zone, color white (`#FFFFFF`) in dark mode / charcoal (`#1A1A1A`) in light mode, with the drop shadow from §2.2 (`TEXT_SHADOW_*` constants).
9. Render the author line below the quote (font per the template's `authorFont`, size `AUTHOR_LINE_FONT_SIZE`), same color/shadow treatment, `24px` gap below the quote block.
10. Export as JPEG, quality `85` (a reasonable default balancing file size vs. visual quality for a git-committed asset — not a load-bearing exact number, adjust during dry-run visual review if needed), write to `data/posts/{account_id}/{YYYY-MM-DD}-{postId}.jpg`.

### 7.12 `packages/core/src/images/templates/*`
The 4 template definitions from §6.3 (`bold-modern`, `editorial-elegant`, `soft-curvy`, `authentic-personal`) — each is a small config object `{ id, quoteFont, authorFont }` consumed by the compositor; the actual Google Font files/CSS must be bundled (self-hosted `.woff2` files under `packages/core/src/images/fonts/`, downloaded once from Google Fonts and committed — do not fetch fonts from Google's CDN at render time, since the render happens in a headless Node process via `sharp`'s SVG text rendering, which needs local font files registered, not a browser with network access to Google Fonts).

### 7.13 `packages/core/src/aesthetics/mode-weighting.ts`
**Purpose**: pick dark-vs-light-leaning template preference and caption template, weighted by recent publish-success. **Exact algorithm** (§2.8): read the account's `settings` row for key `mode_weighting` → `{ dark: {attempts, successes}, light: {attempts, successes} }` (each capped to the last `MODE_WEIGHTING_LOOKBACK_COUNT`=20 attempts — implement as a fixed-size ring buffer stored in the JSON value, not an unbounded log). Compute `successRate_dark = successes/attempts` (default `0.5` if `attempts=0`), same for light. Apply `MODE_WEIGHTING_ALGORITHM` (§2.8) with `MODE_WEIGHTING_FLOOR`=0.20 to get selection probabilities; draw one via `Math.random()` against the cumulative distribution. Same exact mechanism, independently, for caption template selection (key `caption_template_weighting`, one bucket per template id instead of just 2). After each publish attempt, append the outcome to the relevant ring buffer(s) and persist back to `settings`.

### 7.14 `packages/core/src/hashtags/selector.ts` + `banned-list.ts`
**Purpose**: pick `HASHTAG_SET_SIZE` (5) hashtags for the post's category from `data/hashtags.json` and `data/trending-hashtags.json`, filtered against `banned-list.ts`'s static array of flagged/shadowbanned tags. **Algorithm**: 1 fixed `#successforsure`, up to 3 top trending tags from `trending-hashtags.json`, and 1 category-specific tag. If the trending pool is short, it tops up from the category or general pools. `banned-list.ts` ships as a static, periodically-reviewable array — note in the file's header comment that this list should be spot-checked occasionally (no automated freshness mechanism; that would be scope creep per the decision ladder).

### 7.15 `packages/core/src/quotes/*`
Curated provider (`curated-provider.ts`) — DB anti-join query per §7.3. Fallback chain, tried in this order when the curated pool for a requested category is exhausted:
1. **Quotable**: `GET https://api.quotable.io/quotes/random?tags={category}` (no API key required as of planning; if this public instance is down — it has a history of instability — treat as a normal fallback-chain failure and proceed to the next provider).
2. **API Ninjas Quotes**: `GET https://api.api-ninjas.com/v1/quotes?category={category}` header `X-Api-Key: {API_NINJAS_KEY}`.
3. **Quote Garden**: `GET https://quote-garden.onrender.com/api/v3/quotes/random?genre={category}` (no key required).
4. **ZenQuotes**: `GET https://zenquotes.io/api/random` (no key, no category filter on the free tier — filter results client-side by simple keyword match against the category name as a best-effort).
5. **They Said So**: `GET https://quotes.rest/qod?category={category}` (free tier is rate-limited to a small number of calls/day — use last in the chain).
Any fetched external quote is inserted into the `quotes` table with `source` set to the provider name, so it becomes part of the durable curated-equivalent pool for future dedup tracking.

### 7.16 `packages/core/src/instagram/client.ts`
**Purpose**: publish to Instagram Feed, post first-comment hashtags, refresh token. **Exact Graph API contract** (base `https://graph.facebook.com/{version}` — this plan was written against `v21.0`; check `developers.facebook.com/docs/graph-api/changelog` at setup time and use whatever is current, the endpoint *shapes* below don't change across versions):
1. **Create media container**: `POST /{ig-user-id}/media` body `{ image_url, caption, access_token }` → `{ id: creationId }`.
2. **Poll container status**: `GET /{creation-id}?fields=status_code&access_token=...` → `status_code` one of `IN_PROGRESS|FINISHED|ERROR`; poll every 2 seconds, up to 10 attempts (20s total), then treat as failed if still not `FINISHED`.
3. **Publish**: `POST /{ig-user-id}/media_publish` body `{ creation_id, access_token }` → `{ id: mediaId }`.
4. **Fetch permalink**: `GET /{media-id}?fields=permalink&access_token=...`.
5. **Post first-comment hashtags**: `POST /{media-id}/comments` body `{ message: "<hashtag set joined by spaces>", access_token }`.
6. **Refresh long-lived token**: `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={current_token}` → `{ access_token, expires_in }` (seconds; compute new `expires_at = now + expires_in`).

### 7.17 `packages/core/src/instagram/stories-client.ts`
Same container-create/publish pattern as §7.16 steps 1-3, with `media_type: "STORIES"` added to the container-create body. No caption/first-comment step (Stories don't support comments the same way).

### 7.18 `packages/core/src/threads/client.ts`
Threads uses the same Meta Graph API family, different host: `POST https://graph.threads.net/v1.0/{threads-user-id}/threads` body `{ media_type: "IMAGE", image_url, text: caption, access_token }` → `{ id: creationId }`; then `POST https://graph.threads.net/v1.0/{threads-user-id}/threads_publish` body `{ creation_id, access_token }`. No separate container-status poll documented for Threads as of planning — verify at setup whether one is needed (Meta's docs may have added this; if so, mirror the IG polling pattern).

### 7.19 `packages/core/src/pipeline/generate-and-publish-batch.ts`
**Purpose**: orchestrate one batch run for one account. **Exact algorithm** (numbered steps map directly to §2.6's constants):
```
1. Load env (§7.1), load account config (§7.2) for the given account_id.
2. Query rolling-24h published count for this account; if >= HARD_STOP_POSTS_PER_DAY (22), log and exit 0 (no-op, not a failure).
3. Check current UTC time converted to account.timezone (use Node's built-in Intl.DateTimeFormat with timeZone option — no extra dependency); if the resulting local hour is NOT in account.postingHoursLocal, exit 0 (no-op).
4. For i in 1..BATCH_SIZE (5):
   a. Pick a category from account.categoryFocus (round-robin or random — random is simpler and fine per YAGNI).
   b. curated-provider.getNext(category) -> text-filter check -> if rejected, retry curated-provider up to 3 times, then fall through the quote fallback chain (§7.15).
   c. duplicate-detector check on the candidate; if too similar, go back to (b) up to 3 retries, then accept anyway with a logged warning (don't stall the batch indefinitely).
   d. Fetch IMAGE_MATCH_CANDIDATE_POOL_SIZE (5) candidate backgrounds (curated pool first, Unsplash to fill any shortfall) -> darkness-classifier (cached) + image-filter (SafeSearch) on each -> image-quote-matcher picks the best of the surviving candidates.
   e. suitability-scorer on the chosen background.
   f. mode-weighting picks the template (constrained to match the background's actual dark/light classification -- do not force a light-styled template onto a dark image) and caption template.
   g. hashtags/selector picks the hashtag set for the category.
   h. compositor renders the image to data/posts/{account_id}/....jpg.
   i. Insert posts row, status='pending'.
   j. instagram/client: create container -> poll -> publish -> fetch permalink -> post hashtag comment.
   k. instagram/stories-client: publish same image to Stories (best-effort -- log failure but don't fail the whole post over a Stories failure).
   l. If account.threadsUserId set: threads/client publish (best-effort, same non-fatal treatment).
   m. Update posts row: status='published', ig_media_id, ig_permalink, threads_post_id, stories_media_id, published_at.
   n. Insert quote_usage + background_usage rows.
   o. mode-weighting: record success/failure outcome for the mode and caption template used.
   p. If i < BATCH_SIZE: sleep POST_INTERVAL_BASE_SECONDS +/- POST_INTERVAL_JITTER_SECONDS (random 300-660s).
   q. On any failure in j-l for the core IG publish (not the best-effort Stories/Threads steps): mark posts row status='failed' with error_message, send a Discord alert with the batch/run link, continue the loop to the next item (one bad post doesn't kill the whole batch) -- unless 3 consecutive items in this batch have failed, in which case abort the remaining batch items and alert loudly (something systemic is likely broken, e.g. an expired token).
5. Prune data/posts/{account_id}/ images older than IMAGE_RETENTION_DAYS (3) whose post status='published'.
6. git/commit-batch.ts: single commit+push for this run's DB + image changes.
```

### 7.20 `packages/core/src/pipeline/refresh-token.ts`
Per §2.10: for each account with a Threads/IG token, check `expires_at` against `TOKEN_REFRESH_TRIGGER_WINDOW_DAYS` (10); if due, call the refresh endpoint (§7.16 step 6), write the new encrypted token + `expires_at` to `ig_token`, commit. Also mirror to a GitHub Actions secret named `IG_TOKEN_{ACCOUNT_ID}` via the GitHub REST API (`PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}`, value sealed-box encrypted with the repo's public key using `libsodium-wrappers`, authenticated with `GH_PAT_FOR_SECRETS`) as a human-recoverable backup — Turso isn't in play here since this is git-native, but the same "backup outside the primary read path" reasoning applies to protect against a corrupted/unreadable `data/app.db`.

### 7.21 `packages/core/src/git/commit-batch.ts`
**Exact commands** (run via Node's `child_process` or a small shell wrapper, from the repo root, inside the GitHub Actions runner where `git` is preconfigured with the `GITHUB_TOKEN`-based remote):
```bash
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add data/
git commit -m "<GIT_COMMIT_MESSAGE_FORMAT from §2.9>"
git pull --rebase origin main
git push origin main
```
On push rejection (non-fast-forward), retry the `pull --rebase` + `push` sequence exactly `GIT_PUSH_CONFLICT_RETRY_COUNT` (1) more time; if it still fails, fail the job loudly (this is a real conflict signal, e.g. two accounts' matrix jobs racing — should be rare given per-account concurrency groups, but the retry handles the case of *another* account's batch pushing in between this job's `add` and `push`).

### 7.22 `packages/core/src/notify/discord.ts`
`POST {DISCORD_WEBHOOK_URL}` body `{ "content": "<message>", "embeds": [{ "title": "...", "description": "...", "color": 15158332 (red, for failures) | 3066993 (green, for the rare success notice) }] }`.

---

## 8. Setup checklist (exact, one-time, per account added)

1. Create a Meta Developer app at developers.facebook.com; add the "Instagram Graph API" product.
2. Create/use a Facebook Page; convert the target Instagram account to Business or Creator and link it to that Page.
3. Add the account as a Tester/Admin on the Meta app (avoids full App Review for personal/self use — confirm current Meta requirements at setup, these change).
4. Obtain a long-lived access token: Graph API Explorer → short-lived user token with `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`, `pages_show_list` scopes → exchange for long-lived via `GET /oauth/access_token?grant_type=fb_exchange_token...`. Extract `ig_user_id`/`fb_page_id` via `GET /me/accounts` → page → `GET /{page-id}?fields=instagram_business_account`.
5. If cross-posting to Threads: link the Threads account to the same Meta app, obtain `threads_user_id` and a Threads-scoped token via the same OAuth flow with `threads_basic`/`threads_content_publish` scopes.
6. Create a Google Cloud project, enable the Vision API, enable billing (required even for free-tier usage), generate an API key restricted to the Vision API.
7. Create a free Unsplash developer app at unsplash.com/developers, get the Access Key.
8. Create free-tier accounts/API keys for the embeddings providers actually configured: Jina AI (required), Cohere/HuggingFace/Gemini (recommended for resilience, optional).
9. Create an API Ninjas account/key for the quote fallback provider.
10. Create a Discord webhook in a private server/channel.
11. Generate `TOKEN_ENCRYPTION_KEY`: `openssl rand -hex 32`.
12. Create a fine-grained GitHub PAT scoped to this repo with `Secrets: write` (for `GH_PAT_FOR_SECRETS`) and, separately, one with `Contents: write` for the dashboard's write-back routes (`DASHBOARD_GITHUB_PAT`, stored in Vercel env, not GitHub secrets).
13. Add all of the above as GitHub repository secrets (Settings → Secrets and variables → Actions).
14. Add the account entry to `data/accounts.json`, run `pnpm --filter core exec tsx scripts/seed-db.ts --sync-accounts`.
15. Seed the account's initial IG token: a one-time-only local file `secrets/accounts-seed.json` (gitignored, never committed) `{ "main": { "accessToken": "...", "expiresInSeconds": ... } }`, consumed by `scripts/seed-db.ts --seed-tokens`, then delete the seed file.
16. Configure the Vercel project for `apps/web` (root directory `apps/web`), set env vars (`DASHBOARD_GITHUB_PAT`, `NEXTAUTH_SECRET`, `DASHBOARD_PASSWORD_HASH`, `TOKEN_ENCRYPTION_KEY` if the dashboard ever needs to decrypt for display).
17. Manually trigger `post.yml` via `workflow_dispatch` with a small effective batch (temporarily lower `BATCH_SIZE` for the smoke test if desired) against the live account; verify a real post appears on Instagram and in `data/app.db`/dashboard history.
18. Manually trigger `refresh-token.yml`; confirm the `ig_token` row updates and the mirrored GitHub secret updates.

---

## 9. GitHub Actions workflows

### 9.1 `.github/workflows/post.yml` — exact structure
```yaml
name: post
on:
  schedule:
    - cron: "0 * * * *"   # WORKFLOW_CRON, §2.6
  workflow_dispatch: {}

jobs:
  load-accounts:
    runs-on: ubuntu-latest
    outputs:
      accounts: ${{ steps.read.outputs.accounts }}
    steps:
      - uses: actions/checkout@v4
      - id: read
        run: echo "accounts=$(jq -c '[.[] | select(.active) | .id]' data/accounts.json)" >> "$GITHUB_OUTPUT"

  post:
    needs: load-accounts
    strategy:
      matrix:
        account_id: ${{ fromJson(needs.load-accounts.outputs.accounts) }}
      fail-fast: false
    concurrency:
      group: post-${{ matrix.account_id }}
      cancel-in-progress: false
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter core exec tsx scripts/run-post-batch.ts --account ${{ matrix.account_id }}
        env:
          # all secrets from §7.1 / §8, referenced as ${{ secrets.X }}
```
(Exact `actions/checkout`, `pnpm/action-setup`, `actions/setup-node` versions should be whatever's current at setup time — the versions shown are illustrative, verify against the Actions marketplace.)

### 9.2 `.github/workflows/refresh-token.yml`
Same shape, `cron: "0 3 * * 0"` (§2.10), no matrix needed if `refresh-token.ts` internally loops all accounts in one job (simpler; token refresh is infrequent and cheap, doesn't need per-account parallelism or isolation).

### 9.3 `.github/workflows/ci.yml`
Triggered on push/PR: `pnpm install`, `pnpm -r exec tsc --noEmit` (G1), `pnpm lint` (G2), `pnpm test` (G3), and the manual `rg` slop scan or semgrep if installed (G4) — matches §1's gate mapping exactly.

---

## 10. Scripts

- `scripts/run-post-batch.ts` — thin CLI: parse `--account <id>` arg, call `pipeline/generate-and-publish-batch.ts`, set `process.exitCode` on failure.
- `scripts/run-token-refresh.ts` — thin CLI calling `pipeline/refresh-token.ts` for all accounts.
- `scripts/seed-db.ts` — flags: `--sync-accounts` (idempotent upsert from `data/accounts.json` into the `accounts` table), `--seed-tokens` (reads `secrets/accounts-seed.json`, encrypts, writes `ig_token` rows), `--seed-quotes` (imports the large curated quote dataset — source TBD at implementation time, must be a permissively-licensed/public-domain quotes collection, tagged by category), `--seed-backgrounds` (imports a starter curated background image set with descriptions).

---

## 11. Dashboard (`apps/web`)

**Resolved — visual design** (2026-08-23): user mandate supersedes the earlier neuform.ai note — UI/UX + CSS are authored **from scratch**, taking complete inspiration from `mjzd7/dagr`'s "Monochrome Titanium" system (`BRAND.md` v1.0.0). User owns DAGR; its Tri-Node Euclidean DAG logo/favicon are adopted verbatim as the brand mark. Canonical tokens, decisions ledger, and phased plan: `.omo/plans/dashboard-dagr-overhaul.md`.

**Functional spec (unchanged by the visual-design open item)**:
- Auth: NextAuth Credentials provider, single hardcoded user, password hash from `DASHBOARD_PASSWORD_HASH`.
- Pages: `accounts` (CRUD on `data/accounts.json`), `categories` (CRUD on `data/categories.json`), `templates` (CRUD on `data/templates.json`), `history`/`upcoming`/`overview` (account-selector-scoped reads from `data/app.db`, read-only via a bundled libSQL client reading the checked-out file at build/request time — since Vercel deployments are triggered by the same git pushes the pipeline makes, the dashboard's data is only as fresh as the last deploy; note this latency explicitly rather than implying real-time).
- Writes (accounts/categories/templates edits): via `@octokit/rest`'s Contents API (`PUT /repos/{owner}/{repo}/contents/{path}`) using `DASHBOARD_GITHUB_PAT`, which triggers a new commit and a new Vercel deploy.
- Live preview on CRUD pages: server-side call into the same `compositor.ts` used by the pipeline, rendering a sample image with the edited template/category against a placeholder quote — same code path, no duplicated rendering logic.

---

## 12. Testing plan (exact files)

- `packages/core/test/images/darkness-classifier.test.ts` — fixture images (a solid-black, solid-white, and a 50/50 split test PNG committed under `test/fixtures/`) asserting exact classification per §2.3's thresholds.
- `packages/core/test/images/suitability-scorer.test.ts` — a uniform-color fixture (low stdev, not busy) and a high-contrast checkerboard fixture (high stdev, busy) asserting the §2.4 threshold behavior.
- `packages/core/test/matching/embeddings-client.test.ts` — mock all 4 provider HTTP calls; assert fallback order, caching behavior, and same-provider-comparison enforcement.
- `packages/core/test/matching/duplicate-detector.test.ts` — mock embeddings; assert rejection at/above `DUPLICATE_SIMILARITY_THRESHOLD` and acceptance below it.
- `packages/core/test/content-filter/text-filter.test.ts` — known flagged terms rejected, clean text passes, word-boundary edge cases (e.g. "class" not flagged by a substring match on a shorter flagged term).
- `packages/core/test/hashtags/selector.test.ts` — banned tag gets replaced, set size always equals `HASHTAG_SET_SIZE`.
- `packages/core/test/instagram/client.test.ts` — mock Graph API responses; assert the exact request shapes from §7.16, retry/poll behavior, and error propagation on non-2xx.
- `packages/core/test/pipeline/generate-and-publish-batch.test.ts` — full orchestration with all externals mocked; assert the rate-cap early-exit, posting-hours no-op, per-item failure isolation (one failed item doesn't stop the batch), and the 3-consecutive-failures abort condition from §7.19 step 4q.
- `packages/core/test/git/commit-batch.test.ts` — assert exact git command sequence (via a mocked `child_process`), and the conflict-retry-once behavior.
- Failure-matrix coverage (`docs/TESTING.md`'s 12 planes) is required per-module per the adopted governance — at minimum: external-dep timeout/429 handling (embeddings, IG API, quote APIs), token-expiry handling, malformed/empty quote text, empty candidate-image pool.

---

## 13. Build order (critical files, execute in this exact sequence)

0. **Governance setup** (§1): copy kokanee's contract into repo root, bump maturity, fill tool stubs.
1. `research/*.md` — firecrawl deep-research pass (fonts, contrast-and-blending, aesthetic-trends, layout-and-engagement).
2. `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`, `.nvmrc`, `.env.example` — monorepo scaffold.
3. `packages/core/src/config/env.ts` + `config/accounts.ts` (§7.1, §7.2).
4. `packages/core/src/db/schema.ts` + client + repositories (§5, §7.3).
5. `packages/core/src/images/darkness-classifier.ts` + `suitability-scorer.ts` (§7.9, §7.10).
6. `packages/core/src/matching/embeddings-client.ts` + `cosine-similarity.ts` + `image-quote-matcher.ts` + `duplicate-detector.ts` (§7.6-7.8).
7. `packages/core/src/content-filter/text-filter.ts` + `image-filter.ts` (§7.4, §7.5).
8. `packages/core/src/hashtags/selector.ts` + `banned-list.ts` + `data/hashtags.json` (§7.14).
9. `packages/core/src/images/compositor.ts` + font assets + grain texture asset + the 4 templates (§7.11, §7.12).
10. `packages/core/src/aesthetics/mode-weighting.ts` (§7.13).
11. `packages/core/src/instagram/client.ts` + `stories-client.ts` (§7.16, §7.17).
12. `packages/core/src/threads/client.ts` (§7.18).
13. `packages/core/src/quotes/*` (§7.15).
14. `packages/core/src/pipeline/generate-and-publish-batch.ts` + `refresh-token.ts` + `git/commit-batch.ts` + `notify/discord.ts` (§7.19-7.22).
15. `scripts/*.ts` (§10).
16. `.github/workflows/post.yml`, `refresh-token.yml`, `ci.yml` (§9).
17. `apps/web` — after the neuform.ai skills open item is resolved (§11).

---

## 14. Verification

- `pnpm test` (Vitest, §12) — all modules, with the pasted command + output required by the governance DoD (§1).
- Local dry-run: a `--dry-run` flag on `run-post-batch.ts` that runs steps 4a-4i of §7.19 (selection through image composition) but skips 4j-4l (real IG/Threads/Stories calls) and skips the git push — prints the composited image path for visual review across all 4 templates × both modes.
- One real `workflow_dispatch` of `post.yml` (temporarily reduced batch size) against a live account before relying on the hourly cron.
- One real `workflow_dispatch` of `refresh-token.yml`.
- `pnpm dev` on `apps/web`: exercise the CRUD pages, confirm a commit lands via the GitHub API, confirm a subsequent dry-run picks up the change.
- Per the L1 governance: every non-trivial slice closed out with the DoD checklist — gate command + output pasted, not asserted.

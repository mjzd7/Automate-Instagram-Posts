# Setup

One-time steps to go from a cloned repo to a live, self-running Instagram quote-poster. Do these in order — later steps depend on secrets/values collected in earlier ones. Repeat §2–§4 and §8's account entry once per additional Instagram account.

## 0. Prerequisites

- The GitHub repo must be **public**. Composited images are served to Instagram's Graph API via `raw.githubusercontent.com`, which cannot present an auth token on Instagram's behalf — a private repo's raw URLs would 404 for Instagram's servers.
- Node version pinned in `.nvmrc`; install via your Node version manager, then `corepack enable` (or install `pnpm` directly) and run `pnpm install` at the repo root.
- `jq` on `$PATH` if you want to test `.github/workflows/post.yml`'s account-matrix step locally (`jq -c '[.[] | select(.active) | .id]' data/accounts.json`) — not required to run the app itself.

## 1. Generate the token-encryption key

```bash
openssl rand -hex 32
```

Save this as `TOKEN_ENCRYPTION_KEY` — it must be exactly 64 hex characters. It encrypts IG/Threads access tokens at rest in `data/app.db` (defense-in-depth: the repo is public). Losing this key means every stored token becomes unrecoverable and must be re-seeded from scratch (§8.3).

## 2. Meta Developer app + Instagram Business account

1. Create an app at [developers.facebook.com](https://developers.facebook.com/), add the **Instagram Graph API** product.
2. Convert the target Instagram account to a **Business** or **Creator** account (in the Instagram app: Settings → Account type) and link it to a Facebook Page you control.
3. Add yourself/the account as a **Tester or Admin** on the Meta app — this avoids full App Review for personal/self use. Meta's exact current requirements for this drift over time; check the app's "Roles" tab if the below steps 401.
4. In [Graph API Explorer](https://developers.facebook.com/tools/explorer/), get a short-lived **User** token with scopes: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`, `pages_show_list`.
5. Exchange it for a long-lived token (~60 days, per Meta's docs at the time this was written — reverify, this number drifts):
   ```
   GET https://graph.facebook.com/v21.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={app-id}
     &client_secret={app-secret}
     &fb_exchange_token={short-lived-token}
   ```
6. Look up the Page and Instagram Business Account IDs:
   ```
   GET https://graph.facebook.com/v21.0/me/accounts?access_token={long-lived-token}
   ```
   gives `fb_page_id`. Then:
   ```
   GET https://graph.facebook.com/v21.0/{fb_page_id}?fields=instagram_business_account&access_token={long-lived-token}
   ```
   gives `ig_user_id`.

## 3. Threads (optional)

If cross-posting to Threads: link the Threads account to the same Meta app, and repeat the Graph API Explorer flow with `threads_basic`/`threads_content_publish` scopes to get a Threads-scoped token and `threads_user_id`.

## 4. Google Cloud Vision (SafeSearch image filtering)

1. Create a Google Cloud project, enable the **Vision API**.
2. **Enable billing on the project** — required even though usage stays inside the free 1,000-units/month tier. This is the one step in this whole setup that needs a card on file.
3. Generate an API key, restrict it to the Vision API. This is `GOOGLE_CLOUD_VISION_API_KEY`.

## 5. Unsplash (background image fallback pool)

Create a free developer app at [unsplash.com/developers](https://unsplash.com/developers), copy the Access Key as `UNSPLASH_ACCESS_KEY`. `images/background-provider.ts` only reaches for Unsplash to top up the curated pool when it's short for a category, so this is used, but not on every post.

## 6. Embeddings provider (at least one required)

Used for quote-duplicate detection and quote-to-image semantic matching. `JINA_API_KEY` (from [jina.ai](https://jina.ai/)) is tried first; `COHERE_API_KEY`, `HUGGINGFACE_API_KEY`, `GEMINI_API_KEY` are optional fallbacks that add resilience if Jina's free tier is ever exhausted or down. `config/env.ts` will refuse to start if none of the four are set — the app degrades gracefully across missing embeddings *providers* at runtime, but needs at least one configured at all.

## 7. Quote fallback chain enhancements (optional)

The curated quote pool (`data/seed/quotes.json`, seeded in §9) plus DummyJSON/ZenQuotes/type.fit cover the fallback chain with **no key required**. `API_NINJAS_KEY` ([api-ninjas.com](https://api-ninjas.com/)) and `THEY_SAID_SO_KEY` ([theysaidso.com](https://theysaidso.com/)) add two more category-filtered fallback options but are not required for the pipeline to run.

## 8. Discord webhook (failure/success alerts)

Create a webhook in a private Discord server/channel you control (Channel Settings → Integrations → Webhooks). Copy the URL as `DISCORD_WEBHOOK_URL`.

## 9. Local `.env.local`

Copy `.env.example` to `.env.local` and fill in every value collected above. This file is git-ignored — never commit it. `config/env.ts`'s scripts read from `process.env` directly (no implicit dotenv loading); for local runs, load it with Node's native `--env-file` flag:

```bash
pnpm --filter core exec -- tsx --env-file=../../.env.local scripts/seed-db.ts -- --sync-accounts
```

(the path is `../../.env.local` because `pnpm --filter core exec` runs with `packages/core` as its working directory, two levels below the repo root where `.env.local` lives).

## 10. GitHub repository secrets

Settings → Secrets and variables → Actions → New repository secret, one per key from `.env.local`: `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLOUD_VISION_API_KEY`, `UNSPLASH_ACCESS_KEY`, `DISCORD_WEBHOOK_URL`, `JINA_API_KEY`, and whichever of `COHERE_API_KEY` / `HUGGINGFACE_API_KEY` / `GEMINI_API_KEY` / `API_NINJAS_KEY` / `THEY_SAID_SO_KEY` you configured (unset optional ones can be left out — `secrets.X` resolves to an empty string, which `env.ts` treats as "not set").

Additionally, generate a **fine-grained GitHub PAT** scoped to this repo only, with **Secrets: write** permission, and add it as the repository secret `GH_PAT_FOR_SECRETS`. This is used only by `refresh-token.yml` to mirror a freshly-refreshed token into the matching `IG_TOKEN_{ACCOUNT_ID}` / `THREADS_TOKEN_{ACCOUNT_ID}` repository secret as a human-recoverable backup (`github/secrets.ts`) — it is not used for anything else, and `post.yml`/`ci.yml` don't need it. `post.yml` and `refresh-token.yml` push commits using the workflow's own default `GITHUB_TOKEN` (already granted `contents: write` in each workflow file) — no separate PAT is needed for that.

## 11. Add the account to `data/accounts.json`

`data/accounts.json` starts as `[]`. Add one entry per Instagram account, matching `config/accounts.ts`'s schema exactly:

```json
[
  {
    "id": "main",
    "igUserId": "17841400000000000",
    "fbPageId": "102900000000000",
    "threadsUserId": null,
    "categoryFocus": ["motivational", "stoic"],
    "timezone": "America/New_York",
    "postingHoursLocal": [10, 13, 17, 20],
    "active": true
  }
]
```

`categoryFocus` entries must match ids in `data/categories.json` (ships with 9: `motivational`, `stoic`, `humor`, `business`, `love`, `wisdom`, `mindfulness`, `resilience`, `general` — edit that file, and `data/hashtags.json`'s matching key, to add/remove categories). `postingHoursLocal` is a list of 24h local hours; `post.yml` runs hourly and no-ops for any account whose current local hour isn't in this list, so 4 entries ≈ 4 batches/day × 5 posts/batch ≈ the plan's 20 posts/day soft target.

Then sync it into the DB:

```bash
pnpm run seed -- --sync-accounts
```

(this also always re-syncs `data/categories.json`, regardless of flags — see the comment in `scripts/seed-db.ts`).

## 12. Seed the curated quote pool

```bash
pnpm run seed -- --seed-quotes
```

Loads `data/seed/quotes.json` (72 public-domain/attributed quotes across all 9 categories) into `quotes`. `insertQuote` no-ops on an exact text+author duplicate, so this is safe to re-run. Add more curated quotes directly to that file (or `data/seed/quotes.json`-shaped entries elsewhere) any time — the fallback API chain (§7) only fires when the curated pool for a category runs dry for a given account.

`pnpm run seed -- --seed-backgrounds` is also available but `data/seed/backgrounds.json` ships empty on purpose: backgrounds are fetched live from Unsplash at post time by default (§5); only add curated entries there as an optional enhancement (e.g. a specific set of on-brand photos), each with a real `sourceUrl` and a `description` string (used for quote-to-image semantic matching).

## 13. Seed the initial access token(s)

Create a **local, gitignored** file (`secrets/` is in `.gitignore`) `secrets/accounts-seed.json`:

```json
{
  "main": {
    "accessToken": "the long-lived IG token from step 2.5",
    "expiresInSeconds": 5184000,
    "threadsAccessToken": "optional, from step 3",
    "threadsExpiresInSeconds": 5184000
  }
}
```

Then:

```bash
pnpm --filter core exec -- tsx --env-file=../../.env.local scripts/seed-db.ts -- --seed-tokens
```

This encrypts each token with `TOKEN_ENCRYPTION_KEY` and writes it to the `ig_token` table. **Delete `secrets/accounts-seed.json` immediately after** — it holds plaintext tokens and the script prints a reminder to do so.

## 14. Local dry run (visual review before going live)

```bash
pnpm --filter core exec -- tsx --env-file=../../.env.local scripts/run-post-batch.ts -- --account main --dry-run
```

Runs the real pipeline — quote selection, background match, suitability scoring, compositing — and writes real JPEGs to `data/posts/main/`, but skips the IG/Threads/Stories publish calls, the rate-cap/posting-hour gates, and the git commit. Open the printed paths and check: text fits within the safe margins, contrast/scrim looks right in both dark and light mode, the font pairing matches the template, author line placement. Re-run a few times to sample different templates (there are 10, category-cycled) and both modes before trusting it against a real account.

## 15. First live run

```bash
GITHUB_REPOSITORY=owner/repo pnpm --filter core exec -- tsx --env-file=../../.env.local scripts/run-post-batch.ts -- --account main
```

or trigger `.github/workflows/post.yml` manually via **Actions → post → Run workflow** (`workflow_dispatch`) once the repo secrets (§10) are set — this is the recommended first real test, since it exercises the actual CI environment rather than your local machine. Confirm a real post lands on Instagram and `data/app.db` gets committed back by the workflow.

## 16. First token-refresh run

Trigger `.github/workflows/refresh-token.yml` manually via `workflow_dispatch`. It no-ops for any account whose token isn't within 10 days of expiry (`TOKEN_REFRESH_TRIGGER_WINDOW_DAYS`), so this won't do anything visible until closer to the token's actual expiry — the manual trigger here is just to confirm the workflow itself runs cleanly (auth, DB read/write, commit) before relying on its weekly Sunday-03:00-UTC cron.

## 17. Dashboard (`apps/web`)

A Next.js 16 app: sign-in (single hardcoded user), an Overview page, Accounts/Categories CRUD (writes commit directly to the repo via the GitHub Contents API), a read-only Templates gallery, History, and a live Preview tool — all built against the design tokens in `Elias-Thorne-Interface-Architect-DESIGN.md`.

**Additional env vars** (add to `.env.local` and to Vercel's project env, on top of `DASHBOARD_GITHUB_PAT`/`NEXTAUTH_SECRET`/`DASHBOARD_PASSWORD_HASH` from earlier):
- `GITHUB_REPO_SLUG` — `owner/repo`. Vercel doesn't auto-set `GITHUB_REPOSITORY` the way GitHub Actions does, so the Contents-API writer needs this explicitly.
- `GITHUB_BRANCH` — optional, defaults to `main`.

**Local dev**:
```bash
pnpm --filter web dev
```
Then sign in at `/login` with the plaintext password matching `DASHBOARD_PASSWORD_HASH` (username is hardcoded `admin`).

**Deploying to Vercel**: set the project's root directory to `apps/web`, add the env vars above (all of them — the dashboard reads `data/app.db` and `data/*.json` straight from the repo checkout, so no separate database is provisioned). Every push the pipeline makes triggers a redeploy, which is also when the dashboard's view of `data/app.db` refreshes — it is not a live connection (see the Overview/History pages' own code comments).

**A real gap found building this**: Auth.js v5 enforces a production-only `Host` header check that `next dev` doesn't — it only surfaces once actually deployed (or running `next build && next start` locally). Already fixed (`trustHost: true` in `auth.ts`, see `docs/LEARNINGS.md` FR-007), but worth knowing if a future auth change ever needs re-verifying: test it against a production build, not just `next dev`.

## Ongoing operation

Once §10–§16 are done, the system runs unattended: `post.yml` fires hourly and no-ops outside each account's configured posting hours; `refresh-token.yml` fires weekly. The only recurring maintenance is watching the configured Discord webhook for failure alerts — a systemic failure (e.g. an expired token, or 3 consecutive post failures) surfaces there, not just in GitHub's own Actions UI.

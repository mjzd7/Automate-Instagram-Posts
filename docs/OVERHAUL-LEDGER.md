# Dashboard Overhaul — Execution Ledger

> Plan of record: `.omo/plans/dashboard-dagr-overhaul.md` (tokens, decided ledger, veto-list).
> Any agent: resume at first non-✅ row. Stage only your own files (tree carries unrelated churn). Gates before every commit.

| Phase | Scope | Status | Commit | Notes |
|---|---|---|---|---|
| P0 | plan persistence, §11 resolution, ledger | ✅ | b9065a5 | |
| P1 | Playwright scaffold, writer seam, auth fixture, fixtures db/jsons, smoke 6/6 | ✅ | 274b1a6 | fixture app.db minted from core migrations (strip `--> statement-breakpoint` BEFORE executeMultiple) |
| P2 | Monochrome Titanium @theme, next/font trio, primitives ui.tsx, pill Nav+TriNodeMark, icon.svg, kill Nebula+three, login/forms reskin | ✅ | f6ab0db | |
| P4 | schema extensions, wall-time.ts, generator.ts, regenerateMonth | ✅ | a91168d | 16 tests incl DST NY/Auckland, half-hour zones, leap 2028 |
| P5 | /schedules editor (tz/hours/cap/blackouts/pause → accounts.json) | ✅ | 08db4d8 | |
| P6 | schedule/due.ts runner contract | ✅ core primitive | 14484f6 | REMAINING: branch inside packages/core/scripts/run-post-batch.ts consuming dueEntries(file,accountId,now,tz) when data/pipeline/<month>.json exists; pipeline_status write-back to app.db |
| P7 | /pipeline viewer (calendar grid) + builder (generate/regen month) | ✅ | c8a4a4f | buildPipeline action merges via regenerateMonth |
| P3b/c | categories/templates/history/preview pages still use deleted Elias-Thorne classes (readable but unstyled) | ⏳ TODO | — | rebuild on components/ui.tsx primitives like overview/accounts pattern |
| P3a-lite | overview+accounts NOT yet rebuilt either (still old classes; tokens gone so partially unstyled) | ⏳ TODO | — | same pattern |
| P8 | Vercel finalize + freshness badge + ops docs | ⏳ TODO | — | env: DASHBOARD_GITHUB_PAT(fine-grained contents:rw this repo), NEXTAUTH_SECRET, DASHBOARD_PASSWORD_HASH; GH-Pages rejected static-only |
| P9 | CI e2e gate + styled error/404 pages | ◐ partial | (this commit) | DONE: .github/workflows/e2e.yml PR-gate, (dashboard)/error.tsx retry card, app/not-found.tsx w/ back-home link. REMAINING: expand smoke.spec.ts to schedules-save + pipeline-generate/render flows; DoD closeout sweep |

## Verification state at last commit (c8a4a4f)
- web tsc clean · eslint clean on ALL touched files
- repo vitest 483/483 except 1 PRE-EXISTING flake story-compositor 5s-timeout under load (passes isolated)
- playwright 6/6 (login/auth/redirect/nav/accounts list/add/delete through seam)

## Gotchas learned (do not rediscover)
- getByLabel needs htmlFor/id pairs (AccountForm fixed; keep the pattern in all new forms).
- Duplicate embedded AccountForms → scope locators to form filtered by its submit button.
- Playwright reuseExistingServer can attach an ORPHANED server missing new env vars — lsof -ti :3100 and kill between runs.
- libsql executeMultiple does NOT tolerate drizzle's `--> statement-breakpoint`; replace token with newline, never drop lines (inline markers carry statements!).
- vitest must exclude apps/web/e2e (root vitest.config.ts exclude) — do not shadow root config from apps/web.

# Dashboard Overhaul — Execution Ledger

> Living tracker for `.omo/plans/dashboard-dagr-overhaul.md` (read that file FIRST for full context: design tokens, decided ledger A/D/G/X items, veto-list).
> Any agent picking this up: find the first phase below without ✅ and continue from there. Update this file after EVERY task.

| Phase | Scope | Status | Commit | Evidence |
|---|---|---|---|---|
| P0 | Persist plan, resolve plan.md §11 open item, create ledger | ✅ done 2026-08-23 | `docs(plan): resolve §11 visual item, adopt Monochrome Titanium overhaul plan` | this file + §11 edit |
| P1 | Playwright scaffold: config :3100, mock-writer seam, auth storageState fixture, seeded fixtures, smoke spec | ✅ done 2026-08-23 | `274b1a6` | vitest 467/467 · playwright 6/6 · eslint+tsc clean on touched files (pre-existing core tsc/eslint failures documented) |
| P2 | Design system core: @theme Monochrome Titanium, next/font trio, 6 primitives, pill Nav (+Schedules/Pipeline), kill Nebula+three, Tri-Node logo/favicon verbatim | ⏳ pending | | |
| P3a | Overview + Accounts pages rebuild | ⏳ pending | | |
| P3b | Categories + Templates pages (enabledTemplates editor) | ⏳ pending | | |
| P3c | Preview + History pages | ⏳ pending | | |
| P4 | Schedule domain: schema extensions, wall-time.ts Intl conversions, generator.ts pure fn, regenerateMonth contract | ✅ done 2026-08-23 | (this commit) | vitest 483/483 repo-wide incl. 16 schedule tests; eslint+tsc clean on touched files |
| P5 | Schedules editor UI | ⏳ pending | | |
| P6 | Pipeline engine wiring: month-file generate/regen actions, runner binding + status→app.db + legacy fallback + kill-switch | ⏳ pending | | |
| P7 | Pipeline viewer (month calendar) + builder stepper UI | ⏳ pending | | |
| P8 | Vercel deploy finalization + ops docs + freshness badge | ⏳ pending | | |
| P9 | Full e2e matrix + CI e2e.yml + 404/error pages + DoD closeout | ⏳ pending | | |

## Ground rules (binding)
- Stage ONLY your own files — working tree contains unrelated pipeline churn (image prunes, .dagr/*). Never `git add -A`.
- Gates before each commit: `pnpm -r typecheck`, lint, affected vitest; playwright from P1 on. Paste outputs in phase evidence.
- Mock-writer seam: server actions import writer from `apps/web/lib/writer.ts`; octokit never imported directly elsewhere. Prod build throws if `DASHBOARD_LOCAL_FS` set.
- Pipeline entries store LOCAL date+hour only; UTC derived via Intl at use-site. Never manual offsets.
- Every interactive element gets `data-testid`.
- Commit titles fixed per phase (see plan file §3); body lists what was added and why.

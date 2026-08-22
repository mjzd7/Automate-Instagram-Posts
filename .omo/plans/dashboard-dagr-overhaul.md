# Dashboard Overhaul — DAGR From-Scratch (Hyperplan Output)

> **Status**: APPROVED — user GO received 2026-08-23. Logo ruling: user owns DAGR → Tri-Node Euclidean DAG SVGs (BRAND.md §5) adopted VERBATIM (master + 16px favicon). All vetoes otherwise silent-default per §4.
> **Created**: 2026-08-23 · Process: hyperplan adversarial planning, degraded to lead-in-chat after provider failures.
> **Execution contract**: one titled commit per phase, gates green before each commit (typecheck/lint/vitest/semgrep; playwright from P1), L1 DoD per repo AGENTS.md.

## 0. Provenance & degradation record

- Roster attempted: unspecified-low(pragmatist, superseded), ultrabrain(architect), artistry(design ×3 spawns dead: model-not-found), unspecified-high(auditor, 4 fallbacks then cancelled), librarian(DAGR research, 30m timeout). plan-agent spawn aborted.
- All seats completed by lead in-chat per user directive ("if spawned agents fail, do it in chat").
- Design ground truth (two agreeing sources): live `dagr dashboard` HTML scraped at 127.0.0.1:3333 (45KB single-file UI) + `BRAND.md` v1.0.0 from github.com/mjzd7/dagr ("Monochrome Titanium / Apple Space Black & Resend").

## 1. Resolved design language (deterministic)

| Role | Token | Value |
|---|---|---|
| Canvas | Pure OLED Black | #000000 |
| Surface L1 cards/nav/dialog | Titanium Obsidian Glass | #0D0E12 / rgba(18,18,22,.85) frosted |
| Elevation L2 hover/active/code | Liquid Titanium | #16171D / rgba(255,255,255,.04) |
| Primary accent/CTA | Specular White | #FFFFFF |
| Secondary tags/badges | Liquid Platinum | #E4E4E7 |
| Muted metadata | Titanium Slate | #71717A |
| Hairline border | Platinum Specular | rgba(255,255,255,.10) |
| Warning/live only | Amber | #ffb900 |

Typography: Space Grotesk 700 lowercase −0.03em wordmark · Geist −0.035em UI/display · Geist Mono `'tnum' 1,'zero' 1` data/inputs/labels. Self-hosted via next/font/google (no CDN at runtime).
Components: card = rounded-2xl + blur(20px) + hairline + shadow `0 4px 24px -1px rgba(0,0,0,.6)`; nav = segmented pill (#0D0E12 p-1 rounded-xl; items px-3 py-1.5 rounded-lg slate→white); tables mono text-xs, head uppercase tracking-wider border-b white/10, body divide-white/5, numerics right; stat block label text-[11px] mono uppercase slate / value text-3xl font-extrabold tracking-tight mono; inputs bg-#0D0E12 border-white/15 rounded-lg px-3.5 py-2.5 font-mono focus:border-white PLUS focus-visible ring policy (a11y override of DAGR's bare focus:border).
Logo/favicon: adopt Tri-Node Euclidean DAG SVGs verbatim (BRAND.md §5) as brand mark baseline.
Killed: NebulaBackground + three.js dep; Elias-Thorne tokens deleted (not migrated); no toast lib (inline banners); calendar virtualization (unnecessary ≤~480 entries/mo).

## 2. Decided ledger (post-cross-attack)

- D1 tokens: fresh Tailwind v4 @theme authored new on engine (veto-able A1); geometry literal utilities.
- D2 fonts via next/font/google (build-time self-host; GHA has network).
- D3 primitives: TitaniumCard, StatBlock, PageHeader, Button(solid-white primary/ghost/red-destructive), TableShell, EmptyState (+inline error banner pattern).
- D4 nav adds Schedules + Pipeline links.
- D5 schedules editor UX: 24-hour chip grid, IANA select w/ validation, daily-cap stepper, blackout dates list, pause toggle. Pipeline month view: desktop 7-col grid w/ status-tinted chips; mobile stacked day lists. Builder: single-route 3-step stepper (scope→policy→diff→generate).
- D6 motion .2s ease border/shadow/color only; useFormStatus pending states.
- X3 amber = warnings/live indicators ONLY.
- A1(entry): `{id:"${accountId}:${localDate}:${localHour}", accountId, date local, hour local, templateId?, categoryId?, status planned|published|failed|skipped}` — NO stored UTC (X4 conceded; runner derives UTC via Intl at exec).
- A1(storage): `data/pipeline/YYYY-MM.json` `{month, seed, generatedAt, entries[]}` — merge surface small, old months immutable.
- A2 generator: even-spaced subset of postingHoursLocal under dailyCap (order-preserving); template round-robin hash-seeded by account+month; category day-index rotation over categoryFocus; seed persisted. DST: skip nonexistent local hours; fall-back = first occurrence. Intl.DateTimeFormat ONLY for tz math.
- A3 binding-lite: runner reads current-month file, executes due entries; absent file → legacy ad-hoc fallback.
- A4 statuses collapse to planned/published/failed/skipped (no 'scheduled'; nothing transitions it).
- A5 regen rule: skip existing ids ANY-status; add only new slots; never mutate executed rows (X6 refined).
- A6 concurrency: octokit putFile sha-precondition; conflict → reload banner; GHA never writes config JSON (app.db + images only).
- A7 migration: Account zod gains OPTIONAL defaulted fields → old accounts.json loads unchanged.
- A8 e2e: @playwright/test in apps/web/e2e; config webServer dev :3100; env overrides DATABASE_PATH/DATA_DIR tmp fixtures; DASHBOARD_LOCAL_FS=1 mock-writer seam (prod build throws if set — security guard); auth setup-project storageState w/ test cred-hash env; committed fixtures.
- G1 templates honesty: code-defined templates stay read-only; "management" = per-account enabledTemplates[] editor via optional Account field (X5 swap from settings.json idea).
- G3 hosting: Vercel free PRIMARY (server actions/node routes native); GH Pages rejected static-only; CF Pages documented escape-hatch only.
- S1-S4 security: PAT fine-grained Contents:RW this-repo only; secrets never rendered; saves debounced-by-design (one action=form save); storageState test creds from env only.
- F additions: kill-switch paused-all honored by runner early-exit; freshness/deploy-lag badge; git-history "last edited" surfacing; CI e2e PR gate (.github/workflows/e2e.yml); seed/demo script; styled 404/error.tsx; LEARNINGS entry for provider-flake lesson; plan.md §11 visual open-item RESOLVED by user directive 2026-08-23.

## 3. Phases P0–P9 (commit titles + gates in chat transcript 2026-08-23)

P0 persist plan/ledger → P1 e2e scaffold+seam+auth fixture → P2 design system core (tokens/fonts/primitives/nav/logo, kill Nebula) → P3a overview+accounts · P3b categories+templates(enabledTemplates) · P3c preview+history → P4 schedule domain pure logic + property tests (Intl-only, DST cases Pacific/Auckland, leap, UTC+13) → P5 schedules editor UI → P6 pipeline engine wiring (generate/regen actions; runner bind + status→app.db + legacy fallback + kill-switch) → P7 pipeline viewer + builder UI → P8 Vercel deploy + ops docs + freshness badge → P9 full e2e matrix + CI gate + 404/error + DoD closeout.
Parallel: P4 ∥ P2/P3; P6 ∥ P5; P8 after P1; P9 last.
Out of scope: template codegen CRUD, dispatch-from-dashboard(v2), toasts, charts, GH Pages/CF, multi-user auth, virtualization.

## 4. User veto-list (silent defaults if no response)

A1 Tailwind-v4 engine kept (vs vanilla CSS) · A2 templates mgmt = enable/disable, not codegen CRUD · A3 binding-lite pipeline · A4 dashboard-triggered GHA runs deferred v2 · A5 Vercel-only v1.

## 5. Handoff notes for any picking-up agent

- Start at the first phase WITHOUT a matching titled commit on main.
- Read apps/web/app/globals.css BEFORE P2: current Elias-Thorne tokens get deleted there.
- Mock-writer seam contract: server actions import writer from lib/writer.ts; never octokit directly.
- Never store UTC in pipeline entries; derive with Intl at use-site.
- Test ids: data-testid required on all interactive elements (e2e contract).
- Update THIS file's status line after each phase; keep commit titles exact.

# Reality map — tools, skills, fallbacks, inventory

> Referenced from `AGENTS.md`. Load this file when you need to check tool availability, install a hook, or update the inventory — not on every task.

## 3.1 Preferred tools vs this workspace

Agents **must** check availability before requiring a tool. If unavailable, use the fallback. **Do not** write "used codegraph" if you grepped.

| Need | Preferred | Fallback (MANDATORY if preferred missing) | Forbidden |
|---|---|---|---|
| Understand this repo | `codegraph` / project index | `rg` + read files + list dirs; map blast radius by hand | Inventing module structure |
| Library docs | `context7` | Official docs via web/firecrawl; pin version from lockfile | Memorized API signatures |
| Real-world usage | `grep.app` | GitHub/web search + cite URL | "Typically people do X" with no source |
| Types / diagnostics | LSP / `tsc` / `mypy` / etc. | Run the project's typecheck CLI; if none, state **UNVERIFIED** and ask to add | Claiming types clean without running anything |
| Lint/format | project linter | Run whatever exists; if none at L0, match neighboring files exactly | Reformatting the whole repo |
| Unit tests | project test runner | Add minimal runner only if user asked to scaffold; else write tests and say they are **not executable yet** | "Tests pass" with no command output |
| Static slop/security | `semgrep` (rules in `docs/SLOP.md` appendix) | Run the `rg` scan below ("Opt-in manual check"), then eyeball the rest of `docs/SLOP.md` that isn't greppable; list findings | Ignoring slop patterns because semgrep isn't installed |
| Mutation | Stryker / mutmut | At L0/L1: expand failure-matrix tests (`docs/TESTING.md`); **do not invent** a mutation score | Fabricating ≥85% |
| Skeptic panel | 3 models + `docs/REVIEW.md` personas | **Single-agent** run of all three persona checklists yourself; file findings | "Panel approved" with no checklist |
| External research | firecrawl / web search | State knowledge cutoff; ask user for source | Confident outdated claims |

## 3.2 Skills — truth over branding

Some skills named below may **not be loadable in this session** even if installed globally on the user's machine — MCP/skill wiring is per session/config, not guaranteed by "installed on the machine." Check the session's actual skill listing first (§3.5 below). Use a skill only if it's loadable there; otherwise use the fallback, and do not claim you ran a skill you didn't.

| Discipline | Preferred skill (use only if loadable this session) | Fallback if not loadable |
|---|---|---|
| Strict typing / no `any` | `/programming` | AGENTS.md §11 hard blocks + match repo |
| TDD | `/tdd` | `docs/WORKFLOW.md` step 4 |
| Anti-slop cleanup | `/remove-ai-slops` — run at workflow SLOP PASS step | `docs/SLOP.md` patterns + `rg`/semgrep scan (§3.5 below) |
| Context/memory-file compression | `/caveman-compress` — run when memory/companion files grow large enough to crowd context | Manually trim to essentials; keep volatile facts in §3.5 below, not scattered inline |
| Ship/deploy | `/land-and-deploy` — only when the user has explicitly asked to ship (never deploy unasked — AGENTS.md hard block §11.5) | Manual deploy steps the user provides; do not invent a deploy pipeline |
| Over-engineering / YAGNI | `/ponytail-review` or `/ponytail-audit` | Run the decision ladder manually (`docs/WORKFLOW.md`, "Decision ladder") |
| Design / interface | `/design-an-interface` / `/codebase-design` | Ask for plan; keep surface small |
| Review | — | `docs/REVIEW.md` personas + DoD (AGENTS.md §9) |
| Debug | — | Hypothesis → minimal repro → fix root cause; no shotgun edits |

Record actual skill paths in §3.5 below when discovered. Do not copy fantasy skill lists into commit messages.

## 3.3 Git hook scope (check before installing any hook)

Only relevant if the user explicitly asked for commit-time enforcement (AGENTS.md §0, hard block §11.14).

Check whether the repo is a git worktree: `git rev-parse --git-common-dir` differs from `--git-dir`, or `.git` is a file (not a directory) pointing elsewhere. Git hooks live in the **shared** `.git/hooks/` at the common repo dir — a hook installed from one worktree fires in every worktree of that project, including branches you were never asked to touch.

If it's a worktree:

- Tell the user explicitly which other worktrees/branches will be affected before writing anything.
- Default to a **local, opt-in, checked-in script** (not a live hook) unless the user confirms they want the shared hook.
- Never install a shared hook on unstated inference that "enforcement" implicitly means "hook" — a script the user runs on demand satisfies the ask unless they specifically said commit-time enforcement.

Full rule: AGENTS.md hard block §11.15.

## 3.4 Runnable command stubs (fill when code exists)

Until a real stack is chosen, agents **must not** invent package scripts. When a stack exists, replace stubs below and run **those**.

| Gate | Example commands (illustrative only) |
|---|---|
| G1 | `npx tsc --noEmit` / `mypy .` / `go test ./...` (type-related) |
| G2 | `npm run lint` / `ruff check` / `golangci-lint run` |
| G3 | `npm test` / `pytest` / `go test ./...` |
| G4 | `semgrep --config <path-to-docs/SLOP.md-appendix-rules>` |
| G5 | `npx stryker run` / `mutmut run` (L2+) |
| G6–G7 | Procedural; attach checklist results |

```text
G1_TYPE=
G2_LINT=
G3_TEST=
G4_SEMGREP=
G5_MUTATION=
```

**Critical**: Paste command + exit code + relevant tail of output into the task summary. "All good" is not evidence.

## 3.5 Toolchain inventory (living section — update in place)

> Nothing below is true until verified in *this* environment, this session. Do not invent versions. Re-verify per session — presence is host-dependent, not repo-dependent, and does not carry over from a prior session or a different machine even if the user says a tool is "installed globally."

**Defaults on a fresh paste (only two rows with a real starting value):**

| Item | Value | Change only by |
|---|---|---|
| Maturity level | **L0** | Deliberate edit to `AGENTS.md` §0 |
| Enforcement mechanism (hooks/CI/PR template) | **Partial**: `.claude/settings.json` has 2 PreToolUse hooks (destructive-git block, type-suppression block) covering hard blocks §11.1 and §11.11 only. Everything else in §11 is still honor-system. Verify the hooks are actually active this session (they need a `/hooks` reload or restart after being added — check before assuming they fired) | Explicit user ask (hard block §11.14) |

**Everything else — verify before relying on, then replace this checklist item with what you found (tool, invocation, date, how verified):**

- [ ] Application code / package manifest — present? (if absent: docs/playbook repo only)
- [ ] CI (GitHub Actions / other) — present? (don't claim green without checking)
- [ ] Pre-commit hooks / `.claude/settings.json` hooks — present? (see §3.3 before installing any)
- [ ] `codegraph` MCP — loadable this session? Fallback: `rg` + read (§3.1)
- [ ] `context7` MCP — loadable? Fallback: official docs URL (§3.1)
- [ ] `grep.app` — loadable? Fallback: web search + cite (§3.1)
- [ ] `rg` (ripgrep) — on `$PATH`? Canonical §3 fallback tool
- [ ] `semgrep` — on `$PATH`? Rules in `docs/SLOP.md` appendix; only claim G4-automated if it runs
- [ ] LSP / typechecker, test runner — depends on stack; N/A if no app
- [ ] Mutation tool (Stryker/mutmut) — L2+ only, after a baseline exists
- [ ] Skeptic multi-model panel — available? Fallback: solo `docs/REVIEW.md` personas
- [ ] Skills: `/remove-ai-slops`, `/caveman-compress`, `/land-and-deploy` — loadable this session? Wired into workflow at §3.2 above / `docs/WORKFLOW.md`
- [ ] `ponytail` (`/ponytail-review`, `/ponytail-audit`, etc.) — loadable? Source: https://github.com/DietrichGebert/ponytail — its decision ladder is incorporated into `docs/WORKFLOW.md` regardless of skill availability
- [ ] DOX — not a loadable tool, a markdown convention. Source: https://github.com/agent0ai/dox — dormant until the L0→L1 trigger; see `docs/DOX.md`
- [ ] T2/T4 model pins — record here once chosen; roles defined in `docs/GATES.md` §5, names rot

### Opt-in manual check (not auto-installed, not a hook)

No hook or CI runs this unless you've explicitly wired one (check `.claude/settings.json`). It exists so a human or agent can spot-check slop patterns by hand at any time, without scaffolding CI/hooks (hard block §11.14). Run in the repo root:

```bash
rg -n --type-add 'code:*.{js,ts,tsx,py,go}' -t code \
  -e '\bas any\b' -e '@ts-ignore' -e '@ts-expect-error' \
  -e 'catch\s*\([^)]*\)\s*\{\s*\}' -e 'except\s*:\s*$' \
  -e '==\s*true\b' -e '===\s*true\b'
```

Zero matches is not proof of zero slop — it only covers the greppable subset of `docs/SLOP.md`. Widen the pattern list as new recurring patterns show up in `docs/LEARNINGS.md`; do not treat this as a substitute for G4/semgrep once a real stack exists.

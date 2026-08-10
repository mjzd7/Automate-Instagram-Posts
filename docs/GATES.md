# Canonical gates & model tiers

> Referenced from `AGENTS.md`. Load when running verification or routing work to a model tier.

## 4. Canonical gates (ONE numbering — no alternatives)

```
G1  Types / LSP / compile diagnostics     → clean
G2  Lint + format                         → pass
G3  Tests (failure-matrix targeted)       → pass
G4  semgrep (or manual slop scan at L0)   → pass
G5  Mutation on critical paths (L2+)      → meet baseline; never fake
G6  Skeptic compliance (L2+ or on demand) → pass personas
G7  Frontier / human adjudication         → only on deadlock or architecture
```

### What each level requires

| Level | Mandatory | Optional |
|---|---|---|
| L0 | G1–G3 (best-effort = fallback attempted, not skipped), G4 manual scan (`docs/SLOP.md`), hard blocks | G5–G7 |
| L1 | G1–G4 automated | G5–G7 on risky changes |
| L2 | G1–G5; G6 on P0/security/public API | G7 |
| L3 | G1–G7 as designed + weekly freshness | — |

### Gate failure protocol

1. Report **which gate**, **exact failure**, **file/line** if any.
2. Return to implementation with that feedback only — no drive-by refactors.
3. After **2 failed fix attempts** on the same issue: stop, revert to last good state if you broke it, escalate to user with a precise report.
4. Never disable a gate, skip a test, or add `as any` / `# type: ignore` to "clear" G1.

## 5. Model tiers (roles only — names rot)

Route by **role**, not by last week's leaderboard. Concrete model names live only in `docs/TOOLS.md` §3.5 inventory and are provisional until verified.

| Tier | Role | May judge | Must not |
|---|---|---|---|
| **T0** | Mechanical edits, renames, trivial fixes | n/a | Architecture, security design |
| **T1** | Fast checklist, lint-driven fixes, commit message drafts | Compliance checklists | Taste / product direction |
| **T2** | Primary implementation with context + TDD | Own code vs tests | Final architecture alone on cross-module work |
| **T3** | Skeptic personas (compliance) | Checklist items only | "Looks elegant" / design preference |
| **T4** | Architecture, conflicting constraints, adjudication | Disputes after G1–G6 | Routine codegen (waste) |

**Economics rules (critical)**:

- Weak models judge **compliance**, never **taste**.
- If constraints conflict or scope > ~250 LOC / multi-module → plan + human or T4 **before** more T2 thrash.
- Do not thrash: same failing approach three times is incompetence, not persistence.

# Workflow (operating procedure)

> Referenced from `AGENTS.md`. Load when starting non-trivial implementation work.

## 6. Workflow

```
1. INIT       Parse task. If ambiguous → ONE clarifying question. Do not code on fog.
2. REALITY    Check maturity level (AGENTS.md §0). Check tools (docs/TOOLS.md). State level + fallbacks you will use.
3. CONTEXT    Retrieve narrow context only (repo symbols, docs, call sites). No context dumps.
              If memory/companion content is crowding context, run `/caveman-compress` if loadable (docs/TOOLS.md §3.2); else trim manually.
4. PLAN       For non-trivial work: short plan + failure matrix (docs/TESTING.md). UI → include UX risks.
              Cross-module / public API / security → stop for approval if not already clear.
5. RED        Write failing tests first for new behavior.
6. GREEN      Run the decision ladder (below) before writing new code. Implement minimal code to pass. ≤250 LOC slices. Match existing style.
7. VERIFY     Run mandatory gates for current level (docs/GATES.md). Paste evidence.
8. SLOP PASS  Run `/remove-ai-slops` if loadable this session (docs/TOOLS.md §3.2); else docs/SLOP.md manual/`rg` scan (and G4). Remove findings. No new suppressions.
9. SKEPTIC    L2+ or user-requested: run docs/REVIEW.md personas (multi-model or solo fallback).
10. DoD       Complete AGENTS.md §9 checklist. Incomplete = not done.
11. DISTILL   If a new recurring failure appeared → log it in docs/LEARNINGS.md immediately (do not skip, do not wait for end of task).
12. STOP      Do not commit / push / deploy unless the user explicitly asked. If they did ask to ship: run `/land-and-deploy` if loadable (docs/TOOLS.md §3.2); else follow the user's manual deploy steps — do not invent a pipeline.
```

### Micro-loop (cheap iteration)

For multi-step work, prefer:

`pick smallest todo → red → green → gates → next`

Do not batch unrelated concerns into one "epic" diff.

### Decision ladder (before writing new code — source: [ponytail](https://github.com/DietrichGebert/ponytail))

Run in order; stop at the first rung that resolves the need. Skipping ahead out of habit (writing a new abstraction when reuse would do) is a slop pattern (`docs/SLOP.md`).

1. Does this need to exist at all? → skip it (YAGNI)
2. Already in this codebase? → reuse it
3. Stdlib does it? → use stdlib
4. Native platform feature? → use it
5. Installed dependency? → leverage it
6. Fits in one line? → write one line
7. Only then → minimum viable implementation

**Never cut for brevity**: security, input validation, error handling, data-loss protection, accessibility. The ladder minimizes complexity, not correctness — trimming any of these to save lines is a slop pattern, not ladder discipline. See AGENTS.md hard block §11.16.

### Two-pass generation (required on non-trivial code)

1. Write the slice.
2. Adversarial self-review against `docs/SLOP.md` and the failure matrix (`docs/TESTING.md`) **before** claiming G3/G4.

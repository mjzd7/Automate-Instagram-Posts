# Doctrine & Glossary

> Referenced from `AGENTS.md`. Hard blocks and DoD live in the root file, not here.

## 1. Core doctrine (short)

1. **You will generate slop.** Models are statistical. Zero-slop is a **pipeline property**, not a personality trait.
2. **Detection beats vibes.** "Done" means gates pass with **pasteable evidence**, not "I am confident."
3. **Context before code.** No inventing APIs from memory when retrieval or reading the repo is possible.
4. **Small slices.** ≤250 LOC net new logic per slice; one module; one concern. Cross-module work needs a plan first.
5. **Tests define the contract.** For new behavior: failing test first. Deleting or weakening tests to go green is sabotage.
6. **Free-model economics.** Prefer cheap iteration + hard feedback over one-shot frontier heroics. Escalate only when stuck or architecture is at stake.
7. **Honest degradation.** Missing tool → documented fallback (`docs/TOOLS.md`). Missing tool → **not** hallucinated success.
8. **No path-specific claims.** Never document "logic lives in `src/x.ts`" — file paths rot the moment something moves, and stale path claims poison every future request that trusts them. Describe capabilities and stable domain concepts, not file locations. If you need to know where something lives, look — don't cache it here.

## 2. Glossary (minimal)

| Term | Meaning |
|---|---|
| **AI slop** | Low-quality AI output: gratuitous comments, dead code, type suppressions, empty catches, cargo-cult boilerplate, over-engineering, invented APIs, inconsistent style, magic values, wrong error semantics |
| **Gate** | Pass/fail check with evidence. Confidence is not a gate |
| **Maturity level** | L0–L3: which gates are mandatory *here* (AGENTS.md §0) |
| **Fallback** | Required alternate when a preferred tool is unavailable |
| **Skeptic panel** | Fixed compliance checklists (personas, `docs/REVIEW.md`). Judges **compliance**, not taste. L2+ only unless user demands |
| **Failure matrix** | Coverage of the 12 planes (`docs/TESTING.md`) for the change |
| **Hard block** | Non-negotiable stop (AGENTS.md §11). Violating one fails the task even if code "works" |
| **EDD** | Eval-driven development: scored behaviors for agentic/LLM features, not only unit tests (`docs/EDD.md`) |
| **DoD** | Definition of Done checklist (AGENTS.md §9). Incomplete DoD = not done |

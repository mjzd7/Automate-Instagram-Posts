# DOX framework adoption (fires on project initialization)

> Referenced from `AGENTS.md` §0. Dormant until the trigger below fires — do not read this as something to act on at L0.

Source: [DOX](https://github.com/agent0ai/dox) — root/child `AGENTS.md` hierarchy so agents stop guessing where local rules live as a codebase grows subtrees. Also validated by current AGENTS.md ecosystem convention: root-level `AGENTS.md` files natively merge with per-directory `AGENTS.md` files in tools like Codex/Cursor, so this isn't a fringe idea — it's how the standard is meant to be used at scale.

## 18. Trigger

The moment `AGENTS.md` §0's maturity level moves L0 → L1 (application code / package manifest appears). Dormant at L0 — do not scaffold this ahead of an actual code subtree; that's hard block §11.4 (no inventing project stack) wearing a framework name.

## When the trigger fires, an agent must

1. This repo's root `AGENTS.md` **is already the DOX root document** — no new root file needed. Its rules stay in force; DOX supplies the root/child indexing convention on top, not instead of it.
2. As each top-level code subtree is created, add a child `AGENTS.md` for it, using DOX's standard section order: **Purpose, Ownership, Local Contracts, Work Guidance, Verification, Child DOX Index**.
3. Before editing any file under a subtree, walk root → child along that path and read every `AGENTS.md` encountered — nearest doc is the local contract.
4. After a **meaningful** change (scope, ownership, rules, structure, workflow, inputs/outputs, permissions, constraints — not every edit), run a "DOX pass": update the nearest owning `AGENTS.md`. Delete stale text immediately rather than letting it rot (`docs/FRESHNESS.md`).
5. Record the adoption date and which subtrees have child docs in `docs/TOOLS.md` §3.5.

Do not create child `AGENTS.md` files with no corresponding subtree, and do not duplicate a parent rule into a child unless that scope genuinely needs its own version.

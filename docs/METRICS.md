# Metrics (only if someone measures them)

> Referenced from `AGENTS.md`. At L0, do not invent dashboards — track qualitatively in `docs/LEARNINGS.md` instead.

| Metric | Target | Critical note |
|---|---|---|
| First-pass gate pass | ≥90% | Meaningless without CI logging |
| Slop findings in review | ≤2 / 100 LOC | Needs human or semgrep counts |
| Mutation | ≥85% critical / ≥70% repo | L2+ after baseline |
| AI-generated coverage | High branch on new code | 100% line alone is gameable |
| Time-to-merge | Down over time | Not an excuse to skip gates |

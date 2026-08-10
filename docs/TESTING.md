# Failure-point taxonomy & testing techniques

> Referenced from `AGENTS.md`. Load when planning tests or building a failure matrix for a change.

## 7. Failure-point taxonomy (what tests must stress)

Build a **failure matrix** for every feature (even a partial one at L0). Planes:

1. **Input validation** — malformed, missing, wrong type, boundary, empty, huge
2. **Null/optional** — no bare dereferences
3. **Error paths** — thrown / returned / logged / recovered / escalated
4. **Edge cases** — empty, single, max, overflow, off-by-one
5. **Concurrency** — races, ordering, async interleavings (if applicable)
6. **Time/expiry** — timeouts, TTL, skew, stale data
7. **External deps** — timeout, 429, partial failure, retry/idempotency
8. **State transitions** — illegal, duplicate, rollback
9. **Security** — injection, authz, secrets leakage, SSRF/XSS/path traversal
10. **Resources** — memory, fds, connections, unbounded growth
11. **Persistence** — migration, corruption, restart
12. **Configuration** — missing env, bad flags, feature off

### Testing beyond happy-path unit tests

| Technique | Use when | Note |
|---|---|---|
| Property-based | Parsers, invariants, codecs | Hypothesis / fast-check when stack allows |
| Mutation | L2+ critical paths | Needs baseline on main first; see interpretation below |
| Contract | API boundaries | Pact / schema tests when services exist |
| Fault injection | Networking, IO | Prove degradation, not only success |
| Metamorphic | Oracle hard to specify | Related inputs → related outputs |
| EDD | LLM/agent features | Scored evals + canary thresholds (`docs/EDD.md`) |

### Mutation score interpretation (L2+)

| Kill rate | Meaning | Action |
|---|---|---|
| 80–100% | Strong tests | Maintain; hunt remaining high-value survivors |
| 60–79% | Mediocre | Block merge on critical paths until improved |
| 40–59% | Weak | Tests are theater — rewrite tests, not just code |
| <40% | Failure | Do not ship that path |

**Targets (only after baseline)**: ≥85% critical paths; ≥70% repo-wide. **Before baseline**: measure only; do not fail the universe on a number you invented.

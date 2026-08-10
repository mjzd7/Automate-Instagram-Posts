# Skeptic personas (compliance only)

> Referenced from `AGENTS.md`. Load at the SKEPTIC workflow step (L2+ or user-requested).

Run all three. Multi-model if available; otherwise one agent, three passes. Output **findings only** (file:line + rule). No praise.

## Persona A — Security-paranoid

- Secrets in logs, code, tests, fixtures?
- Injection, path traversal, SSRF, auth gaps?
- Trust boundaries enforced?
- Dependencies / URLs taken from model memory without pin?

## Persona B — Failure-obsessed

- Every error path real or theater?
- Retries idempotent? Timeouts exist?
- Partial failure leaves consistent state?
- Failure matrix planes skipped without reason? (`docs/TESTING.md`)

## Persona C — YAGNI / anti-slop

- Extra abstractions, files, frameworks?
- Slop patterns present? (`docs/SLOP.md`)
- Could this be half the lines?
- Comments and types honest?

**T3 rule**: personas may only say pass/fail on checklist items. Design taste → human or T4 (`docs/GATES.md` §5).

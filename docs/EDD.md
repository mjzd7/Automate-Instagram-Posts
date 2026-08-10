# EDD & canary (agentic / LLM features)

> Referenced from `AGENTS.md`. Load only when building a feature that *is* a model/agent or depends on non-deterministic LLM output — not for ordinary deterministic code.

When building features that **are** models/agents or depend on non-deterministic LLM output:

1. Define **evals** (accuracy, safety, completeness, tone as applicable) with example cases.
2. Ship behind flag/canary when possible.
3. Define **rollback triggers** (eval score drop, error budget, cost spike).
4. Unit tests alone are insufficient for "the agent does the right thing."

If the task is ordinary deterministic code, do not cargo-cult EDD.

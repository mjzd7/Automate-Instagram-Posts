# Slop patterns & semgrep appendix

> Referenced from `AGENTS.md`. Load during the SLOP PASS workflow step or when running G4.

## 8. Twelve slop patterns (detect every time)

1. Gratuitous comments that restate code
2. Dead code / zombie imports
3. Type suppression (`as any`, `@ts-ignore`, bare `unwrap`/`panic` in prod paths)
4. Empty or meaning-free catch/except
5. Cargo-cult boilerplate
6. Over-engineering (abstractions for imaginary futures)
7. Invented APIs / wrong signatures
8. Inconsistent style vs neighbors
9. Verbose doubled logic (`== true`, redundant branches)
10. Wrong error semantics (swallow, log-and-continue, wrong status)
11. Magic numbers/strings without names
12. Comment/abstraction density alien to the project

Map to automation: appendix rules below (G4). If semgrep missing, run the `rg` scan in `docs/TOOLS.md` §3.5 for the greppable patterns (3, 4, 9), then a manual read-through with file:line notes for the rest.

## Appendix: starter semgrep rules (opt-in, not auto-installed)

These rules are **not** written to disk automatically — that would be scaffolding (AGENTS.md hard block §11.14). If you want machine-runnable semgrep, save this block yourself as `.semgrep/slop-rules.yml` (or wherever your project keeps config) after the user confirms they want it installed.

```yaml
# Starter slop / foot-gun rules for G4.
# Refine per language. Run only when the semgrep binary exists and maturity >= L1.
# At L0, use the manual docs/TOOLS.md §3.5 `rg` scan instead.
#
# semgrep --config .semgrep/slop-rules.yml

rules:
  - id: ai-slop-empty-catch-js
    message: Empty catch block swallows errors (slop pattern 4).
    languages: [javascript, typescript]
    severity: ERROR
    pattern: catch ($E) {}

  - id: ai-slop-empty-except-python
    message: Bare/empty except swallows errors (slop pattern 4).
    languages: [python]
    severity: ERROR
    pattern: |
      except $E:
          pass

  - id: ai-slop-as-any-ts
    message: Type suppression via as any (slop pattern 3). Hard block.
    languages: [typescript, tsx]
    severity: ERROR
    pattern: $X as any

  - id: ai-slop-ts-ignore
    message: "@ts-ignore / @ts-expect-error suppresses types (slop pattern 3)."
    languages: [typescript, tsx]
    severity: ERROR
    pattern-regex: "@ts-(ignore|expect-error)"

  - id: ai-slop-eq-true
    message: Redundant boolean comparison (slop pattern 9).
    languages: [javascript, typescript, python]
    severity: WARNING
    pattern-either:
      - pattern: $X == true
      - pattern: $X === true
      - pattern: $X == True
      - pattern: $X is True
```

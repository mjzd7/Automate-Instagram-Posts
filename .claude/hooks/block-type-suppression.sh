#!/usr/bin/env bash
# PreToolUse hook on Write/Edit. Enforces AGENTS.md hard block 11.1 (no type-safety
# theater). Checks the content actually being written, not the whole file.
set -euo pipefail
input="$(cat)"
content="$(printf '%s' "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')"

if printf '%s' "$content" | grep -qE '\bas any\b|@ts-ignore|@ts-expect-error'; then
  echo "Blocked by AGENTS.md hard block 11.1: found a type-suppression pattern in the content being written. Fix the underlying type issue instead of suppressing it." >&2
  exit 2
fi

exit 0

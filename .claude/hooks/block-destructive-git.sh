#!/usr/bin/env bash
# PreToolUse hook on Bash. Enforces AGENTS.md hard block 11.11 (no destructive git
# without explicit user ask). Backstop only -- the agent still asks first per the contract.
set -euo pipefail
input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"

if printf '%s' "$cmd" | grep -qE '(^|[;&|]) *git +push +(--force|-f)\b'; then
  echo "Blocked by AGENTS.md hard block 11.11: git push --force/-f is destructive git. If the user explicitly asked for this, run it outside Claude Code or confirm explicitly with the user in-chat and retry." >&2
  exit 2
fi
if printf '%s' "$cmd" | grep -qE '(^|[;&|]) *git +reset +--hard\b'; then
  echo "Blocked by AGENTS.md hard block 11.11: git reset --hard is destructive git. If the user explicitly asked for this, run it outside Claude Code or confirm explicitly with the user in-chat and retry." >&2
  exit 2
fi
if printf '%s' "$cmd" | grep -qE '(^|[;&|]) *git +clean +-[a-zA-Z]*f'; then
  echo "Blocked by AGENTS.md hard block 11.11: git clean -f is destructive git. If the user explicitly asked for this, run it outside Claude Code or confirm explicitly with the user in-chat and retry." >&2
  exit 2
fi

exit 0

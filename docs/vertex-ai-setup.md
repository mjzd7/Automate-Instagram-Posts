# Vertex AI Setup - Agent Configuration & Billing Tags

## Overview
This document describes how to configure all coding agents (OpenCode, Codex, Aider) to use Google Cloud Vertex AI through a local proxy, with per-agent billing tags for cost tracking.

## Architecture

```
Agent (OpenCode/Codex/Aider)
    │
    │  X-Agent-Name: <agent-name>
    │  X-Billing-Tag: agent:<agent-name>
    ▼
Local Proxy (vertex-proxy on :8899)
    │
    │  Injects fresh gcloud access token
    │  Transforms Responses API → Chat Completions (if needed)
    ▼
Vertex AI (Gemini models)
    │
    │  Billing tracked via X-Billing-Tag header
    ▼
GCP Project: freellmapi-live
    ├── Labels: agent=tracked, agent-codex=codex, agent-aider=aider, agent-opencode=opencode
    └── Usage tracked in: ~/.config/vertex-proxy/usage.jsonl
```

## Prerequisites

1. **Google Cloud Setup** (already completed):
   - Project: `freellmapi-live`
   - Vertex AI API enabled
   - ADC credentials configured

2. **Vertex Proxy Running**:
   ```bash
   ~/.local/bin/vertex-proxy &
   ```
   - Listens on `http://127.0.0.1:8899`
   - Config: `~/.config/vertex-proxy/config.env`

## Agent Configuration

### 1. OpenCode

**File**: `~/.config/opencode/opencode.json`

```json
{
  "provider": {
    "vertexAI": {
      "name": "Vertex AI (Gemini)",
      "options": {
        "baseURL": "http://127.0.0.1:8899",
        "apiKey": "local",
        "headers": {
          "X-Agent-Name": "opencode",
          "X-Billing-Tag": "agent:opencode"
        }
      }
    }
  }
}
```

**Models**: `google/gemini-2.5-pro`, `google/gemini-2.5-flash`, `google/gemini-2.5-flash-lite`

### 2. Codex

**File**: `~/.codex/config.toml`

```toml
# vertex-ai:start
[model_providers.vertex-ai]
name = "Vertex AI (GCloud $300 trial)"
base_url = "http://127.0.0.1:8899"
wire_api = "responses"
env_key = "VERTEX_PROXY_KEY"
requires_openai_auth = false
extra_headers = { "X-Agent-Name" = "codex", "X-Billing-Tag" = "agent:codex" }
# To switch: codex -c model_provider=vertex-ai -c model=google/gemini-2.5-pro
# vertex-ai:end
```

**Important**: Codex uses `wire_api = "responses"` which the proxy transforms to `/chat/completions`.

### 3. Aider

**File**: `~/.aider.conf.yml`

```yaml
# vertex-ai:start — uses local vertex-proxy on :8899 with agent billing tag
vertex-ai:
  api-base: "http://127.0.0.1:8899"
  model: "google/gemini-2.5-pro"
  headers:
    X-Agent-Name: "aider"
    X-Billing-Tag: "agent:aider"
  api-key: "${VERTEX_PROXY_KEY:-local}"
  temperature: 0.7
  max-tokens: 4096
# vertex-ai:end
```

**Note**: Aider uses the OpenAI-compatible API format, so no transformation needed.

## Model Name Format

Vertex AI models must be referenced with the `google/` prefix:
- ❌ `gemini-2.5-pro`
- ✅ `google/gemini-2.5-pro`

## Billing Tags

All agents send these headers for per-agent cost tracking:

| Agent     | Header Value          | Billing Tag        |
|-----------|-----------------------|--------------------|
| OpenCode  | `X-Agent-Name: opencode` | `agent:opencode`   |
| Codex     | `X-Agent-Name: codex`    | `agent:codex`      |
| Aider     | `X-Agent-Name: aider`    | `agent:aider`      |
| Claude    | (deprioritized)        | `agent:claude`     |

## Usage Tracking

Usage is logged to `~/.config/vertex-proxy/usage.jsonl`:

```json
{
  "ts": "2026-08-14T21:56:36.064399Z",
  "agent": "opencode",
  "model": "google/gemini-2.5-pro",
  "path": "/chat/completions",
  "status": 200,
  "prompt_tokens": 6,
  "completion_tokens": 0,
  "total_tokens": 13
}
```

GCP Project Labels (for billing reports):
```bash
# View labels
gcloud projects describe freellmapi-live --format="value(labels)"
```

## Environment Variables

```bash
# For Aider
export VERTEX_PROXY_KEY="${VERTEX_PROXY_KEY:-local}"

# For Codex (used by proxy)
export VERTEX_PROXY_KEY="local"
```

## Troubleshooting

### Model not found errors
- Use format: `google/<model-name>` (not just `<model-name>`)
- Example: `google/gemini-2.5-pro` not `gemini-2.5-pro`

### Responses API errors
- Codex uses `/responses` endpoint which the proxy transforms to `/chat/completions`
- Check proxy logs: `tail -f ~/.local/log/vertex-proxy.log`

### Billing tags not showing
- Verify headers are being sent: `curl -s -D - ...`
- Check usage logs: `tail -f ~/.config/vertex-proxy/usage.jsonl`

## API Endpoints

| Endpoint               | Used By          | Notes                                  |
|------------------------|------------------|----------------------------------------|
| `/chat/completions`    | OpenCode, Aider  | Direct Vertex AI compatibility         |
| `/responses`           | Codex            | Transformed to `/chat/completions`     |

## Proxy Source

The proxy is at `~/.local/bin/vertex-proxy` and includes:
- Agent tracking via `X-Agent-Name` header
- Automatic gcloud token refresh
- Usage logging to `usage.jsonl`
- Responses API to Chat Completions transformation

## Quick Test Commands

```bash
# Test OpenCode
curl -s -X POST "http://127.0.0.1:8899/chat/completions" \
  -H "X-Agent-Name: opencode" \
  -H "Content-Type: application/json" \
  -d '{"model": "google/gemini-2.5-pro", "messages": [{"role": "user", "content": "Test"}], "max_tokens": 5}'

# Test Codex
export VERTEX_PROXY_KEY="local"
codex exec -c model_provider=vertex-ai -c model=google/gemini-2.5-pro "Test"

# Test Aider
aider --model vertex-ai/google/gemini-2.5-pro "Test"
```

## Notes

- Vertex AI billing is per-project, so all agents share the same billing account
- The `X-Billing-Tag` header helps identify which agent made the request
- GCP labels provide additional filtering for billing reports

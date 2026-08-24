import { createInterface } from "node:readline";
import { openReadOnlyDb } from "../db/read-only-client.js";
import { getPipelineState, type PosterToolInput } from "./poster-tool.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "poster", version: "0.1.0" };

const TOOLS = [
  {
    name: "poster_get_pipeline",
    description:
      "Returns the built posting pipeline for a month (default: next month): per-entry account/date/hour/template/category with LIVE execution statuses merged in, plus seed/generation metadata and paused/inactive accounts. Data freshness = last git push the runner made.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "string", pattern: "^\\d{4}-\\d{2}$", description: "Month as YYYY-MM; defaults to next month" },
      },
      required: [],
    } as const,
  },
];

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: unknown;
}

function result(id: JsonRpcRequest["id"], payload: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id, result: payload });
}

function error(id: JsonRpcRequest["id"], code: number, message: string): string {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

/** Pure dispatcher — unit-testable without stdio. */
export async function handleMessage(msg: JsonRpcRequest): Promise<string | null> {
  if (typeof msg.method !== "string") {
    return msg.id !== undefined && msg.id !== null ? error(msg.id, -32600, "invalid request") : null;
  }
  // Notifications (no id) never get responses.
  if (msg.id === undefined || msg.id === null) return null;

  switch (msg.method) {
    case "initialize":
      return result(msg.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "tools/list":
      return result(msg.id, { tools: TOOLS });
    case "tools/call": {
      const params = (msg.params ?? {}) as { name?: string; arguments?: PosterToolInput };
      if (params.name !== "poster_get_pipeline") {
        return error(msg.id, -32602, `unknown tool: ${String(params.name)}`);
      }
      try {
        const dbPath = process.env.DATABASE_PATH ?? `${process.env.DATA_DIR ?? "."}/data/app.db`;
        const handle = await openReadOnlyDb(dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`);
        try {
          const state = await getPipelineState(handle.db, params.arguments ?? {});
          return result(msg.id, {
            content: [{ type: "text", text: JSON.stringify(state, null, 2) }],
          });
        } finally {
          handle.close();
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        return error(msg.id, -32000, `poster_get_pipeline failed: ${message}`);
      }
    }
    default:
      return error(msg.id, -32601, `method not found: ${msg.method}`);
  }
}

export function main(): void {
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let msg: JsonRpcRequest;
    try {
      msg = JSON.parse(line) as JsonRpcRequest;
    } catch {
      process.stdout.write(`${error(null, -32700, "parse error")}\n`);
      return;
    }
    handleMessage(msg)
      .then((out) => {
        if (out !== null) process.stdout.write(`${out}\n`);
      })
      .catch((cause: unknown) => {
        process.stderr.write(`poster mcp: unhandled ${String(cause)}\n`);
      });
  });
}

if (process.argv[1]?.endsWith("mcp-server.ts") || process.argv[1]?.includes("mcp-server")) {
  main();
}

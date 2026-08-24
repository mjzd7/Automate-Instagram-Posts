import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleMessage } from "../../src/mcp/server.js";
import { getPipelineState } from "../../src/mcp/poster-tool.js";
import { openDb } from "../../src/db/client.js";

let dir: string;
let dbPath: string;

const ACCOUNTS = [
  { id: "main", igUserId: "1", fbPageId: "1", threadsUserId: null, categoryFocus: ["motivational"], timezone: "UTC", postingHoursLocal: [9], active: true },
  { id: "ghost", igUserId: "2", fbPageId: "2", threadsUserId: null, categoryFocus: ["stoic"], timezone: "UTC", postingHoursLocal: [10], active: true, paused: true },
];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "poster-mcp-"));
  process.env.DATA_DIR = dir;
  mkdirSync(join(dir, "data", "pipeline"), { recursive: true });
  writeFileSync(join(dir, "data", "accounts.json"), JSON.stringify(ACCOUNTS));
  writeFileSync(
    join(dir, "data", "pipeline", "2026-12.json"),
    JSON.stringify({
      month: "2026-12",
      seed: "2026-12:abc",
      generatedAt: "2026-08-23T00:00:00Z",
      entries: [
        { id: "main:2026-12-01:9", accountId: "main", date: "2026-12-01", hour: 9, templateId: "bold-modern", categoryId: "motivational", status: "planned" },
        { id: "main:2026-12-02:9", accountId: "main", date: "2026-12-02", hour: 9, status: "published" },
      ],
    }),
  );
  dbPath = join(dir, "app.db");
});

afterEach(() => {
  delete process.env.DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("getPipelineState", () => {
  it("returns entries with live statuses merged and account flags", async () => {
    const handle = await openDb(dbPath);
    try {
      const state = await getPipelineState(handle.db, { month: "2026-12" });
      expect(state.found).toBe(true);
      expect(state.seed).toBe("2026-12:abc");
      expect(state.counts).toEqual({ planned: 1, published: 1 });
      expect(state.pausedAccounts).toEqual(["ghost"]);
      expect(state.statusSource).toBe("file");
    } finally {
      handle.close();
    }
  });

  it("defaults to next month and reports not-found cleanly", async () => {
    const handle = await openDb(dbPath);
    try {
      const state = await getPipelineState(handle.db, {});
      expect(/^\d{4}-\d{2}$/.test(state.month)).toBe(true);
      expect(state.found).toBe(false);
      expect(state.entries).toEqual([]);
      expect(state.statusSource).toBe("none");
    } finally {
      handle.close();
    }
  });
});

describe("mcp json-rpc dispatch", () => {
  it("handshakes initialize with protocol + capabilities", async () => {
    const out = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    const parsed = JSON.parse(out!);
    expect(parsed.result.protocolVersion).toBe("2024-11-05");
    expect(parsed.result.serverInfo.name).toBe("poster");
    expect(parsed.result.capabilities.tools).toEqual({});
  });

  it("lists exactly the poster_get_pipeline tool", async () => {
    const parsed = JSON.parse((await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }))!);
    expect(parsed.result.tools).toHaveLength(1);
    expect(parsed.result.tools[0].name).toBe("poster_get_pipeline");
  });

  it("executes tools/call end-to-end over text content", async () => {
    const seed = await openDb(dbPath); // ensure app.db exists, as the runner guarantees
    seed.close();
    const prevDbPath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = dbPath;
    const parsed = JSON.parse(
      (await handleMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "poster_get_pipeline", arguments: { month: "2026-12" } } }))!,
    );
    try {
      const state = JSON.parse(parsed.result.content[0].text);
      expect(state.found).toBe(true);
      expect(state.entries).toHaveLength(2);
      expect(state.statusSource).toBe("file");
    } finally {
      if (prevDbPath === undefined) delete process.env.DATABASE_PATH;
      else process.env.DATABASE_PATH = prevDbPath;
    }
  });

  it("notifications return null and unknown methods error", async () => {
    expect(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    const err = JSON.parse((await handleMessage({ jsonrpc: "2.0", id: 4, method: "nope/nope" }))!);
    expect(err.error.code).toBe(-32601);
    const bad = JSON.parse((await handleMessage({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "other" } }))!);
    expect(bad.error.code).toBe(-32602);
  });
});

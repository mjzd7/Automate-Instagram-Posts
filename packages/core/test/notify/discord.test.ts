import { describe, expect, it, vi } from "vitest";
import { sendDiscordNotification } from "../../src/notify/discord.js";

// 204/205/304 are "null body status" per the Fetch spec -- Response
// construction throws if given a body (even "") alongside one of these.
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

function jsonResponse(status: number): Response {
  return new Response(NULL_BODY_STATUSES.has(status) ? null : "", { status });
}

describe("sendDiscordNotification", () => {
  it("posts an embed with red color for a failure notification", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(204));
    await sendDiscordNotification(
      "https://discord.com/api/webhooks/x/y",
      { title: "Batch failed", description: "details", level: "failure" },
      fetchImpl,
    );
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.embeds[0].color).toBe(15158332);
    expect(body.embeds[0].title).toBe("Batch failed");
  });

  it("posts an embed with green color for a success notification", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(204));
    await sendDiscordNotification(
      "https://discord.com/api/webhooks/x/y",
      { title: "OK", description: "all good", level: "success" },
      fetchImpl,
    );
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).embeds[0].color).toBe(3066993);
  });

  it("throws on a non-2xx response (external deps plane)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400));
    await expect(
      sendDiscordNotification("https://discord.com/api/webhooks/x/y", { title: "t", description: "d", level: "failure" }, fetchImpl),
    ).rejects.toThrow(/400/);
  });
});

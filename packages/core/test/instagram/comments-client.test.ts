import { describe, expect, it, vi } from "vitest";
import {
  deleteComment,
  fetchComments,
  getComment,
  likeComment,
  replyToComment,
  setCommentsEnabled,
  setCommentHidden,
} from "../../src/instagram/comments-client.js";
import type { IGCredentials } from "../../src/instagram/client.js";

const creds: IGCredentials = { accessToken: "test-token", igUserId: "17841400000000000" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("fetchComments", () => {
  it("GETs the media's comments edge with default fields and returns mapped rows", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [
          {
            id: "comment-1",
            text: "This is awesome!",
            timestamp: "2026-08-25T10:00:00+0000",
            username: "fan_one",
            hidden: false,
            like_count: 3,
          },
        ],
      }),
    );
    const result = await fetchComments("media-1", {}, creds, fetchImpl);
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain("/media-1/comments");
    expect(url).toContain("access_token=test-token");
    expect(url).toContain("fields=");
    expect(result.comments[0]).toEqual({
      id: "comment-1",
      text: "This is awesome!",
      timestamp: "2026-08-25T10:00:00+0000",
      username: "fan_one",
      hidden: false,
      likeCount: 3,
    });
    expect(result.nextAfter).toBeUndefined();
  });

  it("passes after/limit params through for pagination and surfaces the cursor", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [{ id: "comment-2", text: "second" }],
        paging: { cursors: { after: "CURSOR-AFTER" } },
      }),
    );
    const result = await fetchComments("media-1", { after: "CURSOR-BEFORE", limit: 25 }, creds, fetchImpl);
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain("after=CURSOR-BEFORE");
    expect(url).toContain("limit=25");
    expect(result.nextAfter).toBe("CURSOR-AFTER");
  });
});

describe("getComment", () => {
  it("GETs a single comment with fields including hidden", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { id: "c1", text: "hi", hidden: true }));
    await getComment("c1", creds, fetchImpl);
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain("/c1?");
    expect(url).toContain("fields=");
    expect(url).toContain("hidden");
    expect(url).toContain("access_token=test-token");
  });
});

describe("replyToComment", () => {
  it("POSTs the message to the comment's replies edge and returns the reply id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "reply-1" }));
    const result = await replyToComment("comment-1", "Thanks for sharing!", creds, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/comment-1/replies");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.message).toBe("Thanks for sharing!");
    expect(body.access_token).toBe("test-token");
    expect(result).toEqual({ replyId: "reply-1" });
  });
});

describe("setCommentHidden", () => {
  it("sends hide=true as a query param on POST (official contract)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { success: true }));
    await setCommentHidden("comment-1", true, creds, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(url).toContain("/comment-1?");
    expect(url).toContain("hide=true");
    expect(url).toContain("access_token=test-token");
  });

  it("sends hide=false to unhide", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { success: true }));
    await setCommentHidden("comment-1", false, creds, fetchImpl);
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain("hide=false");
  });
});

describe("deleteComment", () => {
  it("DELETEs the comment node with the access token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { success: true }));
    await deleteComment("comment-1", creds, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/comment-1");
    expect(url).toContain("access_token=test-token");
  });
});

describe("likeComment", () => {
  it("POSTs to the comment's likes edge (instagram_manage_engagement scope)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { success: true }));
    await likeComment("comment-1", creds, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(url).toContain("/comment-1/likes");
    expect(url).toContain("access_token=test-token");
  });
});

describe("setCommentsEnabled", () => {
  it("POSTs comment_enabled=false to disable comments on the media", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { success: true }));
    await setCommentsEnabled("media-1", false, creds, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(url).toContain("/media-1?");
    expect(url).toContain("comment_enabled=false");
    expect(url).toContain("access_token=test-token");
  });

  it("POSTs comment_enabled=true to re-enable", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { success: true }));
    await setCommentsEnabled("media-1", true, creds, fetchImpl);
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain("comment_enabled=true");
  });
});

describe("error propagation (external deps plane)", () => {
  // Fresh failing mock per call -- every function receives its fetchImpl
  // explicitly so nothing here can fall back to global fetch / live network.
  function failingFetch(): typeof fetch {
    return vi
      .fn()
      .mockResolvedValue(
        jsonResponse(400, { error: { message: "manage_comments permission required" } }),
      ) as unknown as typeof fetch;
  }

  it("fetchComments surfaces the Graph API error message on failure", async () => {
    await expect(fetchComments("m", {}, creds, failingFetch())).rejects.toThrow(
      /manage_comments permission required/,
    );
  });

  it("getComment surfaces the Graph API error message on failure", async () => {
    await expect(getComment("c", creds, failingFetch())).rejects.toThrow(/manage_comments permission required/);
  });

  it("replyToComment surfaces the Graph API error message on failure", async () => {
    await expect(replyToComment("c", "msg", creds, failingFetch())).rejects.toThrow(
      /manage_comments permission required/,
    );
  });

  it("setCommentHidden surfaces the Graph API error message on failure", async () => {
    await expect(setCommentHidden("c", true, creds, failingFetch())).rejects.toThrow(
      /manage_comments permission required/,
    );
  });

  it("deleteComment surfaces the Graph API error message on failure", async () => {
    await expect(deleteComment("c", creds, failingFetch())).rejects.toThrow(
      /manage_comments permission required/,
    );
  });

  it("likeComment surfaces the Graph API error message on failure", async () => {
    await expect(likeComment("c", creds, failingFetch())).rejects.toThrow(
      /manage_comments permission required/,
    );
  });

  it("setCommentsEnabled surfaces the Graph API error message on failure", async () => {
    await expect(setCommentsEnabled("m", true, creds, failingFetch())).rejects.toThrow(
      /manage_comments permission required/,
    );
  });
});

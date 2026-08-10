import { describe, expect, it, vi } from "vitest";
import {
  createThreadsContainer,
  getThreadsContainerStatus,
  publishThreadsContainer,
  publishToThreads,
  refreshThreadsToken,
  waitForThreadsContainerReady,
  type ThreadsCredentials,
} from "../../src/threads/client.js";

const creds: ThreadsCredentials = { accessToken: "test-token", threadsUserId: "17841400000000001" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const noSleep = () => Promise.resolve();

describe("createThreadsContainer", () => {
  it("posts media_type=IMAGE, image_url, text, access_token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "creation-1" }));
    const result = await createThreadsContainer("https://example.com/img.jpg", "caption", creds, fetchImpl);
    expect(result).toEqual({ creationId: "creation-1" });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/${creds.threadsUserId}/threads`);
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      media_type: "IMAGE",
      image_url: "https://example.com/img.jpg",
      text: "caption",
      access_token: "test-token",
    });
  });

  it("throws with the Graph API error message on failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Bad request" } }));
    await expect(createThreadsContainer("bad", "c", creds, fetchImpl)).rejects.toThrow(/Bad request/);
  });
});

describe("getThreadsContainerStatus", () => {
  it("returns status and error_message from the status,error_message fields query", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { status: "FINISHED" }));
    const result = await getThreadsContainerStatus("c1", creds, fetchImpl);
    expect(result).toEqual({ status: "FINISHED", errorMessage: undefined });
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain("fields=status,error_message");
  });

  it("surfaces error_message when status is ERROR", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { status: "ERROR", error_message: "FAILED_DOWNLOADING_VIDEO" }));
    const result = await getThreadsContainerStatus("c1", creds, fetchImpl);
    expect(result).toEqual({ status: "ERROR", errorMessage: "FAILED_DOWNLOADING_VIDEO" });
  });

  it("throws on an unexpected status value (edge case: unexpected shape)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { status: "WEIRD" }));
    await expect(getThreadsContainerStatus("c1", creds, fetchImpl)).rejects.toThrow(/unexpected status/);
  });
});

describe("waitForThreadsContainerReady", () => {
  it("returns immediately once status is FINISHED", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { status: "FINISHED" }));
    await waitForThreadsContainerReady("c1", creds, fetchImpl, noSleep);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("polls through IN_PROGRESS states until FINISHED", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { status: "IN_PROGRESS" }))
      .mockResolvedValueOnce(jsonResponse(200, { status: "IN_PROGRESS" }))
      .mockResolvedValueOnce(jsonResponse(200, { status: "FINISHED" }));
    await waitForThreadsContainerReady("c1", creds, fetchImpl, noSleep);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("throws on ERROR status, including the error_message", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { status: "ERROR", error_message: "INVALID_ASPEC_RATIO" }));
    await expect(waitForThreadsContainerReady("c1", creds, fetchImpl, noSleep)).rejects.toThrow(
      /INVALID_ASPEC_RATIO/,
    );
  });

  it("throws on EXPIRED status (distinct from IG Feed's status set)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { status: "EXPIRED" }));
    await expect(waitForThreadsContainerReady("c1", creds, fetchImpl, noSleep)).rejects.toThrow(/EXPIRED/);
  });

  it("throws after 5 attempts if it never reaches FINISHED (timeout/expiry plane)", async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementation(() => Promise.resolve(jsonResponse(200, { status: "IN_PROGRESS" })));
    await expect(waitForThreadsContainerReady("c1", creds, fetchImpl, noSleep)).rejects.toThrow(
      /did not finish within 5 attempts/,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });
});

describe("publishThreadsContainer", () => {
  it("posts creation_id/access_token and returns the media id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "thread-media-1" }));
    const result = await publishThreadsContainer("c1", creds, fetchImpl);
    expect(result).toEqual({ mediaId: "thread-media-1" });
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain("/threads_publish");
  });
});

describe("publishToThreads", () => {
  it("orchestrates create -> poll -> publish in order", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "creation-1" }))
      .mockResolvedValueOnce(jsonResponse(200, { status: "FINISHED" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "thread-media-1" }));

    const result = await publishToThreads("https://example.com/img.jpg", "caption", creds, fetchImpl, noSleep);
    expect(result).toEqual({ mediaId: "thread-media-1" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not attempt publish if the container errors (error path plane)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "creation-1" }))
      .mockResolvedValue(jsonResponse(200, { status: "ERROR" }));
    await expect(
      publishToThreads("https://example.com/img.jpg", "c", creds, fetchImpl, noSleep),
    ).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("refreshThreadsToken", () => {
  it("uses grant_type=th_refresh_token (distinct from Instagram's ig_refresh_token)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: "new-token", expires_in: 5184000 }));
    const result = await refreshThreadsToken("old-token", fetchImpl);
    expect(result).toEqual({ accessToken: "new-token", expiresInSeconds: 5184000 });
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain("graph.threads.net/refresh_access_token");
    expect(url).toContain("grant_type=th_refresh_token");
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, {}));
    await expect(refreshThreadsToken("bad-token", fetchImpl)).rejects.toThrow(/401/);
  });
});

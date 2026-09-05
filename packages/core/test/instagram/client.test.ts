import { describe, expect, it, vi } from "vitest";
import {
  createCarouselContainer,
  createCarouselItemContainer,
  createMediaContainer,
  fetchPermalink,
  getContainerStatus,
  publishCarouselToFeed,
  publishContainer,
  publishToFeed,
  postFirstComment,
  refreshLongLivedToken,
  waitForContainerReady,
  type IGCredentials,
} from "../../src/instagram/client.js";

const creds: IGCredentials = { accessToken: "test-token", igUserId: "17841400000000000" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const noSleep = () => Promise.resolve();

describe("createMediaContainer", () => {
  it("posts image_url/caption/access_token and returns the creation id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "creation-123" }));
    const result = await createMediaContainer("https://example.com/img.jpg", "caption", creds, fetchImpl);
    expect(result).toEqual({ creationId: "creation-123" });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/${creds.igUserId}/media`);
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      image_url: "https://example.com/img.jpg",
      caption: "caption",
      access_token: "test-token",
    });
  });

  it("throws a message from the Graph API error body on failure (external deps plane)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { error: { message: "Invalid image URL" } }));
    await expect(createMediaContainer("bad", "c", creds, fetchImpl)).rejects.toThrow(/Invalid image URL/);
  });
});

describe("getContainerStatus", () => {
  it("returns the status_code from the response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { status_code: "FINISHED" }));
    await expect(getContainerStatus("c1", creds, fetchImpl)).resolves.toBe("FINISHED");
  });

  it("throws on an unexpected status_code value (edge case: unexpected shape)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { status_code: "WEIRD" }));
    await expect(getContainerStatus("c1", creds, fetchImpl)).rejects.toThrow(/unexpected status_code/);
  });
});

describe("waitForContainerReady", () => {
  it("returns immediately once status is FINISHED", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { status_code: "FINISHED" }));
    await waitForContainerReady("c1", creds, fetchImpl, noSleep);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("polls through IN_PROGRESS states until FINISHED", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { status_code: "IN_PROGRESS" }))
      .mockResolvedValueOnce(jsonResponse(200, { status_code: "IN_PROGRESS" }))
      .mockResolvedValueOnce(jsonResponse(200, { status_code: "FINISHED" }));
    await waitForContainerReady("c1", creds, fetchImpl, noSleep);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("throws immediately on ERROR status (state transitions plane)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { status_code: "ERROR" }));
    await expect(waitForContainerReady("c1", creds, fetchImpl, noSleep)).rejects.toThrow(/ERROR/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws after 30 attempts if it never reaches FINISHED (timeout/expiry plane)", async () => {
    // mockImplementation (not mockResolvedValue) so each of the 30 calls
    // returns IN_PROGRESS, never reaching FINISHED.
    const fetchImpl = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse(200, { status_code: "IN_PROGRESS" })),
    );
    await expect(waitForContainerReady("c1", creds, fetchImpl, noSleep)).rejects.toThrow(
      /did not finish within 30 attempts/,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(30);
  });
});

describe("publishContainer", () => {
  it("posts creation_id/access_token and returns the media id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "media-123" }));
    const result = await publishContainer("c1", creds, fetchImpl);
    expect(result).toEqual({ mediaId: "media-123" });
  });
});

describe("fetchPermalink", () => {
  it("returns the permalink field", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { permalink: "https://instagram.com/p/abc" }));
    await expect(fetchPermalink("media-1", creds, fetchImpl)).resolves.toEqual({
      permalink: "https://instagram.com/p/abc",
    });
  });
});

describe("postFirstComment", () => {
  it("posts the message to the media's comments endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "comment-1" }));
    await postFirstComment("media-1", "#tag1 #tag2", creds, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/media-1/comments");
    expect(JSON.parse(init.body as string).message).toBe("#tag1 #tag2");
  });
});

describe("publishToFeed", () => {
  it("orchestrates create -> poll -> publish -> permalink -> first-comment in order", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "creation-1" })) // create
      .mockResolvedValueOnce(jsonResponse(200, { status_code: "FINISHED" })) // poll
      .mockResolvedValueOnce(jsonResponse(200, { id: "media-1" })) // publish
      .mockResolvedValueOnce(jsonResponse(200, { permalink: "https://instagram.com/p/xyz" })) // permalink
      .mockResolvedValueOnce(jsonResponse(200, { id: "comment-1" })); // first comment

    const result = await publishToFeed(
      "https://example.com/img.jpg",
      "caption",
      "#hashtags",
      creds,
      fetchImpl,
      noSleep,
    );

    expect(result).toEqual({ mediaId: "media-1", permalink: "https://instagram.com/p/xyz" });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("skips the first-comment call when hashtagComment is empty/undefined", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "creation-1" }))
      .mockResolvedValueOnce(jsonResponse(200, { status_code: "FINISHED" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "media-1" }))
      .mockResolvedValueOnce(jsonResponse(200, { permalink: "https://instagram.com/p/xyz" }));

    await publishToFeed("https://example.com/img.jpg", "caption", undefined, creds, fetchImpl, noSleep);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("propagates a failure from the container-ready poll without publishing (error path plane)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "creation-1" }))
      .mockResolvedValue(jsonResponse(200, { status_code: "ERROR" }));

    await expect(
      publishToFeed("https://example.com/img.jpg", "c", undefined, creds, fetchImpl, noSleep),
    ).rejects.toThrow(/ERROR/);
    // Only the create + one poll call should have happened -- publish must not have been attempted.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("createCarouselItemContainer & createCarouselContainer", () => {
  it("creates a carousel item container with is_carousel_item: true", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "item-1" }));
    const result = await createCarouselItemContainer("https://example.com/slide1.jpg", creds, fetchImpl);
    expect(result).toEqual({ creationId: "item-1" });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/${creds.igUserId}/media`);
    expect(JSON.parse(init.body as string)).toEqual({
      image_url: "https://example.com/slide1.jpg",
      is_carousel_item: true,
      access_token: "test-token",
    });
  });

  it("creates parent carousel container with children IDs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "carousel-parent-1" }));
    const result = await createCarouselContainer(["item-1", "item-2"], "Deck caption", creds, fetchImpl);
    expect(result).toEqual({ creationId: "carousel-parent-1" });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      media_type: "CAROUSEL",
      children: ["item-1", "item-2"],
      caption: "Deck caption",
      access_token: "test-token",
    });
  });
});

describe("publishCarouselToFeed", () => {
  it("orchestrates item container creation -> carousel container -> publish -> permalink", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "item-1" })) // create item 1
      .mockResolvedValueOnce(jsonResponse(200, { status_code: "FINISHED" })) // poll item 1
      .mockResolvedValueOnce(jsonResponse(200, { id: "item-2" })) // create item 2
      .mockResolvedValueOnce(jsonResponse(200, { status_code: "FINISHED" })) // poll item 2
      .mockResolvedValueOnce(jsonResponse(200, { id: "carousel-parent" })) // create carousel container
      .mockResolvedValueOnce(jsonResponse(200, { status_code: "FINISHED" })) // poll carousel container
      .mockResolvedValueOnce(jsonResponse(200, { id: "media-carousel-1" })) // publish
      .mockResolvedValueOnce(jsonResponse(200, { permalink: "https://instagram.com/p/carousel123" })) // permalink
      .mockResolvedValueOnce(jsonResponse(200, { id: "comment-1" })); // first comment

    const result = await publishCarouselToFeed(
      ["https://example.com/slide1.jpg", "https://example.com/slide2.jpg"],
      "Carousel caption",
      "#discipline #mindset",
      creds,
      fetchImpl,
      noSleep,
    );

    expect(result).toEqual({ mediaId: "media-carousel-1", permalink: "https://instagram.com/p/carousel123" });
    expect(fetchImpl).toHaveBeenCalledTimes(9);
  });

  it("throws if carousel has fewer than 2 images", async () => {
    const fetchImpl = vi.fn();
    await expect(
      publishCarouselToFeed(["https://example.com/single.jpg"], "cap", undefined, creds, fetchImpl, noSleep),
    ).rejects.toThrow(/between 2 and 10/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("refreshLongLivedToken", () => {
  it("returns the new access token and expiry", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: "new-token", expires_in: 5184000 }));
    const result = await refreshLongLivedToken("old-token", "fake-id", "fake-secret", fetchImpl);
    expect(result).toEqual({ accessToken: "new-token", expiresInSeconds: 5184000 });
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain("graph.facebook.com");
    expect(url).toContain("grant_type=fb_exchange_token");
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, {}));
    await expect(refreshLongLivedToken("bad-token", "fake-id", "fake-secret", fetchImpl)).rejects.toThrow(/401/);
  });
});

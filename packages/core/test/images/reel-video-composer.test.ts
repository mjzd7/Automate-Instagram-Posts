import { describe, expect, it, vi } from "vitest";
import { createReelFromFeedImage } from "../../src/images/reel-video-composer.js";
import { solidColorImage } from "./fixtures.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn((bin, args, opts, callback) => {
    if (typeof opts === "function") {
      callback = opts;
    }
    const outputPath = args[args.length - 1];
    import("node:fs/promises").then((fs) => {
      fs.writeFile(outputPath, Buffer.from("fake-mp4-data")).then(() => {
        callback(null, { stdout: "", stderr: "" });
      });
    });
  }),
}));

describe("reel-video-composer", () => {
  it("assembles a Reel MP4 from a 4:5 feed image buffer", async () => {
    const feedImageBuffer = await solidColorImage(1080, 1350, { r: 0x12, g: 0x34, b: 0x56 });
    const result = await createReelFromFeedImage({
      feedImageBuffer,
      durationSeconds: 5,
      render4K: false,
    });

    expect(result.durationSeconds).toBe(5);
    expect(result.videoBuffer.toString()).toBe("fake-mp4-data");
  });
});

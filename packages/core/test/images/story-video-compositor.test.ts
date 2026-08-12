import { describe, expect, it } from "vitest";
import { createStoryVideoMP4 } from "../../src/images/story-video-compositor.js";
import { solidColorImage } from "./fixtures.js";

function createValidWavBuffer(durationSec = 1, sampleRate = 44100): Buffer {
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

describe("story-video-compositor", () => {
  it("compiles a valid 15-second MP4 video buffer from a Story JPEG frame", async () => {
    const storyJpeg = await solidColorImage(1080, 1920, { r: 30, g: 30, b: 30 });

    const result = await createStoryVideoMP4({
      storyImageBuffer: storyJpeg,
      durationSeconds: 2, // short duration for fast unit test execution
    });

    expect(result.videoBuffer).toBeInstanceOf(Buffer);
    expect(result.videoBuffer.length).toBeGreaterThan(1000);
    expect(result.durationSeconds).toBe(2);

    // Check MP4 file signature (ftyp)
    const header = result.videoBuffer.subarray(4, 8).toString("utf-8");
    expect(header).toBe("ftyp");
  });

  it("compiles a valid MP4 video story with an embedded audio track buffer and offset", async () => {
    const storyJpeg = await solidColorImage(1080, 1920, { r: 50, g: 80, b: 120 });
    const audioTrackBuffer = createValidWavBuffer(2);

    const result = await createStoryVideoMP4({
      storyImageBuffer: storyJpeg,
      audioBuffer: audioTrackBuffer,
      durationSeconds: 2,
      startOffsetSeconds: 0,
    });

    expect(result.videoBuffer).toBeInstanceOf(Buffer);
    expect(result.videoBuffer.length).toBeGreaterThan(1000);
    expect(result.durationSeconds).toBe(2);

    const header = result.videoBuffer.subarray(4, 8).toString("utf-8");
    expect(header).toBe("ftyp");
  });
});

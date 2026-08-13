import { describe, expect, it, vi, beforeEach } from "vitest";
import { createReelsVideoMP4 } from "../../src/audio/reels-composer.js";
import * as fsPromises from "node:fs/promises";
import * as childProcess from "node:child_process";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from("mock-video-data")),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn((cmd, args, opts, cb) => {
    // Call the callback immediately with no error
    cb(null, { stdout: "", stderr: "" });
  }),
}));

describe("reels-composer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assembles a reels MP4 with ghost volume when audio is provided", async () => {
    const postImageBuffer = Buffer.from("fake-image");
    const audioBuffer = Buffer.alloc(200); // More than 100 bytes to pass hasAudio check

    const result = await createReelsVideoMP4({
      postImageBuffer,
      audioBuffer,
      durationSeconds: 12,
      startOffsetSeconds: 8,
      ghostVolume: 0.05,
    });

    expect(result.durationSeconds).toBe(12);
    expect(result.videoBuffer.toString()).toBe("mock-video-data");

    // Verify ffmpeg arguments
    const execFileMock = vi.mocked(childProcess.execFile);
    expect(execFileMock).toHaveBeenCalledTimes(1);
    
    const args = execFileMock.mock.calls[0]![1] as string[];
    // Check ghost volume filter
    expect(args).toContain("-af");
    const filterArg = args[args.indexOf("-af") + 1];
    expect(filterArg).toContain("volume=0.05");
    expect(filterArg).toContain("afade=t=in");
    expect(filterArg).toContain("afade=t=out:st=11"); // 12 - 1 = 11

    // Check duration
    expect(args).toContain("-t");
    expect(args[args.indexOf("-t") + 1]).toBe("12");

    // Check offset
    expect(args).toContain("-ss");
    expect(args[args.indexOf("-ss") + 1]).toBe("8");
  });

  it("assembles a silent MP4 when no audio is provided", async () => {
    const postImageBuffer = Buffer.from("fake-image");

    const result = await createReelsVideoMP4({
      postImageBuffer,
      durationSeconds: 15,
    });

    expect(result.durationSeconds).toBe(15);
    
    const execFileMock = vi.mocked(childProcess.execFile);
    const args = execFileMock.mock.calls[0]![1] as string[];
    
    // Check it uses lavfi for silent audio
    expect(args).toContain("-f");
    expect(args[args.indexOf("-f") + 1]).toBe("lavfi");
    expect(args).toContain("-i");
    expect(args[args.lastIndexOf("-i") + 1]).toContain("anullsrc");
  });
});

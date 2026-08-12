import { execFile } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CreateStoryVideoOptions {
  storyImageBuffer: Buffer;
  audioBuffer?: Buffer;
  durationSeconds?: number;
  startOffsetSeconds?: number;
  ffmpegBin?: string;
}

export interface CreateStoryVideoResult {
  videoBuffer: Buffer;
  durationSeconds: number;
}

/**
 * Assembles an Instagram-compliant 9:16 MP4 video story (H.264 + AAC 48kHz)
 * from a 9:16 Story JPEG frame and an audio track buffer.
 */
export async function createStoryVideoMP4(
  options: CreateStoryVideoOptions,
): Promise<CreateStoryVideoResult> {
  const {
    storyImageBuffer,
    audioBuffer,
    durationSeconds = 15,
    startOffsetSeconds = 0,
    ffmpegBin = process.env.FFMPEG_BIN ?? "ffmpeg",
  } = options;

  const id = crypto.randomUUID();
  const tmpDir = join(tmpdir(), "ig-story-video");
  await mkdir(tmpDir, { recursive: true });

  const tmpImagePath = join(tmpDir, `story-${id}.jpg`);
  const tmpAudioPath = join(tmpDir, `audio-${id}.mp3`);
  const tmpOutputPath = join(tmpDir, `output-${id}.mp4`);

  await writeFile(tmpImagePath, storyImageBuffer);

  const hasAudio = audioBuffer && audioBuffer.length > 100;
  if (hasAudio) {
    await writeFile(tmpAudioPath, audioBuffer);
  }

  try {
    let args: string[];
    if (hasAudio) {
      const fadeInSec = 0.5;
      const fadeOutSec = 1.0;
      const fadeOutStart = Math.max(0, durationSeconds - fadeOutSec);
      const audioFilter = `afade=t=in:ss=0:d=${fadeInSec},afade=t=out:st=${fadeOutStart}:d=${fadeOutSec}`;

      args = [
        "-y",
        "-loop", "1",
        "-r", "10",
        "-i", tmpImagePath,
        "-ss", String(startOffsetSeconds),
        "-i", tmpAudioPath,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-tune", "stillimage",
        "-pix_fmt", "yuv420p",
        "-af", audioFilter,
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        "-t", String(durationSeconds),
        "-shortest",
        tmpOutputPath,
      ];
    } else {
      // Silent audio generator for Instagram video container compatibility
      args = [
        "-y",
        "-loop", "1",
        "-r", "10",
        "-i", tmpImagePath,
        "-f", "lavfi",
        "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-tune", "stillimage",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "-t", String(durationSeconds),
        tmpOutputPath,
      ];
    }

    await execFileAsync(ffmpegBin, args, { timeout: 30000 });
    const videoBuffer = await readFile(tmpOutputPath);

    return {
      videoBuffer,
      durationSeconds,
    };
  } finally {
    // Cleanup temporary files
    await Promise.allSettled([
      unlink(tmpImagePath),
      unlink(tmpAudioPath),
      unlink(tmpOutputPath),
    ]);
  }
}

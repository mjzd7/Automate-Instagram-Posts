import { execFile } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CreateReelsVideoOptions {
  postImageBuffer: Buffer;
  audioBuffer?: Buffer;
  durationSeconds: number;
  startOffsetSeconds?: number;
  ffmpegBin?: string;
  ghostVolume?: number; // Volume 0.0 to 1.0 (default 0.05 for 5%)
  render4K?: boolean;
}

export interface CreateReelsVideoResult {
  videoBuffer: Buffer;
  durationSeconds: number;
}

/**
 * Assembles an Instagram-compliant Reels MP4 video (H.264 + AAC 48kHz)
 * from a static post frame and an audio track buffer.
 * Implements "ghost volume" (5%) to boost algorithm engagement without overpowering the user.
 */
export async function createReelsVideoMP4(
  options: CreateReelsVideoOptions,
): Promise<CreateReelsVideoResult> {
  const {
    postImageBuffer,
    audioBuffer,
    durationSeconds,
    startOffsetSeconds = 0,
    ffmpegBin = process.env.FFMPEG_BIN ?? "ffmpeg",
    ghostVolume = 0.05,
    render4K = false,
  } = options;

  const id = crypto.randomUUID();
  const tmpDir = join(tmpdir(), "ig-reels-video");
  await mkdir(tmpDir, { recursive: true });

  const tmpImagePath = join(tmpDir, `reels-${id}.jpg`);
  const tmpAudioPath = join(tmpDir, `audio-${id}.mp3`);
  const tmpOutputPath = join(tmpDir, `output-${id}.mp4`);

  await writeFile(tmpImagePath, postImageBuffer);

  const hasAudio = audioBuffer && audioBuffer.length > 100;
  if (hasAudio) {
    await writeFile(tmpAudioPath, audioBuffer);
  }

  const bv = render4K ? "18M" : "6M";
  const bufsize = render4K ? "36M" : "12M";

  try {
    let args: string[];
    if (hasAudio) {
      const fadeInSec = 0.5;
      const fadeOutSec = 1.0;
      const fadeOutStart = Math.max(0, durationSeconds - fadeOutSec);
      
      // Apply ghost volume + fade in/out
      const audioFilter = `volume=${ghostVolume},afade=t=in:ss=0:d=${fadeInSec},afade=t=out:st=${fadeOutStart}:d=${fadeOutSec}`;

      args = [
        "-y",
        "-loop", "1",
        "-r", "30", // 30fps is optimal for IG Reels
        "-i", tmpImagePath,
        "-ss", String(startOffsetSeconds),
        "-i", tmpAudioPath,
        "-c:v", "libx264",
        "-preset", "veryfast", // better quality-to-size than ultrafast
        "-tune", "stillimage",
        "-profile:v", "main", // highly compatible
        "-level:v", "4.0",
        "-pix_fmt", "yuv420p", // 4:2:0 subsampling
        "-colorspace", "bt709", // Rec.709 prevents washed out colors
        "-color_trc", "bt709",
        "-color_primaries", "bt709",
        "-b:v", bv, // 18M for 4K tricks IG into top tier processing, 6M for 1080p
        "-maxrate", bv,
        "-bufsize", bufsize,
        "-af", audioFilter,
        "-c:a", "aac",
        "-b:a", "256k", // High quality audio
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
        "-r", "30",
        "-i", tmpImagePath,
        "-f", "lavfi",
        "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-tune", "stillimage",
        "-profile:v", "main",
        "-level:v", "4.0",
        "-pix_fmt", "yuv420p",
        "-colorspace", "bt709",
        "-color_trc", "bt709",
        "-color_primaries", "bt709",
        "-b:v", "6M",
        "-maxrate", "6M",
        "-bufsize", "12M",
        "-c:a", "aac",
        "-b:a", "256k",
        "-shortest",
        "-t", String(durationSeconds),
        tmpOutputPath,
      ];
    }

    await execFileAsync(ffmpegBin, args, { timeout: 60000 });
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

import { execFile } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CreateReelFromFeedImageOptions {
  /** 4:5 JPEG buffer from compositor.ts (the feed post image). */
  feedImageBuffer: Buffer;
  /** MP3 audio track to embed. */
  audioBuffer?: Buffer;
  /** Reel duration in seconds (5–90). Default: 15. */
  durationSeconds?: number;
  /** Offset into the audio file to start from (seconds). Default: 0. */
  startOffsetSeconds?: number;
  /**
   * When true, encodes at 18 Mbps (signals high-quality to Instagram's
   * processing pipeline). Output canvas is always 1080×1920 — 4K zoompan
   * is too slow for GHA runners; the bitrate lift achieves the same effect.
   */
  render4K?: boolean;
  /** Override ffmpeg binary path. Defaults to FFMPEG_BIN env or "ffmpeg". */
  ffmpegBin?: string;
  /**
   * Audio volume multiplier (0–1). Default: 0.05 ("ghost volume") — audible
   * enough to trigger Instagram's audio engagement signal without overpowering.
   */
  ghostVolume?: number;
}

export interface ReelVideoResult {
  videoBuffer: Buffer;
  durationSeconds: number;
}

/**
 * Converts a static 4:5 feed post image into a 9:16 Instagram Reel MP4
 * with motion VFX. Effect stack (all in a single FFmpeg filter_complex pass):
 *
 *  Layer 0 — Blurred background fill (pillarbox-blur):
 *    Scales the 4:5 image to cover the 9:16 canvas, then heavily blurs it
 *    (σ=30) so the background is recognisable but soft.
 *
 *  Layer 1 — Ken Burns + beat-sync zoom on the foreground:
 *    Slow drift from 1.0× to 1.06× over the full duration, PLUS a quick
 *    punch-and-release zoom (0.08× peak) that decays exponentially every 2s
 *    — simulating a beat-sync pulse at ~120 BPM.
 *    zoompan is pre-fed a 4000-px-wide rescale to eliminate pixel jitter
 *    (the documented #1 zoompan gotcha).
 *
 *  Layer 2 — Composite:
 *    Centres the zoomed foreground over the blurred background.
 *
 *  Layer 3 — Post-process:
 *    Cinematic vignette (darkens edges, keeps eye on the quote card) +
 *    animated film grain (subtle temporal noise, strength oscillates every 3s).
 *
 *  Audio:
 *    AAC 256k, 48 kHz stereo. Ghost-volume fade-in (0.5s) + fade-out (1.2s).
 *    Silence injected if no audio provided (required for Instagram video container).
 */
export async function createReelFromFeedImage(
  options: CreateReelFromFeedImageOptions,
): Promise<ReelVideoResult> {
  const {
    feedImageBuffer,
    audioBuffer,
    durationSeconds = 15,
    startOffsetSeconds = 0,
    render4K = false,
    ffmpegBin = process.env.FFMPEG_BIN ?? "ffmpeg",
    ghostVolume = 0.05,
  } = options;

  // Output canvas: always 1080×1920 (9:16).
  // 4K mode uses 18 Mbps bitrate to signal high quality to Instagram.
  const canvasW = 1080;
  const canvasH = 1920;

  // 4:5 foreground display area (same aspect as the feed image)
  const fgW = canvasW;       // 1080
  const fgH = Math.round(canvasW * 5 / 4); // 1350

  // Ken Burns: drift from 1.0× to 1.06× over the full duration
  const kbDrift = (0.06 / Math.max(durationSeconds, 1)).toFixed(6);
  // Zoom expression: base drift + exponential beat-sync pulse every 2 s
  const zoomExpr = `min(1.0+${kbDrift}*t+0.08*exp(-5*mod(t,2.0)),1.15)`;
  const xExpr = `iw/2-(iw/zoom/2)`;
  const yExpr = `ih/2-(ih/zoom/2)`;

  // Full filter_complex (single pass):
  const filterComplex = [
    // Pre-scale to 4000px wide to prevent zoompan pixel jitter (#1 gotcha)
    `[0:v]scale=4000:-1[hires]`,
    // Blurred background: scale to cover 9:16 canvas, crop to exact dims, heavy blur
    `[hires]scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase,crop=${canvasW}:${canvasH},gblur=sigma=30[bg]`,
    // Foreground: Ken Burns zoom + beat-sync pulse on the 4:5 image area
    `[hires]zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=1:s=${fgW}x${fgH}:fps=30[fg]`,
    // Composite: fg centred over blurred bg
    `[bg][fg]overlay=(W-w)/2:(H-h)/2[comp]`,
    // Post-process: vignette + animated film grain (strength oscillates every 3s)
    `[comp]vignette=PI/4,noise=c0s='8+6*sin(2*PI*t/3)':c0f=t+u[out]`,
  ].join("; ");

  const hasAudio = Boolean(audioBuffer && audioBuffer.length > 100);

  const id = crypto.randomUUID();
  const tmpDir = join(tmpdir(), "ig-reel-vfx");
  await mkdir(tmpDir, { recursive: true });

  const tmpImagePath = join(tmpDir, `feed-${id}.jpg`);
  const tmpAudioPath = join(tmpDir, `audio-${id}.mp3`);
  const tmpOutputPath = join(tmpDir, `reel-${id}.mp4`);

  await writeFile(tmpImagePath, feedImageBuffer);
  if (hasAudio) await writeFile(tmpAudioPath, audioBuffer!);

  const bv = render4K ? "18M" : "8M";
  const bufsize = render4K ? "36M" : "16M";

  const fadeInSec = 0.5;
  const fadeOutSec = 1.2;
  const fadeOutStart = Math.max(0, durationSeconds - fadeOutSec);
  const audioFilter = `volume=${ghostVolume},afade=t=in:ss=0:d=${fadeInSec},afade=t=out:st=${fadeOutStart}:d=${fadeOutSec}`;

  const args: string[] = [
    "-y",
    "-loop", "1",
    "-framerate", "30",
    "-i", tmpImagePath,
  ];

  if (hasAudio) {
    args.push("-ss", String(startOffsetSeconds), "-i", tmpAudioPath);
  } else {
    // Inject silent audio — Instagram requires an audio stream in Reels
    args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  }

  args.push(
    "-filter_complex", filterComplex,
    "-map", "[out]",
    "-map", "1:a",
    "-af", hasAudio ? audioFilter : "aecho=0.8:0.9:1000:0.3",
    "-c:v", "libx264",
    "-preset", "fast",      // faster than slow; zoompan is the real bottleneck
    "-profile:v", "main",
    "-level:v", "4.0",
    "-pix_fmt", "yuv420p",
    "-colorspace", "bt709",
    "-color_trc", "bt709",
    "-color_primaries", "bt709",
    "-b:v", bv,
    "-maxrate", bv,
    "-bufsize", bufsize,
    "-c:a", "aac",
    "-b:a", "256k",
    "-ar", "48000",
    "-ac", "2",
    "-t", String(durationSeconds),
    "-movflags", "+faststart",
    tmpOutputPath,
  );

  try {
    // zoompan is CPU-intensive — allow 5 min on GHA runners (2 vCPU)
    await execFileAsync(ffmpegBin, args, { timeout: 300000 });
    const videoBuffer = await readFile(tmpOutputPath);
    return { videoBuffer, durationSeconds };
  } finally {
    await Promise.allSettled([
      unlink(tmpImagePath),
      hasAudio ? unlink(tmpAudioPath) : Promise.resolve(),
      unlink(tmpOutputPath),
    ]);
  }
}

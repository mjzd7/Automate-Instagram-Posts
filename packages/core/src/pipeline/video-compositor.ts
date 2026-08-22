import ffmpeg from "fluent-ffmpeg";
import path from "node:path";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { renderGlassCard } from "../images/glass-card.js";
import { renderFittedText } from "../images/text-render.js";
import { generateTypewriterSequence } from "../images/typewriter.ts";
import { fetchPexelsVideo, type VideoResult } from "./video-fetcher";
import { fetchPixabayVideo } from "./pixabay-video-fetcher";
import { selectTemplate } from "../images/templates.js";
import { loadEnv } from "../config/env.js";
import { imagePassesFilter } from "../content-filter/image-filter.js";
import { 
  CARD_HORIZONTAL_MARGIN_PX, 
  CARD_PADDING_X_PX, 
  CARD_VERTICAL_MARGIN_PX 
} from "../images/constants.js";
import type { Darkness } from "../images/darkness-classifier.js";

import { selectStoryAudio } from "../audio/audio-selector.js";
import { fetchElevenLabsVoiceover } from "../audio/elevenlabs-client.js";

const REEL_WIDTH = 1080;
const REEL_HEIGHT = 1920;

function textColor(mode: Darkness): string {
  return mode === "dark" ? "#FFFFFF" : "#1A1A1A";
}

function authorColor(mode: Darkness): string {
  return mode === "dark" ? "#FFFFFFBF" : "#1A1A1AA6";
}

export async function composeVideoReel(
  quoteText: string, 
  category: string,
  outputFile: string,
  availableTracks: any[] = [], // Pass MetaAudioTrack[] when called from a context with IG token
  enableVoiceover: boolean = false,
  mode: Darkness = "dark",
  author?: string
) {
  const fullText = author ? `${quoteText}\n\n— ${author}` : quoteText;
  console.log(`Starting video reel composition for: "${fullText}"`);
  
  const env = loadEnv();
  
  // 1b. Fetch Audio using official audio-selector (Meta API + Fallback Catalog)
  const audioSelection = selectStoryAudio({
    category,
    mode,
    quoteLength: fullText.length,
    availableTracks
  });
  const audio = audioSelection.track.downloadUrl;
  console.log(`Selected audio track: ${audioSelection.track.title} (${audioSelection.track.audioId})`);
  
  const tempDir = path.join(process.cwd(), "scratch", "reel_temp");
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

  let video: any = null;
  const bgVideoPath = path.join(tempDir, "bg_video.mp4");
  // Links already rejected by Vision filters -- fed back to the fetcher so
  // retries draw fresh candidates and walk down its fallback query ladder
  // instead of re-testing the same failing videos.
  const rejectedVideoUrls = new Set<string>();

  // Both sources share one exclusion set -- a Vision-rejected link must never be redrawn from either.
  const sourceOrder = (process.env.VIDEO_SOURCE_ORDER ?? "").toLowerCase().startsWith("pixabay")
    ? [fetchPixabayVideo, fetchPexelsVideo]
    : [fetchPexelsVideo, fetchPixabayVideo];
  const fetchNextCandidate = async (): Promise<VideoResult | null> => {
    for (const fetchSource of sourceOrder) {
      const found = await fetchSource(category, mode, quoteText, rejectedVideoUrls);
      if (found) return found;
    }
    return null;
  };

  // Try fetching and validating a video candidate up to 5 times
  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`[Content Filter] Fetching background video candidate (Attempt ${attempt}/5)...`);
    video = await fetchNextCandidate();
    if (!video) {
      continue;
    }
    
    console.log(`[Content Filter] Downloading background video from Pexels to: ${bgVideoPath}...`);
    try {
      const videoResponse = await fetch(video.url);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download background video from ${video.url}`);
      }
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      writeFileSync(bgVideoPath, videoBuffer);
      
      // Extract a test frame at t=1.0s to run through SafeSearch and Label Blocklists
      const testFramePath = path.join(tempDir, `test_frame_${attempt}.jpg`);
      console.log(`[Content Filter] Extracting test frame at t=1s...`);
      execFileSync("ffmpeg", [
        "-y",
        "-ss", "1",
        "-i", bgVideoPath,
        "-frames:v", "1",
        "-q:v", "2",
        testFramePath
      ], { stdio: "ignore" });
      
      const frameBuffer = await sharp(testFramePath).jpeg().toBuffer();
      try {
        const fs = await import("node:fs/promises");
        await fs.unlink(testFramePath);
      } catch {}

      if (env.GOOGLE_CLOUD_VISION_API_KEY) {
        console.log(`[Content Filter] Running Google Vision content filter on video frame...`);
        const filterResult = await imagePassesFilter(frameBuffer, env.GOOGLE_CLOUD_VISION_API_KEY);
        if (!filterResult.passes) {
          console.warn(`[Content Filter] Video candidate failed validation: ${filterResult.rejectionReason}. Rejecting video.`);
          try {
            const fs = await import("node:fs/promises");
            await fs.unlink(bgVideoPath);
          } catch {}
          if (video) {
            rejectedVideoUrls.add(video.url);
          }
          video = null;
          continue; // Try next Pexels video
        }
      }
      
      console.log(`[Content Filter] Video candidate passed content filtering.`);
      break; // Found a good video
    } catch (err) {
      console.error(`[Content Filter] Error validating video candidate:`, err);
      try {
        const fs = await import("node:fs/promises");
        await fs.unlink(bgVideoPath);
      } catch {}
      if (video) {
        rejectedVideoUrls.add(video.url);
      }
      video = null;
    }
  }

  if (!video) {
    throw new Error("Could not find a valid background video from Pexels that passes safety filters after 5 attempts.");
  }

  // 1c. Fetch AI Voiceover (Disabled by default)
  let voiceoverPath: string | null = null;
  if (enableVoiceover) {
    const voiceoverBuffer = await fetchElevenLabsVoiceover({ text: fullText });
    if (voiceoverBuffer) {
      voiceoverPath = path.join(tempDir, "voiceover.mp3");
      writeFileSync(voiceoverPath, voiceoverBuffer);
      console.log("Successfully generated AI Voiceover.");
    }
  }
  
  // 2. Resolve Text Layout & Card Size
  const template = selectTemplate(category, undefined, 0);
  const maxCardWidth = REEL_WIDTH - 2 * CARD_HORIZONTAL_MARGIN_PX;
  const maxTextWidth = maxCardWidth - 200; // Force an aggressive, tight central column
  const maxTextHeight = REEL_HEIGHT - 2 * CARD_VERTICAL_MARGIN_PX - 200; // Account for badges
  
  // Calculate quote font size using renderFittedText
  const textResult = await renderFittedText(
    quoteText,
    template.quoteFont,
    maxTextWidth,
    maxTextHeight,
    textColor(mode)
  );
  
  const authorFontSize = Math.max(
    32, // AUTHOR_LINE_FONT_SIZE_MIN
    Math.round(textResult.fontSize * 0.5) // AUTHOR_LINE_FONT_SIZE_RATIO
  );

  const authorDisplay = author ? `— ${author} ` : undefined;
  
  // 4. Generate Typewriter PNG Sequence
  console.log("Generating typewriter frames...");
  const framesDir = path.join(tempDir, "frames");
  const typewriterRes = await generateTypewriterSequence(
    quoteText,
    template.quoteFont,
    textResult.fontSize,
    maxTextWidth,
    textColor(mode),
    framesDir,
    2, // chars per frame = ~60 chars/sec (ultra-fast for dopamine retention)
    authorDisplay,
    template.authorFont,
    authorFontSize,
    authorColor(mode)
  );
  
  // Calculate exact video duration: typing time + 3.5s hold time
  const typingDurationSeconds = typewriterRes.typedFrames / 30.0;
  const holdDurationSeconds = 3.5;
  const totalVideoDuration = Math.max(5, Math.min(15, Math.ceil(typingDurationSeconds + holdDurationSeconds)));
  
  const cardHeight = typewriterRes.totalHeight + 360; // Huge premium top and bottom padding
  const cardWidth = maxCardWidth;
  const cardX = Math.round((REEL_WIDTH - cardWidth) / 2);
  const cardY = Math.round((REEL_HEIGHT - cardHeight) / 2);
  
  // 3. Generate Glass UI (SVG border + badges)
  const uiBuffer = await renderGlassCard({
    width: cardWidth,
    height: cardHeight,
    mode
  });
  
  const uiPath = path.join(tempDir, "ui_layer.png");
  writeFileSync(uiPath, uiBuffer);

  // Generate CTA (Call To Action) that fades in after typing
  const ctaPath = path.join(tempDir, "cta_layer.png");
  const ctaColor = mode === "dark" ? "#FFFFFF" : "#000000";
  const ctaBuffer = await sharp({
    text: { text: `<span foreground="${ctaColor}" weight="bold">Save this to remind yourself later 📌</span>`, fontfile: template.authorFont.file, font: `${template.authorFont.family} 32`, width: REEL_WIDTH, align: "centre", rgba: true }
  }).png().toBuffer();
  writeFileSync(ctaPath, ctaBuffer);
  
  const coverImagePath = outputFile.replace(/\.mp4$/, "-cover.jpg");

  const vFwdPath = path.join(tempDir, "v_fwd.mp4");
  const vRevPath = path.join(tempDir, "v_rev.mp4");
  const loopedBgPath = path.join(tempDir, "looped_bg.mp4");

  console.log(`Pre-processing background video loop...`);
  const halfDuration = totalVideoDuration / 2;
  
  // 1. Trim, scale, and crop forward segment
  // Intermediates run near-lossless (CRF 10): four chained encodes must not compound generation loss.
  execFileSync("ffmpeg", [
    "-y",
    "-ss", "0",
    "-t", String(halfDuration),
    "-i", bgVideoPath,
    "-vf", `scale=${REEL_WIDTH}:${REEL_HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${REEL_WIDTH}:${REEL_HEIGHT}`,
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "10",
    "-pix_fmt", "yuv420p",
    "-an",
    vFwdPath
  ], { stdio: "ignore" });

  // 2. Reverse forward segment to create backward segment
  execFileSync("ffmpeg", [
    "-y",
    "-i", vFwdPath,
    "-vf", "reverse",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "10",
    "-pix_fmt", "yuv420p",
    "-an",
    vRevPath
  ], { stdio: "ignore" });

  // 3. Concatenate forward and backward segments
  execFileSync("ffmpeg", [
    "-y",
    "-i", vFwdPath,
    "-i", vRevPath,
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]",
    "-map", "[v]",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "10",
    "-pix_fmt", "yuv420p",
    "-an",
    loopedBgPath
  ], { stdio: "ignore" });

  // 5. FFmpeg Assembly
  console.log(`Starting FFmpeg assembly (Duration: ${totalVideoDuration}s, Typing finished at: ${typingDurationSeconds.toFixed(1)}s)...`);
  
  await new Promise<void>((resolve, reject) => {
    let command = ffmpeg()
      .input(loopedBgPath)
      .input(uiPath)
      .input(path.join(framesDir, "frame_%04d.png"))
      .inputOptions(["-framerate 30"])
      .input(ctaPath);
      
    let audioInputIndex = -1;
    if (audio) {
      audioInputIndex = 4;
      command = command
        .input(audio)
        .inputOptions([`-ss ${audioSelection.peakStartSecond}`]);
    }

    let voiceInputIndex = -1;
    if (voiceoverPath) {
      voiceInputIndex = audio ? 5 : 4;
      command = command.input(voiceoverPath);
    }
      
    const filterGraph = [
      // 1. Overlay the static UI layer (borders, badges, semi-transparent gradient fill)
      `[0:v][1:v]overlay=${cardX}:${cardY}[bg_with_ui]`,
      
      // Create drop shadow for text frames
      `[2:v]split[text_main][text_shadow]`,
      `[text_shadow]colorchannelmixer=rr=0:rg=0:rb=0:ra=0:gr=0:gg=0:gb=0:ga=0:br=0:bg=0:bb=0:ba=0:ar=0:ag=0:ab=0:aa=0.9,gblur=sigma=4[text_shadow_blurred]`,
      
      // Composite text shadow and text
      `[bg_with_ui][text_shadow_blurred]overlay=${cardX + Math.round((cardWidth - typewriterRes.totalWidth) / 2)}:${cardY + 180 + 4}[bg_with_shadow]`,
      `[bg_with_shadow][text_main]overlay=${cardX + Math.round((cardWidth - typewriterRes.totalWidth) / 2)}:${cardY + 180}:shortest=1[bg_with_text]`,
      
      // Fade in the CTA exactly when the typing finishes
      `[3:v]format=rgba,fade=in:st=${typingDurationSeconds}:d=1:alpha=1[cta_faded]`,
      `[bg_with_text][cta_faded]overlay=0:${cardY + cardHeight + 60}[final]`
    ];

    let finalAudioMap = "";
    if (audio && voiceoverPath) {
      // Audio Ducking: sidechaincompress ducks the bg music when voice speaks. 
      // Then we mix them together.
      filterGraph.push(
        `[${audioInputIndex}:a][${voiceInputIndex}:a]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=500[ducked_bg]`,
        `[ducked_bg][${voiceInputIndex}:a]amix=inputs=2:duration=first:dropout_transition=2[final_audio]`
      );
      finalAudioMap = "[final_audio]";
    } else if (audio) {
      finalAudioMap = `${audioInputIndex}:a`;
    } else if (voiceoverPath) {
      finalAudioMap = `${voiceInputIndex}:a`;
    }

    command
      .complexFilter(filterGraph)
      .outputOptions([
        "-map [final]"
      ]);
      
    if (finalAudioMap) {
      command.outputOptions([
        `-map ${finalAudioMap}`,
        "-c:a aac",
        "-b:a 256k",
        "-ar 48000",
        "-ac 2"
      ]);
    }

    // Delivery encode: single high-quality generation that survives IG's
    // recompression. CRF 17 + High@4.2 + Rec.709 tags + <=20Mbps cap per
    // Instagram's published specs (1080x1920/30fps/H.264, max 25Mbps).
    command
      .outputOptions([
        "-c:v libx264",
        "-preset slow",
        "-crf 17",
        "-maxrate 16M",
        "-bufsize 32M",
        "-profile:v high",
        "-level:v 4.2",
        "-pix_fmt yuv420p",
        "-colorspace bt709",
        "-color_primaries bt709",
        "-color_trc bt709",
        "-r 30",
        "-movflags +faststart",
        `-t ${totalVideoDuration}`,
        "-y"
      ])
      .save(outputFile)
      .on("end", () => {
        console.log(`Successfully generated Reel: ${outputFile}`);
        resolve();
      })
      .on("error", (err) => {
        console.error("FFmpeg Error:", err);
        reject(err);
      });
  });

  // 6. Extract cover image: a single frame at the moment the complete quote is fully visible
  const coverSeekTime = Math.min(typingDurationSeconds + 0.5, totalVideoDuration - 0.5);
  console.log(`Extracting cover image at t=${coverSeekTime.toFixed(1)}s (complete quote frame)...`);
  await new Promise<void>((resolve, reject) => {
    ffmpeg(outputFile)
      .seek(coverSeekTime)
      .frames(1)
      .outputOptions(["-q:v 2", "-y"])
      .save(coverImagePath)
      .on("end", () => {
        console.log(`Cover image saved: ${coverImagePath}`);
        resolve();
      })
      .on("error", (err) => {
        console.warn(`Cover extraction failed, will skip cover_url:`, err);
        resolve(); // Non-fatal — Instagram will auto-select a frame
      });
  });

  return { videoPath: outputFile, coverImagePath, selectedAudioTrack: audioSelection.track };
}

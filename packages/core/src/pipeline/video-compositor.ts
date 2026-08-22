import ffmpeg from "fluent-ffmpeg";
import path from "node:path";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import sharp from "sharp";
import { renderGlassCard } from "../images/glass-card.js";
import { renderFittedText } from "../images/text-render.js";
import { generateTypewriterSequence } from "../images/typewriter.ts";
import { fetchPexelsVideo } from "./video-fetcher";
import { selectTemplate } from "../images/templates.js";
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
  // Merge author into quote text for typewriter if provided
  const fullText = author ? `${quoteText}\n\n— ${author}` : quoteText;
  
  console.log(`Starting video reel composition for: "${fullText}"`);
  
  // 1. Fetch Background Video
  const video = await fetchPexelsVideo(category, mode, quoteText);
  if (!video) {
    throw new Error("Could not fetch a background video from Pexels");
  }
  console.log(`Fetched video: ${video.url}`);
  
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

  const bgVideoPath = path.join(tempDir, "bg_video.mp4");
  console.log(`Downloading background video from Pexels to: ${bgVideoPath}...`);
  const videoResponse = await fetch(video.url);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download background video from ${video.url}`);
  }
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
  writeFileSync(bgVideoPath, videoBuffer);

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

  const authorDisplay = author ? `— ${author}` : undefined;
  
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

  // 5. FFmpeg Assembly
  console.log(`Starting FFmpeg assembly (Duration: ${totalVideoDuration}s, Typing finished at: ${typingDurationSeconds.toFixed(1)}s)...`);
  
  await new Promise<void>((resolve, reject) => {
    let command = ffmpeg()
      .input(bgVideoPath)
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
      
    const halfDuration = totalVideoDuration / 2;
    const filterGraph = [
      // 1. Scale and crop to fit 9:16 perfectly first (reduces memory consumption for reverse)
      `[0:v]scale=${REEL_WIDTH}:${REEL_HEIGHT}:force_original_aspect_ratio=increase,crop=${REEL_WIDTH}:${REEL_HEIGHT}[bg_scaled]`,

      // 2. Create a seamless Ping-Pong loop so frame 0 and frame N are identical
      `[bg_scaled]trim=start=0:end=${halfDuration},setpts=PTS-STARTPTS[v_fwd]`,
      `[v_fwd]reverse[v_rev]`,
      `[v_fwd][v_rev]concat=n=2:v=1:a=0[bg_pingpong]`,
      
      // 3. Overlay the static UI layer (borders, badges, semi-transparent gradient fill)
      `[bg_pingpong][1:v]overlay=${cardX}:${cardY}[bg_with_ui]`,
      
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
        "-c:a aac"
      ]);
    }

    command
      .outputOptions([
        "-c:v libx264",
        "-pix_fmt yuv420p",
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
      .seekInput(coverSeekTime)
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

  return { videoPath: outputFile, coverImagePath };
}

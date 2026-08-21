import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp, { OutputInfo, OverlayOptions } from "sharp";
import { FontFace } from "./templates.js";
import { renderTextAtSize } from "./text-render.js";

/**
 * Escapes characters for Pango markup
 */
function escapePangoMarkup(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Renders a sequence of PNG images simulating a typewriter effect.
 * Uses the Pango alpha="0" trick to keep the exact word-wrapping layout 
 * while revealing the text character by character.
 */
export async function generateTypewriterSequence(
  quoteText: string,
  quoteFace: FontFace,
  quoteFontSize: number,
  maxWidth: number,
  color: string,
  outputDir: string,
  charsPerFrame: number = 2,
  authorText?: string,
  authorFace?: FontFace,
  authorFontSize?: number,
  authorColor?: string
): Promise<{ files: string[], totalHeight: number, totalWidth: number, typedFrames: number }> {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const generatedFiles: string[] = [];
  
  // To get the final dimensions and alignment right, we need to know the bounding boxes of both blocks.
  const { info: quoteInfo } = await sharp({
    text: { text: `<span foreground="${color}">${escapePangoMarkup(quoteText)}</span>`, fontfile: quoteFace.file, font: `${quoteFace.family} ${quoteFontSize}`, width: maxWidth, align: "centre", rgba: true, wrap: "word" }
  }).png().toBuffer({ resolveWithObject: true });

  let authorInfo: OutputInfo | undefined;
  if (authorText && authorFace && authorFontSize && authorColor) {
    const res = await sharp({
      text: { text: `<span foreground="${authorColor}">${escapePangoMarkup(authorText)}</span>`, fontfile: authorFace.file, font: `${authorFace.family} ${authorFontSize}`, width: maxWidth, align: "centre", rgba: true, wrap: "word" }
    }).png().toBuffer({ resolveWithObject: true });
    authorInfo = res.info;
  }

  const authorGap = Math.round(quoteFontSize * 1.5); // Cinematic breathing room
  const totalHeight = quoteInfo.height + (authorInfo ? authorGap + authorInfo.height : 0);
  const totalWidth = Math.max(quoteInfo.width, authorInfo?.width || 0);

  // We type the quote first, then the author
  const totalQuoteChars = quoteText.length;
  const totalAuthorChars = authorText ? authorText.length : 0;
  const totalChars = totalQuoteChars + totalAuthorChars;
  let frameCount = 1;
  let typedFramesCount = 0;
  
  for (let i = 0; i <= totalChars; i += charsPerFrame) {
    // Ensure we always render the exact final character on the last loop
    const currentIndex = Math.min(i, totalChars);
    
    const quoteVisibleChars = Math.min(currentIndex, totalQuoteChars);
    const authorVisibleChars = Math.max(0, currentIndex - totalQuoteChars);

    const quoteVisible = `<span foreground="${color}" alpha="100%">${escapePangoMarkup(quoteText.substring(0, quoteVisibleChars))}</span>`;
    const quoteHidden = `<span alpha="1%">${escapePangoMarkup(quoteText.substring(quoteVisibleChars))}</span>`;
    
    const quoteBuffer = await sharp({
      text: { text: `${quoteVisible}${quoteHidden}`, fontfile: quoteFace.file, font: `${quoteFace.family} ${quoteFontSize}`, width: maxWidth, align: "centre", rgba: true, wrap: "word" }
    }).png().toBuffer();

    let compositeLayers: OverlayOptions[] = [
      { input: quoteBuffer, left: Math.round((totalWidth - quoteInfo.width) / 2), top: 0 }
    ];

    if (authorText && authorFace && authorFontSize && authorColor && authorInfo) {
      const authorVisible = `<span foreground="${authorColor}" alpha="100%">${escapePangoMarkup(authorText.substring(0, authorVisibleChars))}</span>`;
      const authorHidden = `<span alpha="1%">${escapePangoMarkup(authorText.substring(authorVisibleChars))}</span>`;
      
      const authorBuffer = await sharp({
        text: { text: `${authorVisible}${authorHidden}`, fontfile: authorFace.file, font: `${authorFace.family} ${authorFontSize}`, width: maxWidth, align: "centre", rgba: true, wrap: "word" }
      }).png().toBuffer();

      compositeLayers.push({
        input: authorBuffer,
        left: Math.round((totalWidth - authorInfo.width) / 2),
        top: quoteInfo.height + authorGap
      });
    }

    // Create a transparent canvas of total size
    const canvas = await sharp({ create: { width: totalWidth, height: totalHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(compositeLayers)
      .png()
      .toBuffer();
    
    const filename = path.join(outputDir, `frame_${String(frameCount).padStart(4, '0')}.png`);
    await sharp(canvas).toFile(filename);
    generatedFiles.push(filename);
    frameCount++;
    typedFramesCount++;
    
    if (currentIndex === totalChars) break;
  }
  
  const finalFilename = generatedFiles[generatedFiles.length - 1];
  for (let f = 0; f < 900; f++) {
    const filename = path.join(outputDir, `frame_${String(frameCount).padStart(4, '0')}.png`);
    await sharp(finalFilename).toFile(filename);
    generatedFiles.push(filename);
    frameCount++;
  }

  return { files: generatedFiles, totalHeight, totalWidth, typedFrames: typedFramesCount };
}

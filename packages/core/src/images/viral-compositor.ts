import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { renderFittedText, renderTextAtSize } from "./text-render.js";
import { renderVignette } from "./scrim.js";
import { grainTexturePng } from "./grain.js";
import { GRAIN_TEXTURE_OPACITY } from "./constants.js";
import type { FontFace, Template } from "./templates.js";
import { findTemplate } from "./templates.js";

const fontsDir = fileURLToPath(new URL("./fonts", import.meta.url));

export type ViralTemplateStyle = "classic-glass" | "twitter-dark" | "apple-notes" | "editorial-luxury";

export function selectViralStyle(_category?: string, random: () => number = Math.random): ViralTemplateStyle {
  const styles: ViralTemplateStyle[] = ["classic-glass", "twitter-dark", "apple-notes", "editorial-luxury"];
  return styles[Math.floor(random() * styles.length)] ?? "classic-glass";
}

export interface ComposeViralReelInput {
  backgroundBuffer?: Buffer;
  quoteText: string;
  author?: string | null;
  category?: string;
  style: ViralTemplateStyle;
  template?: Template;
  accountHandle?: string;
  accountName?: string;
  scale?: number;
  width?: number;
  height?: number;
  grainRandom?: () => number;
}

function escapeXml(str: string): string {
  return str.replace(/[<>&"\x27]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "\x27": return "&apos;";
      case "\"": return "&quot;";
      default: return c;
    }
  });
}

const fontMontserratBold: FontFace = { family: "MontserratBold", file: `${fontsDir}/Montserrat-Bold.ttf` };
const fontPoppinsBold: FontFace = { family: "PoppinsBold", file: `${fontsDir}/Poppins-Bold.ttf` };
const fontPlayfairBold: FontFace = { family: "PlayfairDisplayBold", file: `${fontsDir}/PlayfairDisplay-Bold.ttf` };
const fontBodoniBold: FontFace = { family: "BodoniModaBold", file: `${fontsDir}/BodoniModa-Bold.ttf` };
const fontLoraRegular: FontFace = { family: "LoraRegular", file: `${fontsDir}/Lora-Regular.ttf` };

/**
 * Renders Twitter Dark Card using authentic fonts and glassmorphism.
 */
async function renderTwitterCard(
  quoteText: string,
  author: string | null | undefined,
  accountName = "Success For Sure™",
  accountHandle = "@success.for.sure",
  scale = 1
): Promise<Buffer> {
  const cardW = Math.round(940 * scale);
  const quoteMaxWidth = Math.round((cardW - 80 * scale) / scale);
  const quoteMaxHeight = 650;

  const quoteRender = await renderFittedText(
    quoteText,
    fontPoppinsBold,
    quoteMaxWidth,
    quoteMaxHeight,
    "#F8FAFC",
    scale
  );

  let authorRenderBuffer: Buffer | null = null;
  if (author) {
    const res = await renderTextAtSize(
      `— ${author}`,
      fontLoraRegular,
      22 * scale,
      quoteMaxWidth * scale,
      "#60A5FA",
      scale
    );
    authorRenderBuffer = res.data;
  }

  const topHeaderH = Math.round(110 * scale);
  const authorH = authorRenderBuffer ? Math.round(45 * scale) : 0;
  const footerH = Math.round(65 * scale);
  const cardH = Math.round(topHeaderH + quoteRender.height + authorH + footerH + 30 * scale);
  const rx = Math.round(28 * scale);

  const baseCardSvg = `<svg width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3B82F6"/>
        <stop offset="100%" stop-color="#1D4ED8"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${cardW}" height="${cardH}" rx="${rx}" fill="rgba(10, 15, 24, 0.94)" stroke="rgba(255, 255, 255, 0.16)" stroke-width="${1.5 * scale}"/>
    <circle cx="${60 * scale}" cy="${55 * scale}" r="${24 * scale}" fill="url(#avatarGrad)"/>
    <text x="${60 * scale}" y="${63 * scale}" text-anchor="middle" font-family="sans-serif" font-size="${18 * scale}" font-weight="bold" fill="#FFFFFF">S</text>
    <text x="${98 * scale}" y="${50 * scale}" font-family="sans-serif" font-size="${22 * scale}" font-weight="700" fill="#FFFFFF">${escapeXml(accountName)}</text>
    <circle cx="${(98 + accountName.length * 13) * scale}" cy="${43 * scale}" r="${8 * scale}" fill="#1D9BF0"/>
    <path d="M${(94 + accountName.length * 13) * scale} ${43 * scale} l${3 * scale} ${3 * scale} l${5 * scale} -${5 * scale}" stroke="#FFFFFF" stroke-width="${2 * scale}" fill="none" stroke-linecap="round"/>
    <text x="${98 * scale}" y="${72 * scale}" font-family="sans-serif" font-size="${17 * scale}" font-weight="400" fill="#94A3B8">${escapeXml(accountHandle)} · 2h</text>
    <line x1="${35 * scale}" y1="${cardH - 55 * scale}" x2="${cardW - 35 * scale}" y2="${cardH - 55 * scale}" stroke="rgba(255,255,255,0.08)" stroke-width="${1 * scale}"/>
    <text x="${35 * scale}" y="${cardH - 22 * scale}" font-family="sans-serif" font-size="${16 * scale}" font-weight="500" fill="#94A3B8">
      💬 184     🔁 3.8K     ❤️ 24.2K     🔖 7.9K
    </text>
  </svg>`;

  const composites: Array<{ input: Buffer; left: number; top: number }> = [
    { input: quoteRender.buffer, left: Math.round(35 * scale), top: Math.round(topHeaderH) }
  ];

  if (authorRenderBuffer) {
    composites.push({
      input: authorRenderBuffer,
      left: Math.round(35 * scale),
      top: Math.round(topHeaderH + quoteRender.height + 12 * scale)
    });
  }

  return sharp(Buffer.from(baseCardSvg))
    .composite(composites)
    .png()
    .toBuffer();
}

/**
 * Renders Apple Notes Dark Card using authentic fonts and styling.
 */
async function renderAppleNotesCard(
  quoteText: string,
  author: string | null | undefined,
  category = "Mindset & Rules",
  scale = 1
): Promise<Buffer> {
  const cardW = Math.round(920 * scale);
  const quoteMaxWidth = Math.round((cardW - 80 * scale) / scale);
  const quoteMaxHeight = 650;

  const quoteRender = await renderFittedText(
    quoteText,
    fontMontserratBold,
    quoteMaxWidth,
    quoteMaxHeight,
    "#FAFAFA",
    scale
  );

  let authorRenderBuffer: Buffer | null = null;
  if (author) {
    const res = await renderTextAtSize(
      `— ${author}`,
      fontLoraRegular,
      22 * scale,
      quoteMaxWidth * scale,
      "#A1A1AA",
      scale
    );
    authorRenderBuffer = res.data;
  }

  const topHeaderH = Math.round(90 * scale);
  const authorH = authorRenderBuffer ? Math.round(40 * scale) : 0;
  const footerH = Math.round(50 * scale);
  const cardH = Math.round(topHeaderH + quoteRender.height + authorH + footerH + 30 * scale);
  const rx = Math.round(24 * scale);

  const baseSvg = `<svg width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${cardW}" height="${cardH}" rx="${rx}" fill="rgba(24, 24, 27, 0.95)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="${1 * scale}"/>
    <rect x="${40 * scale}" y="${26 * scale}" width="${20 * scale}" height="${16 * scale}" rx="${4 * scale}" fill="#EAB308"/>
    <text x="${70 * scale}" y="${40 * scale}" font-family="sans-serif" font-size="${17 * scale}" font-weight="700" fill="#EAB308">SUCCESS FOR SURE · ${escapeXml(category.toUpperCase())}</text>
    <text x="${cardW - 40 * scale}" y="${40 * scale}" text-anchor="end" font-family="sans-serif" font-size="${15 * scale}" font-weight="400" fill="#A1A1AA">Today, 9:41 AM</text>
    <line x1="${40 * scale}" y1="${56 * scale}" x2="${cardW - 40 * scale}" y2="${56 * scale}" stroke="rgba(255,255,255,0.10)" stroke-width="${1 * scale}"/>
    <text x="${40 * scale}" y="${cardH - 20 * scale}" font-family="sans-serif" font-size="${15 * scale}" font-weight="600" fill="#EAB308">
      ✓ Saved to Daily Mental Models · @success.for.sure
    </text>
  </svg>`;

  const composites: Array<{ input: Buffer; left: number; top: number }> = [
    { input: quoteRender.buffer, left: Math.round(40 * scale), top: Math.round(topHeaderH) }
  ];

  if (authorRenderBuffer) {
    composites.push({
      input: authorRenderBuffer,
      left: Math.round(40 * scale),
      top: Math.round(topHeaderH + quoteRender.height + 12 * scale)
    });
  }

  return sharp(Buffer.from(baseSvg))
    .composite(composites)
    .png()
    .toBuffer();
}

/**
 * Creates a transparent 1080x1920 PNG overlay with the perfectly centered card/quote,
 * custom fonts, drop shadows, and subtle gradient scrim (ideal for overlaying on real video B-roll).
 */

/**
 * Generates an authentic, dual-stage dark shadow mask for cards.
 * Avoids blurring the card itself (which creates bright halos from text/borders).
 */
async function renderCardShadow(
  width: number,
  height: number,
  rx: number,
  scale: number = 1
): Promise<{ buffer: Buffer; pad: number; offsetY: number }> {
  const pad = Math.round(50 * scale);
  const totalW = width + pad * 2;
  const totalH = height + pad * 2;
  const offsetY = Math.round(14 * scale);

  const shadowSvg = `<svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${pad}" y="${pad}" width="${width}" height="${height}" rx="${rx}" fill="rgba(0, 0, 0, 0.75)"/>
  </svg>`;

  const buffer = await sharp(Buffer.from(shadowSvg))
    .blur(Math.round(24 * scale))
    .png()
    .toBuffer();

  return { buffer, pad, offsetY };
}

/**
 * Generates a deep, pitch-black Gaussian blurred text shadow.
 */
async function renderTextShadowBuffer(
  text: string,
  font: FontFace,
  fontSize: number,
  maxWidth: number,
  scale: number = 1,
  blurRadius: number = 14
): Promise<Buffer> {
  const { data } = await renderTextAtSize(text, font, fontSize, maxWidth, "#000000", scale);
  return sharp(data)
    .blur(Math.max(1, Math.round(blurRadius * scale)))
    .png()
    .toBuffer();
}

export async function composeViralReelOverlay(input: ComposeViralReelInput): Promise<Buffer> {
  const {
    quoteText,
    author,
    category = "mindset",
    style,
    template = findTemplate("classic-wisdom"),
    accountName = "Success For Sure™",
    accountHandle = "@success.for.sure",
    scale = 1,
    width = 1080,
    height = 1920,
  } = input;

  const W = width * scale;
  const H = height * scale;

  // Base transparent 1080x1920 canvas
  const canvasSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Soft ambient scrim to guarantee 100% legibility over any bright video clips -->
      <linearGradient id="scrimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.30"/>
        <stop offset="25%" stop-color="#000000" stop-opacity="0.10"/>
        <stop offset="50%" stop-color="#000000" stop-opacity="0.45"/>
        <stop offset="75%" stop-color="#000000" stop-opacity="0.65"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#scrimGrad)"/>
  </svg>`;

  const base = await sharp(Buffer.from(canvasSvg)).png().toBuffer();

  if (style === "twitter-dark") {
    const cardBuffer = await renderTwitterCard(quoteText, author, accountName, accountHandle, scale);
    const meta = await sharp(cardBuffer).metadata();
    const cardW = meta.width || Math.round(940 * scale);
    const cardH = meta.height || Math.round(480 * scale);
    const left = Math.round((W - cardW) / 2);
    const top = Math.round((H - cardH) / 2); // Exact vertical & horizontal center

    const { buffer: shadowBuffer, pad, offsetY } = await renderCardShadow(cardW, cardH, 28 * scale, scale);
    return sharp(base)
      .composite([
        { input: shadowBuffer, left: left - pad, top: top - pad + offsetY },
        { input: cardBuffer, left, top }
      ])
      .png()
      .toBuffer();
  }

  if (style === "apple-notes") {
    const cardBuffer = await renderAppleNotesCard(quoteText, author, category, scale);
    const meta = await sharp(cardBuffer).metadata();
    const cardW = meta.width || Math.round(920 * scale);
    const cardH = meta.height || Math.round(460 * scale);
    const left = Math.round((W - cardW) / 2);
    const top = Math.round((H - cardH) / 2); // Exact vertical & horizontal center

    const { buffer: shadowBuffer, pad, offsetY } = await renderCardShadow(cardW, cardH, 24 * scale, scale);
    return sharp(base)
      .composite([
        { input: shadowBuffer, left: left - pad, top: top - pad + offsetY },
        { input: cardBuffer, left, top }
      ])
      .png()
      .toBuffer();
  }

  if (style === "editorial-luxury") {
    const font = template.quoteFont.family.includes("Bodoni") ? fontBodoniBold : fontPlayfairBold;
    const quoteRender = await renderFittedText(
      quoteText,
      font,
      (W - 160 * scale) / scale,
      750,
      "#FFFFFF",
      scale
    );

    let authorRenderBuffer: Buffer | null = null;
    let authorShadowBuffer: Buffer | null = null;
    if (author) {
      const authorText = `— ${author.toUpperCase()} —`;
      const res = await renderTextAtSize(
        authorText,
        fontLoraRegular,
        22 * scale,
        (W - 160 * scale),
        "#E2E8F0",
        scale
      );
      authorRenderBuffer = res.data;
      authorShadowBuffer = await renderTextShadowBuffer(authorText, fontLoraRegular, 22 * scale, W - 160 * scale, scale, 8);
    }

    const totalTextH = quoteRender.height + (authorRenderBuffer ? 50 * scale : 0);
    const startY = Math.round((H - totalTextH) / 2);
    const quoteLeft = Math.round((W - quoteRender.width) / 2);

    const quoteShadow = await renderTextShadowBuffer(quoteText, font, quoteRender.fontSize, (W - 160 * scale) / scale, scale, 14);

    const brandBadgeSvg = `<svg width="${W}" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect x="${W / 2 - 25 * scale}" y="${15 * scale}" width="${50 * scale}" height="${2.5 * scale}" rx="${1 * scale}" fill="#EAB308"/>
      <text x="${W / 2}" y="${48 * scale}" text-anchor="middle" font-family="sans-serif" font-size="${16 * scale}" font-weight="800" fill="#FFFFFF" letter-spacing="${4 * scale}">SUCCESS · FOR · SURE ™</text>
    </svg>`;
    const brandBadgeBuffer = Buffer.from(brandBadgeSvg);

    const composites: Array<{ input: Buffer; left: number; top: number }> = [
      { input: brandBadgeBuffer, left: 0, top: startY - Math.round(75 * scale) },
      { input: quoteShadow, left: quoteLeft, top: startY + Math.round(6 * scale) },
      { input: quoteRender.buffer, left: quoteLeft, top: startY }
    ];

    if (authorRenderBuffer && authorShadowBuffer) {
      const authorMeta = await sharp(authorRenderBuffer).metadata();
      const authorLeft = Math.round((W - (authorMeta.width || 400 * scale)) / 2);
      const authorTop = startY + quoteRender.height + 35 * scale;
      composites.push({ input: authorShadowBuffer, left: authorLeft, top: authorTop + Math.round(4 * scale) });
      composites.push({ input: authorRenderBuffer, left: authorLeft, top: authorTop });
    }

    return sharp(base)
      .composite(composites)
      .png()
      .toBuffer();
  }

  // Fallback: classic-glass
  const quoteRender = await renderFittedText(
    quoteText,
    template.quoteFont,
    (W - 240 * scale) / scale,
    700,
    "#FFFFFF",
    scale
  );

  let authorRenderBuffer: Buffer | null = null;
  let authorShadowBuffer: Buffer | null = null;
  if (author) {
    const authorText = `— ${author}`;
    const res = await renderTextAtSize(
      authorText,
      template.authorFont,
      24 * scale,
      (W - 240 * scale),
      "#FFFFFFBF",
      scale
    );
    authorRenderBuffer = res.data;
    authorShadowBuffer = await renderTextShadowBuffer(authorText, template.authorFont, 24 * scale, (W - 240 * scale), scale, 8);
  }

  const cardW = Math.round(W - 120 * scale);
  const cardH = Math.round(quoteRender.height + (authorRenderBuffer ? 60 * scale : 0) + 180 * scale);
  const cardLeft = Math.round((W - cardW) / 2);
  const cardTop = Math.round((H - cardH) / 2);

  const glassSvg = `<svg width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(255, 255, 255, 0.16)"/>
        <stop offset="100%" stop-color="rgba(255, 255, 255, 0.04)"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${cardW}" height="${cardH}" rx="${28 * scale}" fill="url(#glassGrad)" stroke="rgba(255, 255, 255, 0.32)" stroke-width="${1.5 * scale}"/>
    <rect x="${cardW / 2 - 135 * scale}" y="${22 * scale}" width="${270 * scale}" height="${36 * scale}" rx="${18 * scale}" fill="rgba(255, 255, 255, 0.12)" stroke="rgba(255, 255, 255, 0.28)" stroke-width="${1 * scale}"/>
    <text x="${cardW / 2}" y="${46 * scale}" text-anchor="middle" font-family="sans-serif" font-size="${15 * scale}" font-weight="800" fill="#FFFFFF" letter-spacing="${3 * scale}">SUCCESS · FOR · SURE ™</text>
  </svg>`;

  const quoteLeft = Math.round(cardLeft + 60 * scale);
  const quoteTop = Math.round(cardTop + 80 * scale);

  const { buffer: cardShadow, pad, offsetY } = await renderCardShadow(cardW, cardH, 28 * scale, scale);
  const quoteShadow = await renderTextShadowBuffer(quoteText, template.quoteFont, quoteRender.fontSize, (W - 240 * scale) / scale, scale, 12);

  const composites: Array<{ input: Buffer; left: number; top: number }> = [
    { input: cardShadow, left: cardLeft - pad, top: cardTop - pad + offsetY },
    { input: Buffer.from(glassSvg), left: cardLeft, top: cardTop },
    { input: quoteShadow, left: quoteLeft, top: quoteTop + Math.round(4 * scale) },
    { input: quoteRender.buffer, left: quoteLeft, top: quoteTop }
  ];

  if (authorRenderBuffer && authorShadowBuffer) {
    const authorTop = quoteTop + quoteRender.height + 20 * scale;
    composites.push({ input: authorShadowBuffer, left: quoteLeft, top: authorTop + Math.round(3 * scale) });
    composites.push({ input: authorRenderBuffer, left: quoteLeft, top: authorTop });
  }

  return sharp(base)
    .composite(composites)
    .png()
    .toBuffer();
}

/**
 * High-level viral 9:16 Reel image compositor (bakes background photo for static fallback / feeds).
 */
export async function composeViralReelImage(input: ComposeViralReelInput): Promise<Buffer> {
  const {
    backgroundBuffer,
    quoteText,
    author,
    category = "mindset",
    style,
    template = findTemplate("classic-wisdom"),
    accountName = "Success For Sure™",
    accountHandle = "@success.for.sure",
    scale = 1,
    width = 1080,
    height = 1920,
    grainRandom,
  } = input;

  const W = width * scale;
  const H = height * scale;

  let baseBuffer = backgroundBuffer
    ? await sharp(backgroundBuffer)
        .resize(W, H, { fit: "cover" })
        .blur(1.5)
        .png()
        .toBuffer()
    : await sharp({
        create: { width: W, height: H, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } }
      }).png().toBuffer();

  const vignette = await renderVignette(W, H, "dark");
  baseBuffer = await sharp(baseBuffer)
    .composite([{ input: vignette, left: 0, top: 0 }])
    .png()
    .toBuffer();

  const grain = await grainTexturePng(W, H, grainRandom);
  const grainWithOpacity = await sharp(grain)
    .ensureAlpha(GRAIN_TEXTURE_OPACITY)
    .png()
    .toBuffer();
  baseBuffer = await sharp(baseBuffer)
    .composite([{ input: grainWithOpacity, blend: "overlay" }])
    .png()
    .toBuffer();

  const overlayPng = await composeViralReelOverlay({
    quoteText,
    author,
    category,
    style,
    template,
    accountName,
    accountHandle,
    scale,
    width,
    height,
  });

  return sharp(baseBuffer)
    .composite([{ input: overlayPng, left: 0, top: 0 }])
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}

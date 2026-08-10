import sharp from "sharp";
import type { Darkness } from "./darkness-classifier.js";

export interface GlassCardOptions {
  width: number;
  height: number;
  mode: Darkness;
  categoryName?: string;
  scrimOpacity?: number;
}

/**
 * Generates an ultra-premium Apple Liquid Glass card overlay with:
 * - High-transparency refractive frosted glass gradient container
 * - Specular top rim lighting & multi-stop 3D drop shadow
 * - Minimalist brand watermark badge at the top (✦ SUCCESS.FOR.SURE™ ✦)
 * - Symmetrical paired opening (") and closing (") quotation mark accents
 *   anchored close to the actual text zone, not orphaned in corners
 *
 * Fix log:
 *   #5  — Card side margins increased (card never wider than IMAGE_WIDTH - 200)
 *   #6  — cardPaddingTop/Bottom increased for breathing room
 *   #7  — Brand badge text changed to spaced caps; font size 12 → 13px
 *   #8  — Quote marks re-anchored to sit near the text block, not card corners
 *   #9  — Author receives em-dash prefix + muted colour (colour injected by compositor)
 *   #11 — Light-mode card border opacity raised; outer glow added for contrast
 */
export async function renderGlassCard(options: GlassCardOptions): Promise<Buffer> {
  const { width, height, mode } = options;

  const isDark = mode === "dark";

  // Apple Liquid Glass High-Transparency Values
  const bgGradientStart = isDark
    ? "rgba(16, 16, 20, 0.52)"
    : "rgba(255, 255, 255, 0.56)";
  const bgGradientEnd = isDark
    ? "rgba(10, 10, 12, 0.42)"
    : "rgba(240, 244, 252, 0.46)";

  // Fix #11: light-mode border opacity raised 0.65 → 0.88 for better contrast
  const borderGradientStart = isDark ? "rgba(255, 255, 255, 0.38)" : "rgba(255, 255, 255, 0.88)";
  const borderGradientEnd   = isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(0, 0, 0, 0.18)";

  const shadowColor     = isDark ? "rgba(0, 0, 0, 0.60)" : "rgba(0, 0, 0, 0.22)";
  const quoteAccentColor = isDark ? "rgba(255, 255, 255, 0.22)" : "rgba(15, 23, 42, 0.20)";
  const badgeTextColor  = isDark ? "rgba(255, 255, 255, 0.90)" : "rgba(15, 23, 42, 0.90)";
  const badgeBg         = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.45)";
  const badgeBorder     = isDark ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.18)";
  const specularColor   = isDark ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.85)";

  // Fix #11: outer glow on light-mode cards so card "pops" against pale backgrounds
  const outerGlowColor  = isDark ? "rgba(0,0,0,0)" : "rgba(0, 0, 0, 0.12)";

  // Fix #7: spaced-caps brand name looks like a brand, not a URL
  const brandTitle = "SUCCESS · FOR · SURE ™";

  // Opening mark: gracefully nested in top-left, clear of text
  const openMarkX = 36;
  const openMarkY = 68;
  // Closing mark: gracefully nested in bottom-right, clear of author line
  const closeMarkX = width - 36;
  const closeMarkY = height - 24;

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="liquidGlassBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradientStart}" />
      <stop offset="100%" stop-color="${bgGradientEnd}" />
    </linearGradient>

    <linearGradient id="liquidGlassBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${borderGradientStart}" />
      <stop offset="100%" stop-color="${borderGradientEnd}" />
    </linearGradient>

    <linearGradient id="specularGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="transparent" />
      <stop offset="30%" stop-color="${specularColor}" />
      <stop offset="70%" stop-color="${specularColor}" />
      <stop offset="100%" stop-color="transparent" />
    </linearGradient>

    <!-- Fix #11: outer glow for light-mode depth -->
    <filter id="outerGlow" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="0" stdDeviation="16" flood-color="${outerGlowColor}" />
    </filter>

    <filter id="liquidShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="28" flood-color="${shadowColor}" />
    </filter>
  </defs>

  <!-- Liquid Glass Container Body -->
  <rect
    x="2"
    y="2"
    width="${width - 4}"
    height="${height - 4}"
    rx="36"
    ry="36"
    fill="url(#liquidGlassBg)"
    stroke="url(#liquidGlassBorder)"
    stroke-width="1.8"
    filter="url(#outerGlow)"
  />
  <!-- Inner shadow layer for depth -->
  <rect
    x="2"
    y="2"
    width="${width - 4}"
    height="${height - 4}"
    rx="36"
    ry="36"
    fill="none"
    stroke="none"
    filter="url(#liquidShadow)"
  />

  <!-- Top Specular Rim Lighting Highlight -->
  <path
    d="M 40 3 Q ${width / 2} 1 ${width - 40} 3"
    stroke="url(#specularGlow)"
    stroke-width="2"
    fill="none"
  />

  <!-- Fix #7: Brand badge — spaced caps, 13px, not URL-looking -->
  <g transform="translate(${width / 2}, 38)">
    <rect
      x="-118"
      y="-14"
      width="236"
      height="28"
      rx="14"
      fill="${badgeBg}"
      stroke="${badgeBorder}"
      stroke-width="1"
    />
    <text
      x="0"
      y="4"
      text-anchor="middle"
      fill="${badgeTextColor}"
      font-family="system-ui, -apple-system, sans-serif"
      font-size="13"
      font-weight="700"
      letter-spacing="2"
    >${brandTitle}</text>
  </g>

  <!-- Opening quote mark anchored near top of text zone -->
  <text
    x="${openMarkX}"
    y="${openMarkY}"
    text-anchor="start"
    fill="${quoteAccentColor}"
    font-family="Georgia, serif"
    font-size="46"
    font-weight="bold"
  >\u201C</text>

  <!-- Closing quote mark anchored near bottom of text zone -->
  <text
    x="${closeMarkX}"
    y="${closeMarkY}"
    text-anchor="end"
    fill="${quoteAccentColor}"
    font-family="Georgia, serif"
    font-size="46"
    font-weight="bold"
  >\u201D</text>
</svg>
`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

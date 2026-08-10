import sharp from "sharp";

// Generated programmatically via sharp (already a core dependency) rather
// than committing binary PNG fixtures -- single source of truth, no binary
// files to maintain, and the exact pixel values are visible in the test
// that uses them.

export async function solidColorImage(
  width: number,
  height: number,
  rgb: { r: number; g: number; b: number },
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: rgb },
  })
    .png()
    .toBuffer();
}

/**
 * Top `topRatio` fraction of the image one color, the rest another -- for
 * testing the darkness classifier's fraction threshold precisely (e.g.
 * topRatio=0.7 with a dark top color produces a genuinely 70%-dark image).
 */
export async function verticalSplitImage(
  width: number,
  height: number,
  top: { r: number; g: number; b: number },
  bottom: { r: number; g: number; b: number },
  topRatio = 0.5,
): Promise<Buffer> {
  const topHeight = Math.round(height * topRatio);
  const bottomHeight = height - topHeight;
  const topPart = await sharp({
    create: { width, height: topHeight, channels: 3, background: top },
  })
    .png()
    .toBuffer();
  const bottomPart = await sharp({
    create: { width, height: bottomHeight, channels: 3, background: bottom },
  })
    .png()
    .toBuffer();

  return sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      { input: topPart, top: 0, left: 0 },
      { input: bottomPart, top: topHeight, left: 0 },
    ])
    .png()
    .toBuffer();
}

/** High-frequency black/white checkerboard -- deliberately high luminance stdev. */
export async function checkerboardImage(width: number, height: number, cell = 4): Promise<Buffer> {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isWhite = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const value = isWhite ? 255 : 0;
      const offset = (y * width + x) * channels;
      raw[offset] = value;
      raw[offset + 1] = value;
      raw[offset + 2] = value;
    }
  }
  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
}

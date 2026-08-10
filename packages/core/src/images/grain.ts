import sharp from "sharp";

/**
 * Generates a grayscale noise texture buffer for the "organic/natural"
 * grain overlay (plan.md §7.11 step 3, backed by research/aesthetic-trends.md).
 * Generated fresh per call rather than as a pre-built static asset checked
 * into the repo -- a plain per-pixel random buffer at these dimensions
 * takes low tens of milliseconds, so the "static asset" optimization the
 * plan originally suggested isn't needed (decision ladder: don't add an
 * asset-management step a runtime computation already satisfies cheaply).
 * The per-post randomness is also a minor plus: no two posts share the
 * exact same grain pattern.
 */
/**
 * `random` is injectable (defaults to Math.random) so tests that need to
 * compare two composed images for a reason OTHER than grain noise (e.g.
 * "does mode actually change the render") can hold grain constant and
 * eliminate it as a confound -- two default calls will otherwise always
 * differ from each other regardless of any other input.
 */
export function generateGrainTexture(width: number, height: number, random: () => number = Math.random): Buffer {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let i = 0; i < raw.length; i++) {
    raw[i] = Math.floor(random() * 256);
  }
  return raw;
}

export async function grainTexturePng(
  width: number,
  height: number,
  random: () => number = Math.random,
): Promise<Buffer> {
  const raw = generateGrainTexture(width, height, random);
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/**
 * ITU-R BT.601 luminance, 0-255 scale, matching plan.md §2.3's
 * LUMINANCE_FORMULA exactly. `rgb` must be a flat RGB (no alpha) buffer —
 * callers are responsible for calling .removeAlpha() before .raw().
 */
export function computeLuminances(rgb: Buffer): number[] {
  if (rgb.length % 3 !== 0) {
    throw new Error(
      `computeLuminances expects a flat RGB buffer (length divisible by 3), got length ${rgb.length}`,
    );
  }
  const luminances: number[] = new Array(rgb.length / 3);
  for (let i = 0, p = 0; i < rgb.length; i += 3, p++) {
    const r = rgb[i] ?? 0;
    const g = rgb[i + 1] ?? 0;
    const b = rgb[i + 2] ?? 0;
    luminances[p] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return luminances;
}

export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

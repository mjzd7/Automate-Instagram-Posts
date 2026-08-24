import { readFile } from "node:fs/promises";
import { z } from "zod";

// Series definitions for the multi-series content pipeline
// (docs/PLAN-multi-series.md §4.1). Definitions are git-native config;
// runtime state (episode counters) lives in the `series` table — see
// db/schema.ts. Mirrors the categories.ts loader pattern so apps/web can
// reuse parseSeries for form validation.

export const seriesSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  slot: z.enum(["am", "pm"]),
});

export const seriesConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  templateIds: z.array(z.string().min(1)).min(1),
  captionPromptRef: z.string().min(1),
  hashtagCategory: z.string().min(1),
  slots: z.array(seriesSlotSchema).min(1),
  maxPerDay: z.number().int().min(1),
  active: z.boolean(),
});

const seriesFileSchema = z.array(seriesConfigSchema);

export type SeriesSlot = z.infer<typeof seriesSlotSchema>;
export type SeriesConfig = z.infer<typeof seriesConfigSchema>;

export function parseSeries(raw: unknown): SeriesConfig[] {
  const result = seriesFileSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid series config:\n${details}`);
  }
  // Duplicate ids would silently merge two cadences onto one episode counter.
  const seen = new Set<string>();
  for (const s of result.data) {
    if (seen.has(s.id)) {
      throw new Error(`Invalid series config:\n  - duplicate series id: ${s.id}`);
    }
    seen.add(s.id);
  }
  return result.data;
}

export async function loadSeries(filePath: string): Promise<SeriesConfig[]> {
  const contents = await readFile(filePath, "utf-8");
  return parseSeries(JSON.parse(contents));
}

import { z } from "zod";
import { lintPackItem } from "../moderation/text-lint.js";
import { packItemSchema, type PackItem } from "../quotes/content-pack.js";
import { buildGenerationPrompt } from "./prompts.js";

export type TextGenerator = (prompt: string) => Promise<string>;

export interface DroppedItem {
  index: number;
  violations: Array<{ rule: string; message: string }>;
}

export interface GeneratePackResult {
  items: PackItem[];
  dropped: DroppedItem[];
}

// Stage 1: what the model was asked to emit. Deliberately looser than the
// pack contract — length bands, status, and id assignment happen after.
const modelOutputSchema = z.object({
  text: z.string().default(""),
  archetype: z.string().nullish(),
  framework: z
    .object({ title: z.string(), steps: z.array(z.string()) })
    .nullish(),
  captionQuestion: z.string().nullish(),
  utilityLine: z.string().nullish(),
  ctaTag: z.string().nullish(),
});

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Full supply chain per item: prompt → provider → JSON extract → model-shape
 * validation → pack-contract validation → moderation lint. Provider failures
 * abort loudly (a broken batch should surface, not silently shrink);
 * per-item content problems are dropped with their violation report.
 */
export async function generatePackItems(
  seriesId: string,
  count: number,
  generate: TextGenerator,
  now: Date = new Date(),
): Promise<GeneratePackResult> {
  const timestamp = now.toISOString();
  const month = timestamp.slice(0, 7);
  const items: PackItem[] = [];
  const dropped: DroppedItem[] = [];

  for (let index = 0; index < count; index++) {
    let rawResponse: string;
    try {
      rawResponse = await generate(buildGenerationPrompt(seriesId, index));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`Provider failed at item ${index + 1}: ${message}`);
    }

    let json: unknown;
    try {
      json = JSON.parse(stripFences(rawResponse)) as unknown;
    } catch {
      dropped.push({
        index,
        violations: [{ rule: "unparsable", message: rawResponse.slice(0, 120) }],
      });
      continue;
    }
    const modelJson = Array.isArray(json) ? json[0] : json;

    const modelParsed = modelOutputSchema.safeParse(modelJson);
    if (!modelParsed.success) {
      dropped.push({
        index,
        violations: modelParsed.error.issues.map((issue) => ({
          rule: "schema",
          message: `${issue.path.join(".")}: ${issue.message}`,
        })),
      });
      continue;
    }

    const candidate = {
      id: `${seriesId}-${month}-${String(index + 1).padStart(3, "0")}`,
      seriesId,
      archetype: modelParsed.data.archetype ?? null,
      text: modelParsed.data.text,
      framework: modelParsed.data.framework ?? null,
      captionQuestion: modelParsed.data.captionQuestion ?? null,
      utilityLine: modelParsed.data.utilityLine ?? null,
      ctaTag: modelParsed.data.ctaTag ?? null,
      status: "draft",
      generatedAt: timestamp,
    };
    const validated = packItemSchema.safeParse(candidate);
    if (!validated.success) {
      dropped.push({
        index,
        violations: validated.error.issues.map((issue) => ({
          rule: "schema",
          message: `${issue.path.join(".")}: ${issue.message}`,
        })),
      });
      continue;
    }

    const violations = lintPackItem(validated.data);
    if (violations.length > 0) {
      dropped.push({ index, violations });
      continue;
    }

    items.push(validated.data);
  }

  return { items, dropped };
}

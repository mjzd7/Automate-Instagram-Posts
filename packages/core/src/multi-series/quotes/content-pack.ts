import { readFile } from "node:fs/promises";
import { z } from "zod";

// Content packs are the multi-series supply chain (docs/PLAN-multi-series.md
// §4.2): LLM-generated post content committed as git-native JSON under
// data/content-packs/<seriesId>/YYYY-MM.json. Only status:"approved" items
// are consumable by the batch runner.

export const packItemStatusSchema = z.enum(["draft", "approved", "rejected"]);

export const packItemSchema = z.object({
  id: z.string().min(1),
  seriesId: z.string().min(1),
  archetype: z.string().min(1).nullable().optional(),
  text: z.string().min(1),
  framework: z
    .object({
      title: z.string().min(1),
      steps: z.array(z.string().min(1)).min(3).max(5),
    })
    .nullable()
    .optional(),
  captionQuestion: z.string().min(1).nullable().optional(),
  utilityLine: z.string().min(1).nullable().optional(),
  ctaTag: z.string().min(1).nullable().optional(),
  status: packItemStatusSchema,
  generatedAt: z.iso.datetime(),
});

const packFileSchema = z.array(packItemSchema);

export type PackItemStatus = z.infer<typeof packItemStatusSchema>;
export type PackItem = z.infer<typeof packItemSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

export function parsePackItems(raw: unknown): PackItem[] {
  const result = packFileSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid content pack:\n${formatIssues(result.error)}`);
  }
  const seen = new Set<string>();
  for (const item of result.data) {
    if (seen.has(item.id)) {
      throw new Error(`Invalid content pack:\n  - duplicate item id: ${item.id}`);
    }
    seen.add(item.id);
  }
  return result.data;
}

export function selectApprovedItems(items: PackItem[], seriesId?: string): PackItem[] {
  return items
    .filter((item) => item.status === "approved")
    .filter((item) => seriesId === undefined || item.seriesId === seriesId)
    .sort((a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt));
}

export async function loadApprovedItems(
  filePath: string,
  seriesId?: string,
): Promise<PackItem[]> {
  const contents = await readFile(filePath, "utf-8");
  return selectApprovedItems(parsePackItems(JSON.parse(contents)), seriesId);
}

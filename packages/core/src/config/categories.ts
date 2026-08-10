import { readFile } from "node:fs/promises";
import { z } from "zod";

// Mirrors plan.md §6.2 (data/categories.json shape) and §5 (categories table).
// Exported so apps/web can validate a single category form submission
// against the exact same schema, instead of re-deriving it.
export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  active: z.boolean(),
});

const categoriesFileSchema = z.array(categorySchema);

export type Category = z.infer<typeof categorySchema>;

export function parseCategories(raw: unknown): Category[] {
  const result = categoriesFileSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid categories config:\n${details}`);
  }
  return result.data;
}

export async function loadCategories(filePath: string): Promise<Category[]> {
  const contents = await readFile(filePath, "utf-8");
  return parseCategories(JSON.parse(contents));
}

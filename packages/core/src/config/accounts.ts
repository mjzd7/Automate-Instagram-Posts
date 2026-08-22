import { readFile } from "node:fs/promises";
import { z } from "zod";

// Mirrors plan.md §6.1 (data/accounts.json shape) and §5 (accounts table).
// Exported so apps/web can validate a single account form submission
// against the exact same schema, instead of re-deriving it.
export const accountSchema = z.object({
  id: z.string().min(1),
  igUserId: z.string().min(1),
  fbPageId: z.string().min(1),
  threadsUserId: z.string().min(1).nullable(),
  categoryFocus: z.array(z.string().min(1)).min(1),
  timezone: z.string().min(1),
  postingHoursLocal: z.array(z.number().int().min(0).max(23)).min(1),
  active: z.boolean(),
  // Optional schedule extensions (dashboard-editable, P4 of the overhaul):
  // defaulted so pre-overhaul accounts.json files load unchanged.
  dailyCap: z.number().int().min(0).max(22).optional(),
  blackoutDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  paused: z.boolean().optional(),
  enabledTemplates: z.array(z.string().min(1)).optional(),
});

const accountsFileSchema = z.array(accountSchema);

export type Account = z.infer<typeof accountSchema>;

export function parseAccounts(raw: unknown): Account[] {
  const result = accountsFileSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid accounts config:\n${details}`);
  }
  return result.data;
}

export async function loadAccounts(filePath: string): Promise<Account[]> {
  const contents = await readFile(filePath, "utf-8");
  return parseAccounts(JSON.parse(contents));
}

export function findAccount(accounts: Account[], accountId: string): Account {
  const account = accounts.find((entry) => entry.id === accountId);
  if (!account) {
    throw new Error(`No account found with id "${accountId}"`);
  }
  return account;
}

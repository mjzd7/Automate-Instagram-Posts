"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { accountSchema } from "core/src/config/accounts";
import { categorySchema } from "core/src/config/categories";
import { getConfigHistory, isRestorablePath } from "@/lib/config-history";
import { getConfigWriter } from "@/lib/writer";

const SCHEMA_FOR: Record<string, (raw: unknown) => boolean> = {
  "data/accounts.json": (raw) => Array.isArray(raw) && raw.every((item) => accountSchema.safeParse(item).success),
  "data/categories.json": (raw) => Array.isArray(raw) && raw.every((item) => categorySchema.safeParse(item).success),
};

export async function restoreConfig(formData: FormData): Promise<void> {
  const path = String(formData.get("path") ?? "");
  const sha = String(formData.get("sha") ?? "");
  let failure: string | null = null;
  let succeeded = false;

  if (!isRestorablePath(path)) {
    failure = `path not restorable: ${path}`;
  } else {
    try {
      const api = getConfigHistory();
      const content = await api.getContentAt(path, sha);
      if (!SCHEMA_FOR[path]?.(content)) {
        failure = `${path}@${sha.slice(0, 7)} fails current schema validation — refusing restore`;
      } else {
        await getConfigWriter().writeJsonFile(
          path,
          content,
          `dashboard: restore ${path} to ${sha.slice(0, 7)}`,
        );
        succeeded = true;
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : "unknown restore failure";
    }
  }

  if (failure) {
    redirect(`/config?error=${encodeURIComponent(failure)}`);
  }
  if (succeeded) revalidatePath("/config");
  redirect(`/config?restored=${encodeURIComponent(path)}&sha=${encodeURIComponent(sha)}`);
}

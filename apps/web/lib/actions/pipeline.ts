"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { TEMPLATE_METADATA } from "core/src/images/template-metadata";
import { generateMonth, regenerateMonth } from "core/src/schedule/generator";
import { getAccounts } from "@/lib/db";
import { loadPipelineFile } from "@/lib/pipeline-files";
import { getConfigWriter } from "@/lib/writer";

export async function buildPipeline(formData: FormData): Promise<void> {
  const month = String(formData.get("month") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    redirect(`/pipeline?error=${encodeURIComponent(`month must look like YYYY-MM, got "${month}"`)}`);
  }
  const accounts = await getAccounts();
  const existing = await loadPipelineFile(month);
  const fresh = generateMonth(month, accounts, {
    templateIdsArray: TEMPLATE_METADATA.map((t) => t.id),
  });
  const merged = existing && existing.month === month ? regenerateMonth(existing, fresh) : fresh;
  await getConfigWriter().writeJsonFile(
    `data/pipeline/${month}.json`,
    merged,
    `dashboard: ${existing ? "regenerate" : "generate"} pipeline ${month} (${merged.entries.length} entries)`,
  );
  revalidatePath("/pipeline");
  redirect(`/pipeline?month=${month}`);
}

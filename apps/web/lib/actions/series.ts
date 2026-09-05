"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getConfigWriter } from "@/lib/writer";
import { loadSeriesConfig, SERIES_FILE_PATH } from "@/lib/series-files";
import { parseSeries, type SeriesConfig } from "core/src/config/series";

/**
 * Flips one series' active flag. Reads the config FRESH so a stale page never
 * clobbers an interleaved write (same discipline as the schedules action).
 * Pause requires confirmation in the UI (details/summary two-phase form);
 * resume is single-click (locked decision D4).
 */
export async function toggleSeriesActive(formData: FormData): Promise<void> {
  const seriesId = String(formData.get("seriesId") ?? "");
  const nextActive = String(formData.get("nextActive") ?? "") === "true";

  const current = await loadSeriesConfig();
  const target = current.find((s) => s.id === seriesId);
  if (!target) {
    redirect(`/series?error=${encodeURIComponent(`unknown series "${seriesId}"`)}`);
  }
  if (target.active === nextActive) {
    redirect("/series");
  }

  const next: SeriesConfig[] = current.map((s) => (s.id === seriesId ? { ...s, active: nextActive } : s));
  parseSeries(next);
  await getConfigWriter().writeJsonFile(
    SERIES_FILE_PATH,
    next,
    `dashboard: ${nextActive ? "resume" : "pause"} series ${seriesId}`,
  );
  revalidatePath("/series");
  revalidatePath(`/series/${seriesId}`);
  redirect(`/series?done=${encodeURIComponent(`${target.name} ${nextActive ? "resumed" : "paused"}`)}`);
}

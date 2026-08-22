"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isValidTimeZone } from "core/src/schedule/wall-time";
import { getAccounts } from "@/lib/db";
import type { Account } from "@/lib/schemas";
import { getConfigWriter } from "@/lib/writer";

function csvToNumbers(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number);
}

function csvToStrings(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function saveSchedule(formData: FormData): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "");
  const accounts = await getAccounts();
  const target = accounts.find((a) => a.id === accountId);
  if (!target) redirect(`/schedules?error=${encodeURIComponent(`unknown account ${accountId}`)}`);

  const timezone = String(formData.get("timezone") ?? "").trim();
  if (!isValidTimeZone(timezone)) {
    redirect(`/schedules?error=${encodeURIComponent(`${accountId}: invalid IANA timezone "${timezone}"`)}`);
  }
  const postingHoursLocal = csvToNumbers(String(formData.get("postingHoursLocal") ?? ""));
  const capRaw = String(formData.get("dailyCap") ?? "").trim();

  const updated: Account = {
    ...target,
    timezone,
    postingHoursLocal,
    dailyCap: capRaw.length > 0 ? Math.max(0, Math.min(22, Number(capRaw))) : undefined,
    blackoutDates: csvToStrings(String(formData.get("blackoutDates") ?? "")),
    paused: formData.get("paused") === "on",
  };

  const next = accounts.map((a) => (a.id === accountId ? updated : a));
  await getConfigWriter().writeJsonFile("data/accounts.json", next, `dashboard: update schedule ${accountId}`);
  revalidatePath("/schedules");
  redirect("/schedules");
}

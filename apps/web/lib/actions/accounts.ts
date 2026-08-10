"use server";

import { redirect } from "next/navigation";
import { getAccounts } from "@/lib/db";
import { writeJsonFile } from "@/lib/github-content";
import { accountSchema, type Account } from "@/lib/schemas";

function parseHours(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number);
}

export async function saveAccount(formData: FormData) {
  const originalId = String(formData.get("originalId") ?? "");
  const threadsUserIdRaw = String(formData.get("threadsUserId") ?? "").trim();

  const candidate = {
    id: String(formData.get("id") ?? ""),
    igUserId: String(formData.get("igUserId") ?? ""),
    fbPageId: String(formData.get("fbPageId") ?? ""),
    threadsUserId: threadsUserIdRaw.length > 0 ? threadsUserIdRaw : null,
    categoryFocus: formData.getAll("categoryFocus").map(String),
    timezone: String(formData.get("timezone") ?? ""),
    postingHoursLocal: parseHours(String(formData.get("postingHoursLocal") ?? "")),
    active: formData.get("active") === "on",
  };

  const result = accountSchema.safeParse(candidate);
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    redirect(`/accounts?error=${encodeURIComponent(message)}`);
  }

  const accounts = await getAccounts();
  const next: Account[] = originalId
    ? accounts.map((account) => (account.id === originalId ? result.data : account))
    : [...accounts, result.data];

  await writeJsonFile(
    "data/accounts.json",
    next,
    `dashboard: ${originalId ? "update" : "add"} account ${result.data.id}`,
  );
  redirect("/accounts");
}

export async function deleteAccount(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const accounts = await getAccounts();
  const next = accounts.filter((account) => account.id !== id);
  await writeJsonFile("data/accounts.json", next, `dashboard: delete account ${id}`);
  redirect("/accounts");
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { RunnerUnavailableError, getRunner } from "@/lib/runner";

export async function triggerPostRun(): Promise<void> {
  try {
    await getRunner().dispatchPost();
  } catch (error) {
    const message =
      error instanceof RunnerUnavailableError
        ? error.message
        : error instanceof Error
          ? error.message
          : "unknown dispatch failure";
    redirect(`/pipeline?error=${encodeURIComponent(`dispatch failed: ${message}`)}`);
  }
  revalidatePath("/");
  redirect("/?dispatched=1");
}

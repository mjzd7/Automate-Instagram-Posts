"use server";

import { redirect } from "next/navigation";
import { getCategories } from "@/lib/db";
import { writeJsonFile } from "@/lib/github-content";
import { categorySchema, type Category } from "@/lib/schemas";

export async function saveCategory(formData: FormData) {
  const originalId = String(formData.get("originalId") ?? "");
  const descriptionRaw = String(formData.get("description") ?? "").trim();

  const candidate = {
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: descriptionRaw.length > 0 ? descriptionRaw : undefined,
    active: formData.get("active") === "on",
  };

  const result = categorySchema.safeParse(candidate);
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    redirect(`/categories?error=${encodeURIComponent(message)}`);
  }

  const categories = await getCategories();
  const next: Category[] = originalId
    ? categories.map((category) => (category.id === originalId ? result.data : category))
    : [...categories, result.data];

  await writeJsonFile(
    "data/categories.json",
    next,
    `dashboard: ${originalId ? "update" : "add"} category ${result.data.id}`,
  );
  redirect("/categories");
}

export async function deleteCategory(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const categories = await getCategories();
  const next = categories.filter((category) => category.id !== id);
  await writeJsonFile("data/categories.json", next, `dashboard: delete category ${id}`);
  redirect("/categories");
}

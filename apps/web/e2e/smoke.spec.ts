import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const FIXTURES_ROOT = path.resolve(__dirname, "fixtures");

test.describe("smoke: authenticated shell + mock-writer seam", () => {
  test("nav renders all dashboard links", async ({ page }) => {
    await page.goto("/");
    for (const label of ["Overview", "Accounts", "Categories", "Templates", "History", "Preview"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("fixture accounts render from DATA_DIR", async ({ page }) => {
    await page.goto("/accounts");
    await expect(page.getByText("e2e-main")).toBeVisible();
    await expect(page.getByText("e2e-stoic")).toBeVisible();
  });

  test("adding an account writes through the local seam", async ({ page }) => {
    await page.goto("/accounts");
    // Every existing account embeds its own AccountForm with identical
    // labels; scope strictly to the bare "Add account" form.
    const addForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add account" }) });
    await addForm.getByLabel("Account id (slug)").fill("e2e-added");
    await addForm.getByLabel("Instagram user id").fill("17841400000000003");
    await addForm.getByLabel("Facebook page id").fill("102900000000003");
    await addForm.getByLabel("Timezone (IANA, e.g. America/New_York)").fill("UTC");
    await addForm.getByLabel("Posting hours local (comma-separated, 0-23)").fill("10, 18");
    await addForm.getByLabel("Motivational").check();
    await addForm.getByRole("button", { name: "Add account" }).click();

    await expect(page).toHaveURL(/\/accounts$/);
    await expect(page.getByText("e2e-added")).toBeVisible();

    const raw = await readFile(path.join(FIXTURES_ROOT, "data/accounts.json"), "utf-8");
    const accounts = JSON.parse(raw) as Array<{ id: string; postingHoursLocal: number[] }>;
    const added = accounts.find((account) => account.id === "e2e-added");
    expect(added).toBeDefined();
    expect(added?.postingHoursLocal).toEqual([10, 18]);
  });

  test("deleting an account writes through the local seam", async ({ page }) => {
    await page.goto("/accounts");
    const details = page.locator("details", { hasText: "e2e-added" }).first();
    await details.locator("summary").click();
    await details.getByRole("button", { name: "Delete account" }).click();

    await expect(page).toHaveURL(/\/accounts$/);
    await expect(page.getByText("e2e-added")).toHaveCount(0);

    const raw = await readFile(path.join(FIXTURES_ROOT, "data/accounts.json"), "utf-8");
    const accounts = JSON.parse(raw) as Array<{ id: string }>;
    expect(accounts.find((account) => account.id === "e2e-added")).toBeUndefined();
  });
});

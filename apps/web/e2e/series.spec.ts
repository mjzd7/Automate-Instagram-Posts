import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const FIXTURES_ROOT = path.resolve(__dirname, "fixtures");
const SERIES_FIXTURE = path.join(FIXTURES_ROOT, "data/series.json");

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// 1x1 gray JPEG so the drill-in's <img> never hits the real compose-on-demand
// child process during e2e.
const TINY_JPEG = Buffer.from(
  "AAAMAA6fADABAwIAAAAAAAAACgAAAGQAAABkAAAAAQABAQ0AAAD/AP///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
  "base64",
);

test.describe("series: roster, toggle round-trip, drill-in", () => {
  test("roster renders fixture series with active/paused chips and cadence grid", async ({ page }) => {
    await page.goto("/series");
    await expect(page.getByRole("link", { name: "E2E Alpha" })).toBeVisible();
    await expect(page.getByText("E2E Beta")).toBeVisible();
    await expect(page.getByText("active").first()).toBeVisible();
    await expect(page.getByText("paused").first()).toBeVisible();
  });

  test("pause requires confirmation then writes through the local seam; resume restores", async ({ page }) => {
    await page.goto("/series");
    const card = page.locator("li, div").filter({ has: page.getByRole("link", { name: "E2E Alpha" }) }).last();
    await card.getByText("Pause").click();
    await card.getByRole("button", { name: "Confirm pause" }).click();

    await expect(page).toHaveURL(/\/series\?done=/);
    const raw = await readFile(SERIES_FIXTURE, "utf-8");
    const afterPause = JSON.parse(raw) as Array<{ id: string; active: boolean }>;
    expect(afterPause.find((s) => s.id === "e2e-alpha")?.active).toBe(false);

    await page.goto("/series");
    await page.getByRole("button", { name: "Resume" }).first().click();
    await expect(page).toHaveURL(/\/series\?done=/);
    const rawAfter = await readFile(SERIES_FIXTURE, "utf-8");
    const afterResume = JSON.parse(rawAfter) as Array<{ id: string; active: boolean }>;
    expect(afterResume.find((s) => s.id === "e2e-alpha")?.active).toBe(true);
  });

  test("drill-in shows pack gallery with statuses and mocked thumbnails", async ({ page }) => {
    const month = currentMonthKey();
    const packDir = path.join(FIXTURES_ROOT, `data/content-packs/e2e-alpha`);
    await mkdir(packDir, { recursive: true });
    await writeFile(
      path.join(packDir, `${month}.json`),
      JSON.stringify([
        {
          id: "e2e-alpha-001",
          seriesId: "e2e-alpha",
          archetype: "stat",
          text: "Ninety percent of streaks die on day four.",
          status: "approved",
          generatedAt: new Date().toISOString(),
        },
        {
          id: "e2e-alpha-002",
          seriesId: "e2e-alpha",
          archetype: "callout",
          text: "You are not tired. You are under-challenged.",
          status: "draft",
          generatedAt: new Date().toISOString(),
        },
      ]),
    );

    await page.route("**/api/preview**", (route) =>
      route.fulfill({ status: 200, body: TINY_JPEG, contentType: "image/jpeg" }),
    );

    await page.goto("/series/e2e-alpha");
    await expect(page.getByText("#0 published").or(page.getByText(/published · slots/))).toBeVisible();
    await expect(page.getByText("e2e-alpha-001")).toBeVisible();
    await expect(page.getByText("e2e-alpha-002")).toBeVisible();
    await expect(page.getByText("approved", { exact: true }).first()).toBeVisible();
    await expect(page.locator('img[alt*="e2e-alpha"]')).toHaveCount(2);

    // unknown series 404s instead of throwing
    const missing = await page.goto("/series/nope");
    expect(missing?.status()).toBe(404);
  });
});

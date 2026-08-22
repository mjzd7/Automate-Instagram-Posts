import { expect, test } from "@playwright/test";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const FIXTURES_ROOT = path.resolve(__dirname, "fixtures");
const ACCOUNTS_FIXTURE = path.join(FIXTURES_ROOT, "data/accounts.json");
let accountsSnapshot: string | null = null;

test.beforeAll(async () => {
  accountsSnapshot = await readFile(ACCOUNTS_FIXTURE, "utf-8").catch(() => null);
});

test.afterAll(async () => {
  if (accountsSnapshot !== null) {
    await writeFile(ACCOUNTS_FIXTURE, accountsSnapshot, "utf-8");
  }
  const pipelineFile = path.join(FIXTURES_ROOT, "data/pipeline/2026-12.json");
  await rm(pipelineFile, { force: true });
});

test.describe("schedules editor", () => {
  test("renders per-account cards and saves tweaked schedule through the seam", async ({ page }) => {
    await page.goto("/schedules");
    await expect(page.getByText("e2e-main")).toBeVisible();

    const hours = page.getByTestId("e2e-main-hours");
    await expect(hours).toHaveValue(/10/);
    await hours.fill("7, 19");
    await page.getByTestId("e2e-main-cap").fill("1");
    await page.getByTestId("e2e-main-blackouts").fill("2026-12-25");
    await page.getByTestId("e2e-main-timezone").fill("Europe/Berlin");
    await page.getByTestId("e2e-main-save").click();

    await expect(page).toHaveURL(/\/schedules$/);
    const raw = await readFile(path.join(FIXTURES_ROOT, "data/accounts.json"), "utf-8");
    const accounts = JSON.parse(raw) as Array<{ id: string; postingHoursLocal: number[]; dailyCap?: number; blackoutDates?: string[]; timezone: string }>;
    const updated = accounts.find((a) => a.id === "e2e-main");
    expect(updated?.postingHoursLocal).toEqual([7, 19]);
    expect(updated?.dailyCap).toBe(1);
    expect(updated?.blackoutDates).toEqual(["2026-12-25"]);
    expect(updated?.timezone).toBe("Europe/Berlin");
    void 0;
  });

  test("rejects an invalid IANA timezone with a surfaced error", async ({ page }) => {
    await page.goto("/schedules");
    await page.getByTestId("e2e-stoic-timezone").fill("Mars/Olympus");
    await page.getByTestId("e2e-stoic-save").click();
    await expect(page).toHaveURL(/error=/);
    await expect(page.getByRole("alert").filter({ hasText: "invalid IANA timezone" })).toContainText('invalid IANA timezone');
  });
});

test.describe("pipeline builder + viewer", () => {
  test("generates a month and renders the calendar grid", async ({ page }) => {
    await page.goto("/pipeline?month=2026-12");
    await page.getByTestId("pipeline-month").fill("2026-12");
    await page.getByTestId("pipeline-generate").click();

    await expect(page).toHaveURL(/month=2026-12/);
    await expect(page.getByTestId("pipeline-meta")).toContainText("seed");
    const cells = page.locator("[data-testid='pipeline-calendar'] [data-date]");
    expect(await cells.count()).toBeGreaterThan(27);

    const raw = await readFile(path.join(FIXTURES_ROOT, "data/pipeline/2026-12.json"), "utf-8");
    const file = JSON.parse(raw) as { month: string; entries: Array<{ id: string; status: string }> };
    expect(file.month).toBe("2026-12");
    expect(file.entries.length).toBeGreaterThan(0);
    expect(file.entries.every((e) => e.status === "planned")).toBe(true);

    // regenerate: executed rows would be preserved; here ids stay stable
    await page.getByTestId("pipeline-generate").click();
    await expect(page).toHaveURL(/month=2026-12/);
    const raw2 = await readFile(path.join(FIXTURES_ROOT, "data/pipeline/2026-12.json"), "utf-8");
    const file2 = JSON.parse(raw2) as typeof file;
    expect(file2.entries.map((e) => e.id).sort()).toEqual(file.entries.map((e) => e.id).sort());
  });
});

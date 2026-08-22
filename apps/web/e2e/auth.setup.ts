import { expect, test } from "@playwright/test";
import path from "node:path";

const STATE_PATH = path.join(__dirname, ".auth", "state.json");

test.describe("auth setup", () => {
  test.use({ storageState: undefined });

  test("unauthenticated users are redirected to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("sign in persists a session storage state", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#password").fill("e2e-passwd");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/:\d+\/$/);
    await page.context().storageState({ path: STATE_PATH });
  });
});

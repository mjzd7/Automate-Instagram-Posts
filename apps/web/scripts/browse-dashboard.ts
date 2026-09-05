import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

async function main() {
  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(`${repoRoot}/.env.local`);
    } catch {
      try {
        process.loadEnvFile(`${repoRoot}/.env`);
      } catch {}
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("🌐 Navigating to http://localhost:3000/login...");
  await page.goto("http://localhost:3000/login");

  const passInput = page.locator("#password");
  if (await passInput.isVisible()) {
    console.log("🔑 Entering password and logging in...");
    const password = process.argv[2] || "InstaAuto_7d0602100fd3";
    await passInput.fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.includes("login") && !url.pathname.includes("callback"), { timeout: 10000 });
    console.log("✅ Logged in! Current URL:", page.url());
  }

  // 1. Visit Series Roster
  console.log("\n📂 Opening Series Roster: http://localhost:3000/series");
  await page.goto("http://localhost:3000/series");
  await page.waitForSelector("a[href^='/series/']", { timeout: 5000 });

  const seriesLinks = await page.locator("a[href^='/series/']").all();
  console.log(`Found ${seriesLinks.length} series on the roster:`);
  for (const link of seriesLinks) {
    const text = await link.innerText();
    const href = await link.getAttribute("href");
    console.log(`  - ${text} (${href})`);
  }

  const artifactDir = "/Users/mm/.gemini/antigravity-cli/brain/0704bd6a-9dda-48fd-885f-c249ec8e70c6";
  await page.screenshot({ path: `${repoRoot}/scratch/dashboard-series-overview.png`, fullPage: true });
  await page.screenshot({ path: `${artifactDir}/dashboard_series_overview.png`, fullPage: true });

  // 2. Visit Hook Lab
  console.log("\n⚡ Opening Hook Lab: http://localhost:3000/series/hook-lab");
  await page.goto("http://localhost:3000/series/hook-lab");
  await page.waitForSelector("blockquote", { timeout: 5000 });

  const hookQuotes = await page.locator("blockquote").allInnerTexts();
  const packCaptions = await page.locator("figcaption").allInnerTexts();

  console.log("\n=======================================================");
  console.log("🔥 VIRAL HOOKS CURRENTLY ACTIVE IN HOOK LAB DASHBOARD 🔥");
  console.log("=======================================================");
  hookQuotes.forEach((quote, i) => {
    console.log(`\n[Hook #${i + 1}] "${quote}"`);
    if (packCaptions[i]) {
      console.log(`  Details: ${packCaptions[i]}`);
    }
  });

  await page.screenshot({ path: `${repoRoot}/scratch/dashboard-hook-lab.png`, fullPage: true });
  await page.screenshot({ path: `${artifactDir}/dashboard_hook_lab.png`, fullPage: true });
  console.log("\n📸 Saved screenshot to scratch/dashboard-hook-lab.png & artifacts");

  // 3. Visit Mindset Manual
  console.log("\n📘 Opening Mindset Manual: http://localhost:3000/series/mindset-manual");
  await page.goto("http://localhost:3000/series/mindset-manual");
  await page.waitForSelector("blockquote", { timeout: 5000 });

  const manualQuotes = await page.locator("blockquote").allInnerTexts();
  console.log("\n=======================================================");
  console.log("📘 MINDSET MANUAL FRAMEWORKS ON DASHBOARD");
  console.log("=======================================================");
  manualQuotes.forEach((m, i) => {
    console.log(`\n[Framework #${i + 1}] "${m}"`);
  });
  await page.screenshot({ path: `${repoRoot}/scratch/dashboard-mindset-manual.png`, fullPage: true });
  await page.screenshot({ path: `${artifactDir}/dashboard_mindset_manual.png`, fullPage: true });

  // 4. Visit Villain Roasts
  console.log("\n🔥 Opening Villain Roasts: http://localhost:3000/series/villain-roasts");
  await page.goto("http://localhost:3000/series/villain-roasts");
  await page.waitForSelector("blockquote", { timeout: 5000 });

  const roastQuotes = await page.locator("blockquote").allInnerTexts();
  console.log("\n=======================================================");
  console.log("🎯 VILLAIN ROASTS (VIRAL DM SHARE TRIGGERS) ON DASHBOARD");
  console.log("=======================================================");
  roastQuotes.forEach((r, i) => {
    console.log(`\n[Roast #${i + 1}] "${r}"`);
  });
  await page.screenshot({ path: `${repoRoot}/scratch/dashboard-villain-roasts.png`, fullPage: true });
  await page.screenshot({ path: `${artifactDir}/dashboard_villain_roasts.png`, fullPage: true });

  // 5. Visit Formats & Studio
  console.log("\n🎨 Opening Formats & Studio: http://localhost:3000/formats");
  await page.goto("http://localhost:3000/formats");
  await page.waitForSelector("table", { timeout: 5000 });
  await page.screenshot({ path: `${repoRoot}/scratch/dashboard-formats-studio.png`, fullPage: true });
  await page.screenshot({ path: `${artifactDir}/dashboard_formats_studio.png`, fullPage: true });
  console.log("📸 Saved screenshot of Studio & Formats page!");

  // 6. Visit Template Design Studio
  console.log("\n📐 Opening Template Design Studio: http://localhost:3000/templates");
  await page.goto("http://localhost:3000/templates");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${repoRoot}/scratch/dashboard-template-studio.png`, fullPage: true });
  await page.screenshot({ path: `${artifactDir}/dashboard_template_studio.png`, fullPage: true });
  console.log("📸 Saved screenshot of Template Studio page!");

  // 7. Visit Checkerboard Feed / Account View if available
  console.log("\n🎨 Opening Home / Feed View: http://localhost:3000");
  await page.goto("http://localhost:3000");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${repoRoot}/scratch/dashboard-home.png`, fullPage: true });
  await page.screenshot({ path: `${artifactDir}/dashboard_home.png`, fullPage: true });

  await browser.close();
  console.log("\n✅ Browser inspection complete!");
}

main().catch(console.error);

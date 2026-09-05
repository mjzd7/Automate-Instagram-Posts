import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadSeries } from "../../src/config/series.js";
import { findSeriesTemplate } from "../../src/multi-series/images/registry.js";
import { lintPackItem } from "../../src/multi-series/moderation/text-lint.js";
import {
  parsePackItems,
  type PackItem,
} from "../../src/multi-series/quotes/content-pack.js";

// End-to-end verification of the built chain against the REAL repo files:
// series config → template registry → persisted packs → moderation lint.
// No mocks — if any layer drifts from the data on disk, this fails.

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));

async function listPackFiles(): Promise<Map<string, string[]>> {
  const packsRoot = `${repoRoot}data/content-packs`;
  const bySeries = new Map<string, string[]>();
  const seriesDirs = await readdir(packsRoot, { withFileTypes: true });
  for (const dir of seriesDirs.filter((d) => d.isDirectory())) {
    const files = await readdir(`${packsRoot}/${dir.name}`);
    bySeries.set(
      dir.name,
      files.filter((f) => f.endsWith(".json")).map((f) => `${packsRoot}/${dir.name}/${f}`),
    );
  }
  return bySeries;
}

describe("multi-series supply chain (real files, no mocks)", () => {
  it("loads the real series config and resolves every referenced template", async () => {
    const series = await loadSeries(`${repoRoot}data/series.json`);
    expect(series.length).toBeGreaterThanOrEqual(6);
    for (const s of series) {
      for (const templateId of s.templateIds) {
        const template = findSeriesTemplate(templateId);
        expect(template.id).toBe(templateId);
      }
    }
  });

  it("parses every persisted content pack and keeps items lint-clean", async () => {
    const bySeries = await listPackFiles();
    const totalFiles = [...bySeries.values()].flat().length;
    expect(totalFiles).toBeGreaterThan(0);

    let checked = 0;
    for (const [seriesId, files] of bySeries) {
      for (const path of files) {
        const raw = JSON.parse(await readFile(path, "utf-8")) as unknown;
        const items = parsePackItems(raw);
        for (const item of items) {
          checked++;
          expect(item.seriesId).toBe(seriesId);
          expect(lintPackItem(item)).toEqual([]);
          expect(["draft", "approved", "rejected"]).toContain(item.status);
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(6); // one live-generated draft per series
  });

  it("keeps pack item ids consistent with their series and month folder", async () => {
    const bySeries = await listPackFiles();
    for (const files of bySeries.values()) {
      for (const path of files) {
        const month = path.split("/").pop()!.replace(".json", "");
        expect(month).toMatch(/^\d{4}-\d{2}$/);
        const items = parsePackItems(JSON.parse(await readFile(path, "utf-8"))) as PackItem[];
        for (const item of items) {
          expect(item.id.startsWith(`${item.seriesId}-`)).toBe(true);
          expect(item.generatedAt.slice(0, 7)).toBe(month);
        }
      }
    }
  });
});

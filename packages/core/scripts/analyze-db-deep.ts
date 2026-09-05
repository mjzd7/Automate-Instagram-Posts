import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { openDb } from "../src/db/client.js";
import { posts, quotes, backgrounds } from "../src/db/schema.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function main() {
  const dbHandle = await openDb(`file:${repoRoot}/data/app.db`);

  try {
    const allDbPosts = await dbHandle.db.select().from(posts);
    console.log(`\n=== DATABASE POSTS ANALYSIS (Total: ${allDbPosts.length}) ===`);

    const published = allDbPosts.filter(p => p.status === "published");
    const pending = allDbPosts.filter(p => p.status === "pending");
    const failed = allDbPosts.filter(p => p.status === "failed");

    console.log(`Published: ${published.length}, Pending: ${pending.length}, Failed: ${failed.length}`);

    // Break down by archetype, templateId, seriesId, mode
    const byArchetype: Record<string, { count: number; views: number }> = {};
    const byTemplate: Record<string, { count: number; views: number }> = {};
    const bySeries: Record<string, { count: number; views: number }> = {};
    const byMode: Record<string, { count: number; views: number }> = {};

    published.forEach(p => {
      const arch = p.archetype || "none";
      byArchetype[arch] = byArchetype[arch] || { count: 0, views: 0 };
      byArchetype[arch].count++;
      byArchetype[arch].views += (p.views || 0);

      const tpl = p.templateId || "none";
      byTemplate[tpl] = byTemplate[tpl] || { count: 0, views: 0 };
      byTemplate[tpl].count++;
      byTemplate[tpl].views += (p.views || 0);

      const ser = p.seriesId || "none";
      bySeries[ser] = bySeries[ser] || { count: 0, views: 0 };
      bySeries[ser].count++;
      bySeries[ser].views += (p.views || 0);

      const m = p.mode || "none";
      byMode[m] = byMode[m] || { count: 0, views: 0 };
      byMode[m].count++;
      byMode[m].views += (p.views || 0);
    });

    console.log("\n--- BY ARCHETYPE ---");
    console.table(Object.entries(byArchetype).map(([k, v]) => ({ archetype: k, count: v.count, totalViews: v.views, avgViews: (v.views / (v.count || 1)).toFixed(1) })));

    console.log("\n--- BY TEMPLATE ---");
    console.table(Object.entries(byTemplate).map(([k, v]) => ({ template: k, count: v.count, totalViews: v.views, avgViews: (v.views / (v.count || 1)).toFixed(1) })));

    console.log("\n--- BY SERIES ---");
    console.table(Object.entries(bySeries).map(([k, v]) => ({ series: k, count: v.count, totalViews: v.views, avgViews: (v.views / (v.count || 1)).toFixed(1) })));

    console.log("\n--- BY MODE ---");
    console.table(Object.entries(byMode).map(([k, v]) => ({ mode: k, count: v.count, totalViews: v.views, avgViews: (v.views / (v.count || 1)).toFixed(1) })));

    // Top 10 by Views in DB
    const topViewsDb = [...published].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
    console.log("\n--- TOP 10 POSTS BY VIEWS IN DB ---");
    for (const p of topViewsDb) {
      console.log(`[Views: ${p.views}] Post ${p.id} | Template: ${p.templateId} | Archetype: ${p.archetype} | Series: ${p.seriesId} | Published: ${p.publishedAt}`);
    }

  } finally {
    dbHandle.close();
  }
}

main().catch(console.error);

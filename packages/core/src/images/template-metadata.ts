/**
 * apps/web-safe subset of TEMPLATES (id/name/categories only) -- a standalone
 * hand-maintained array, NOT re-exported from templates.ts. templates.ts
 * computes `fontsDir` via `fileURLToPath(new URL("./fonts", import.meta.url))`
 * at module scope; Turbopack statically scans a file's whole source for that
 * pattern (verified: wrapping it in a function, not just top-level, doesn't
 * avoid the scan), so even importing *only* the metadata through templates.ts
 * still drags the unresolvable asset reference into apps/web's bundle. Same
 * failure family as db/client.ts's migrations folder (docs/LEARNINGS.md
 * FR-006) but this time the module-splitting fix used for
 * dashboard-queries.ts/read-only-client.ts doesn't work either, because the
 * data and the asset reference live in the same file, not different
 * functions -- hence a genuinely standalone duplicate here instead of an
 * import-based boundary file.
 *
 * Keep in sync with images/templates.ts's TEMPLATES ids/names/categories.
 */
export const TEMPLATE_METADATA: { id: string; name: string; categories: string[] }[] = [
  { id: "bold-modern", name: "Bold / Modern", categories: ["motivational"] },
  { id: "editorial-elegant", name: "Editorial / Elegant", categories: ["stoic"] },
  { id: "soft-curvy", name: "Soft / Curvy", categories: ["humor"] },
  { id: "authentic-personal", name: "Authentic / Personal", categories: ["love"] },
  { id: "corporate-clean", name: "Corporate / Clean", categories: ["business"] },
  { id: "classic-wisdom", name: "Classic / Wisdom", categories: ["wisdom"] },
  { id: "calm-mindful", name: "Calm / Mindful", categories: ["mindfulness"] },
  { id: "bold-resilience", name: "Bold / Resilience", categories: ["resilience"] },
  { id: "general-poppins", name: "General / Poppins", categories: [] },
  { id: "general-cormorant", name: "General / Cormorant", categories: [] },
];

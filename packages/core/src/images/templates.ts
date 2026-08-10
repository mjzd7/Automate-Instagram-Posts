import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fontsDir = fileURLToPath(new URL("./fonts", import.meta.url));

export interface FontFace {
  /** Clean, unique Pango family name baked into the font file's name table (see docs/LEARNINGS.md FR-003 -- these are NOT the original Google Fonts family names). */
  family: string;
  /** Absolute path to the TTF file. */
  file: string;
}

export interface Template {
  id: string;
  name: string;
  quoteFont: FontFace;
  authorFont: FontFace;
  /** Category ids this template is a primary fit for (drives category-aware cycling in selectTemplate). Empty array = general-purpose only. */
  categories: string[];
}

// 10 templates: one signature look per established category (see
// data/hashtags.json / research/fonts.md's psychology-based mapping), plus
// 2 general-purpose templates used for cross-category variety. Font
// pairings extend research/fonts.md's "bold display + calm companion,
// max 2 fonts" rule; every quote font is a distinct family for genuine
// visual variety across a day's ~20 posts.
export const TEMPLATES: readonly Template[] = [
  {
    id: "bold-modern",
    name: "Bold / Modern",
    quoteFont: { family: "MontserratBold", file: `${fontsDir}/Montserrat-Bold.ttf` },
    authorFont: { family: "MerriweatherRegular", file: `${fontsDir}/Merriweather-Regular.ttf` },
    categories: ["motivational", "inspiration", "productivity"],
  },
  {
    id: "editorial-elegant",
    name: "Editorial / Elegant",
    quoteFont: { family: "BodoniModaBold", file: `${fontsDir}/BodoniModa-Bold.ttf` },
    authorFont: { family: "RalewayRegular", file: `${fontsDir}/Raleway-Regular.ttf` },
    categories: ["stoic", "creativity"],
  },
  {
    id: "soft-curvy",
    name: "Soft / Curvy",
    quoteFont: { family: "AbrilFatfaceRegular", file: `${fontsDir}/AbrilFatface-Regular.ttf` },
    authorFont: { family: "WorkSansRegular", file: `${fontsDir}/WorkSans-Regular.ttf` },
    categories: ["humor"],
  },
  {
    id: "authentic-personal",
    name: "Authentic / Personal",
    quoteFont: { family: "CaveatBold", file: `${fontsDir}/Caveat-Bold.ttf` },
    authorFont: { family: "LatoRegular", file: `${fontsDir}/Lato-Regular.ttf` },
    categories: ["love", "self-improvement"],
  },
  {
    id: "corporate-clean",
    name: "Corporate / Clean",
    quoteFont: { family: "OswaldBold", file: `${fontsDir}/Oswald-Bold.ttf` },
    authorFont: { family: "OpenSansRegular", file: `${fontsDir}/OpenSans-Regular.ttf` },
    categories: ["business", "entrepreneurship"],
  },
  {
    id: "classic-wisdom",
    name: "Classic / Wisdom",
    quoteFont: { family: "PlayfairDisplayBold", file: `${fontsDir}/PlayfairDisplay-Bold.ttf` },
    authorFont: { family: "LoraRegular", file: `${fontsDir}/Lora-Regular.ttf` },
    categories: ["wisdom", "mindset"],
  },
  {
    id: "calm-mindful",
    name: "Calm / Mindful",
    quoteFont: { family: "QuicksandBold", file: `${fontsDir}/Quicksand-Bold.ttf` },
    authorFont: { family: "KarlaRegular", file: `${fontsDir}/Karla-Regular.ttf` },
    categories: ["mindfulness", "positive-thinking"],
  },
  {
    id: "bold-resilience",
    name: "Bold / Resilience",
    quoteFont: { family: "AntonRegular", file: `${fontsDir}/Anton-Regular.ttf` },
    authorFont: { family: "RobotoRegular", file: `${fontsDir}/Roboto-Regular.ttf` },
    categories: ["resilience", "discipline"],
  },
  {
    id: "general-poppins",
    name: "General / Poppins",
    quoteFont: { family: "PoppinsBold", file: `${fontsDir}/Poppins-Bold.ttf` },
    authorFont: { family: "PTSerifRegular", file: `${fontsDir}/PTSerif-Regular.ttf` },
    categories: [],
  },
  {
    id: "general-cormorant",
    name: "General / Cormorant",
    quoteFont: { family: "CormorantGaramondBold", file: `${fontsDir}/CormorantGaramond-Bold.ttf` },
    authorFont: { family: "NunitoRegular", file: `${fontsDir}/Nunito-Regular.ttf` },
    categories: [],
  },
] as const;

const GENERAL_TEMPLATE_IDS = TEMPLATES.filter((t) => t.categories.length === 0).map((t) => t.id);

export function findTemplate(id: string): Template {
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template) {
    throw new Error(`Unknown template id "${id}". Known ids: ${TEMPLATES.map((t) => t.id).join(", ")}`);
  }
  return template;
}

/**
 * Category-aware template cycling: picks a template that fits the quote's
 * category most of the time, but rotates in a general-purpose template
 * some of the time and never repeats the immediately-previous template for
 * this account back-to-back -- matches research/layout-and-engagement.md's
 * "clearly belongs to the same set, but not identical" finding (variety
 * without losing per-category identity).
 *
 * generalRatio: probability of picking a general template instead of the
 * category's primary match on any given call (default 0.25 -- roughly 1 in
 * 4 posts uses a general template for cross-category visual variety).
 */
export function selectTemplate(
  category: string,
  previousTemplateId: string | undefined,
  generalRatio = 0.25,
  random: () => number = Math.random,
): Template {
  const categoryMatches = TEMPLATES.filter((t) => t.categories.includes(category));
  const primaryPool = categoryMatches.length > 0 ? categoryMatches : TEMPLATES.filter((t) => GENERAL_TEMPLATE_IDS.includes(t.id));

  const useGeneral = categoryMatches.length > 0 && random() < generalRatio;
  const pool = useGeneral
    ? TEMPLATES.filter((t) => GENERAL_TEMPLATE_IDS.includes(t.id))
    : primaryPool;

  const candidates = pool.length > 1 ? pool.filter((t) => t.id !== previousTemplateId) : pool;
  const chosen = candidates[Math.floor(random() * candidates.length)];
  if (!chosen) {
    throw new Error(`selectTemplate: no candidate templates available for category "${category}"`);
  }
  return chosen;
}

/**
 * sharp/Pango silently falls back to a default font rather than erroring on
 * a missing/wrong fontfile path (confirmed empirically, docs/LEARNINGS.md
 * FR-003) -- this check makes a bad path a loud failure instead of a
 * silent wrong-looking image.
 */
export function assertFontFilesExist(): void {
  for (const template of TEMPLATES) {
    for (const face of [template.quoteFont, template.authorFont]) {
      if (!existsSync(face.file)) {
        throw new Error(
          `Font file missing for template "${template.id}": ${face.file} (family ${face.family})`,
        );
      }
    }
  }
}

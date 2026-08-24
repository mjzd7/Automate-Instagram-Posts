// Multi-series template registry (docs/PLAN-multi-series.md §4.6). Layout
// descriptors and font pairings only — actual sharp composition lives in
// compose-series-card.ts. Fonts are reused read-only from the shared
// pipeline registry per the §4.0 isolation rule.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FontFace } from "../../images/templates.js";
import { IMAGE_WIDTH } from "../../images/constants.js";

export type SeriesLayoutId =
  | "hook-cover"
  | "confession-card"
  | "identity-badge"
  | "roast-footer"
  | "gap-line"
  | "framework-carousel"
  | "framework-mini";

export interface SeriesTemplate {
  id: string;
  layout: SeriesLayoutId;
  quoteFont: FontFace;
  authorFont: FontFace;
  /** Content stays inside the Story-crop safe area (Result 5.2 badge variant). */
  storySafe?: boolean;
}

const fontsDir = new URL("../../images/fonts/", import.meta.url);
const font = (file: string): string => fileURLToPath(new URL(file, fontsDir));

const FAMILY_TO_FILE: Record<string, string> = {
  MontserratBold: "Montserrat-Bold",
  MerriweatherRegular: "Merriweather-Regular",
  CaveatBold: "Caveat-Bold",
  LatoRegular: "Lato-Regular",
  AntonRegular: "Anton-Regular",
  RobotoRegular: "Roboto-Regular",
  PoppinsBold: "Poppins-Bold",
  PTSerifRegular: "PTSerif-Regular",
  PlayfairDisplayBold: "PlayfairDisplay-Bold",
  LoraRegular: "Lora-Regular",
};

// Family names (Pango name tables) differ from the hyphenated font filenames
// in the shared fonts dir — same convention as images/templates.ts.
function face(family: string): FontFace {
  return { family, file: font(`${FAMILY_TO_FILE[family] ?? family}.ttf`) };
}

export const SERIES_TEMPLATES: readonly SeriesTemplate[] = [
  {
    id: "hook-cover",
    layout: "hook-cover",
    quoteFont: face("MontserratBold"),
    authorFont: face("MerriweatherRegular"),
  },
  {
    id: "confession-card",
    layout: "confession-card",
    quoteFont: face("CaveatBold"),
    authorFont: face("LatoRegular"),
  },
  {
    id: "identity-badge",
    layout: "identity-badge",
    quoteFont: face("CaveatBold"),
    authorFont: face("LatoRegular"),
    storySafe: true,
  },
  {
    id: "roast-footer",
    layout: "roast-footer",
    quoteFont: face("AntonRegular"),
    authorFont: face("RobotoRegular"),
  },
  {
    id: "gap-line",
    layout: "gap-line",
    quoteFont: face("PoppinsBold"),
    authorFont: face("PTSerifRegular"),
  },
  {
    id: "framework-carousel",
    layout: "framework-carousel",
    quoteFont: face("PlayfairDisplayBold"),
    authorFont: face("LoraRegular"),
  },
  {
    id: "framework-mini",
    layout: "framework-mini",
    quoteFont: face("PlayfairDisplayBold"),
    authorFont: face("LoraRegular"),
  },
] as const;

const KNOWN_IDS = SERIES_TEMPLATES.map((t) => t.id).join(", ");

export function findSeriesTemplate(id: string): SeriesTemplate {
  const template = SERIES_TEMPLATES.find((t) => t.id === id);
  if (!template) {
    throw new Error(`Unknown series template id "${id}". Known ids: ${KNOWN_IDS}`);
  }
  return template;
}

/** Reuses the shared pipeline's font-existence guard over our registry. */
export function assertSeriesFontsExist(): void {
  for (const template of SERIES_TEMPLATES) {
    for (const face of [template.quoteFont, template.authorFont]) {
      if (!existsSync(face.file)) {
        throw new Error(
          `Font file missing for series template "${template.id}": ${face.file} (family ${face.family})`,
        );
      }
    }
  }
}

export interface Zone {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LayoutZones {
  primary: Zone;
  footer?: Zone;
}

/**
 * Logical-pixel (1080x1350) content bands per layout. hook-cover keeps the
 * hook in the top band per the Result-2 usage tip ("the hook IS the cover
 * text"); roast-footer reserves a bottom CTA strip; framework layouts get a
 * centered content region since their structure is step-list driven.
 */
export function layoutZones(layout: SeriesLayoutId): LayoutZones {
  const sideMargin = 80;
  switch (layout) {
    case "hook-cover":
      return {
        primary: { left: sideMargin, top: 160, width: IMAGE_WIDTH - 2 * sideMargin, height: 480 },
      };
    case "confession-card":
      return {
        primary: { left: sideMargin, top: 340, width: IMAGE_WIDTH - 2 * sideMargin, height: 560 },
      };
    case "identity-badge":
      // Story crop trims ~250px total vertically; keep text well inside.
      return {
        primary: { left: 140, top: 420, width: IMAGE_WIDTH - 280, height: 460 },
      };
    case "roast-footer":
      return {
        primary: { left: sideMargin, top: 320, width: IMAGE_WIDTH - 2 * sideMargin, height: 520 },
        footer: { left: sideMargin, top: 1130, width: IMAGE_WIDTH - 2 * sideMargin, height: 140 },
      };
    case "gap-line":
      return {
        primary: { left: sideMargin, top: 380, width: IMAGE_WIDTH - 2 * sideMargin, height: 520 },
      };
    case "framework-carousel":
      return {
        primary: { left: sideMargin, top: 240, width: IMAGE_WIDTH - 2 * sideMargin, height: 800 },
      };
    case "framework-mini":
      return {
        primary: { left: sideMargin, top: 300, width: IMAGE_WIDTH - 2 * sideMargin, height: 700 },
      };
  }
}

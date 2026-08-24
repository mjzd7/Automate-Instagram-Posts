// {{BLANK}} is the generation-side marker for fill-the-blank cards
// (docs/PLAN-multi-series.md §4.3). It must never reach a rendered card.

export const GAP_TOKEN = "{{BLANK}}";

const GAP_RENDER = "______";

export function hasGapToken(text: string): boolean {
  return text.includes(GAP_TOKEN);
}

export function replaceGapToken(text: string): string {
  if (!hasGapToken(text)) {
    return text;
  }
  return text.replaceAll(GAP_TOKEN, GAP_RENDER);
}

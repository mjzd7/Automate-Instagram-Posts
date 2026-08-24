import type { PackItem } from "../quotes/content-pack.js";

// Deterministic moderation tier for generated series content
// (docs/PLAN-multi-series.md §4.4). Runs before the dashboard approval
// queue; the queue itself is the semantic-safety tier (§4.4 rule 5's
// non-lexical half — real person/group targeting — is a human-review call).

export interface TextLintViolation {
  rule:
    | "banned-claim"
    | "despair"
    | "length-cap"
    | "length-band"
    | "all-caps"
    | "emoji-cap"
    | "target-safety";
  message: string;
}

interface LengthRule {
  maxWords?: number;
  minChars?: number;
  maxChars?: number;
}

const LENGTH_RULES: Record<string, LengthRule> = {
  "hook-lab": { maxWords: 12 },
  "confession-cards": { minChars: 90, maxChars: 160 },
  "season-reset": { minChars: 90, maxChars: 160 },
  "villain-roasts": { maxChars: 100 },
  "fill-the-blank": { maxChars: 120 },
};

const BANNED_CLAIM_PATTERNS: RegExp[] = [
  /\bguaranteed?\b/i,
  /\bcure\b/i,
  /\bget rich\b/i,
  /\bpassive income\b/i,
  /\brisk[- ]free\b/i,
];

const DESPAIR_PATTERNS: RegExp[] = [
  /\bkill (?:myself|yourself)\b/i,
  /\bend it all\b/i,
  /\bnot worth living\b/i,
  /\bsuicid\w*/i,
];

const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;

const ALL_CAPS_MIN_LETTERS = 8;
const ALL_CAPS_MAX_RATIO = 0.3;
const EMOJI_MAX = 2;

export function lintSeriesText(
  seriesId: string,
  text: string,
  opts: { archetype?: string | null } = {},
): TextLintViolation[] {
  const violations: TextLintViolation[] = [];

  for (const pattern of BANNED_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push({ rule: "banned-claim", message: `banned claim "${match[0]}"` });
    }
  }

  for (const pattern of DESPAIR_PATTERNS) {
    if (pattern.test(text)) {
      violations.push({ rule: "despair", message: `despair lexicon matched ${pattern}` });
    }
  }

  const lengthRule = LENGTH_RULES[seriesId];
  if (lengthRule) {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    if (lengthRule.maxWords !== undefined && wordCount > lengthRule.maxWords) {
      violations.push({
        rule: "length-cap",
        message: `${wordCount} words exceeds hook cap of ${lengthRule.maxWords}`,
      });
    }
    if (
      lengthRule.maxWords === undefined &&
      ((lengthRule.minChars !== undefined && text.length < lengthRule.minChars) ||
        (lengthRule.maxChars !== undefined && text.length > lengthRule.maxChars))
    ) {
      violations.push({
        rule: "length-band",
        message: `${text.length} chars outside band [${lengthRule.minChars ?? 0}, ${lengthRule.maxChars ?? "∞"}]`,
      });
    }
  }

  if (opts.archetype !== "stat") {
    const letters = text.replace(/[^a-zA-Z]/g, "");
    if (letters.length >= ALL_CAPS_MIN_LETTERS) {
      const upperRatio =
        letters.replace(/[^A-Z]/g, "").length / letters.length;
      if (upperRatio > ALL_CAPS_MAX_RATIO) {
        violations.push({
          rule: "all-caps",
          message: `${Math.round(upperRatio * 100)}% caps ratio over threshold`,
        });
      }
    }
  }

  const emojiCount = text.match(EMOJI_PATTERN)?.length ?? 0;
  if (emojiCount > EMOJI_MAX) {
    violations.push({ rule: "emoji-cap", message: `${emojiCount} emojis over cap of ${EMOJI_MAX}` });
  }

  if (/@\w+/.test(text)) {
    violations.push({ rule: "target-safety", message: "@mention in card text" });
  }

  return violations;
}

export function lintPackItem(item: PackItem): TextLintViolation[] {
  return lintSeriesText(item.seriesId, item.text, { archetype: item.archetype });
}

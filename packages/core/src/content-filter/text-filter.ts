import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const wordlistPath = fileURLToPath(new URL("./wordlist.json", import.meta.url));
const defaultWordlist: string[] = JSON.parse(readFileSync(wordlistPath, "utf-8"));

function buildPattern(words: string[]): RegExp | undefined {
  if (words.length === 0) return undefined;
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "i");
}

const defaultPattern = buildPattern(defaultWordlist);

const RELIGIOUS_HONORIFIC_PATTERN = /\((?:r\.?a\.?|pbuh|s\.?a\.?w\.?|a\.?s\.?|r\.?h\.?)\)/i;

/**
 * Per plan.md §2.7 (TEXT_WORDLIST_ACTION): word-boundary, case-insensitive
 * match against the flagged-term list (sexually explicit, political, religious, or profane terms).
 * Returns true if the text passes (i.e. contains no flagged terms), false if rejected.
 */
export function textPassesFilter(text: string, wordlist: string[] = defaultWordlist): boolean {
  if (wordlist === defaultWordlist && RELIGIOUS_HONORIFIC_PATTERN.test(text)) {
    return false;
  }
  const pattern = wordlist === defaultWordlist ? defaultPattern : buildPattern(wordlist);
  if (!pattern) return true;
  return !pattern.test(text);
}

/**
 * Optional Stage 2 LLM Safety Moderator:
 * Uses Gemini API to evaluate whether quote text has any religious, political,
 * sexually explicit, or inappropriate themes that bypass keyword blocklists.
 */
export async function evaluateTextSafetyWithLLM(
  text: string,
  geminiApiKey?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ safe: boolean; reason?: string }> {
  // First check fast local blocklist
  if (!textPassesFilter(text)) {
    return { safe: false, reason: "Contains term in religious/political/explicit blocklist" };
  }

  if (!geminiApiKey) {
    return { safe: true };
  }

  const prompt = `Evaluate if this quote contains ANY religious, political, sexually explicit, or controversial/inappropriate themes.
Return ONLY valid JSON: { "safe": boolean, "reason": "clean" | string }

Quote: "${text}"`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.0 },
      }),
    });

    if (!res.ok) return { safe: true };

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText) {
      const parsed = JSON.parse(rawText) as { safe?: boolean; reason?: string };
      if (typeof parsed.safe === "boolean") {
        return { safe: parsed.safe, reason: parsed.reason };
      }
    }
  } catch {
    // Fail safe to blocklist verdict
  }

  return { safe: true };
}

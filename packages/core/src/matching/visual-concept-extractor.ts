/**
 * Uses Gemini LLM to extract 3 vivid visual scene search queries from a quote.
 * This bridges abstract quotes ("We suffer in imagination...") to concrete
 * photo queries ("foggy solitary mountain trail", "minimalist empty sunlit room").
 */
export async function extractVisualConcepts(
  quoteText: string,
  category: string,
  geminiApiKey?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  if (!geminiApiKey) {
    return [category, `${category} aesthetic`, `${category} portrait`].map(s => s.trim());
  }

  const prompt = `Analyze this quote and generate 3 specific, vivid photographic scene search queries (2-4 words each) for stock photos that capture its core metaphor, subject, or emotional tone. Prioritize concrete physical environments and atmospheric imagery (e.g. dramatic nature, modern architecture, roads, technology, night sky, ocean) that work well as clean backgrounds. Output ONLY a valid JSON array of 3 strings, e.g. ["foggy mountain trail", "deep starry night sky", "solitary ocean horizon"].

Quote: "${quoteText}"
Category: "${category}"`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
      }),
    });

    if (!res.ok) {
      return [category, `${category} aesthetic`].map(s => s.trim());
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText) {
      const parsed = JSON.parse(rawText) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 3).map((s) => s.trim());
      }
    }
  } catch {
    // Fallback gracefully to category keywords
  }

  return [category, `${category} aesthetic`, `${category} minimalist`].map(s => s.trim());
}

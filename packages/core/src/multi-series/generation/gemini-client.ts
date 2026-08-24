import type { TextGenerator } from "./generate-pack.js";

// Thin adapter over the same Gemini REST pattern the repo already uses for
// background-query generation (see matching/visual-concept-extractor.ts) —
// copied per the §4.0 isolation rule rather than imported from pipeline code.
// Unlike query generation, a failed call throws: pack supply must fail loudly.

export interface GeminiGeneratorOptions {
  fetchImpl?: typeof fetch;
  model?: string;
  temperature?: number;
}

export function makeGeminiGenerator(
  apiKey: string,
  options: GeminiGeneratorOptions = {},
): TextGenerator {
  const {
    fetchImpl = fetch,
    // gemini-flash-latest alias was 503-throttled in the Aug 2026 dry run; pinned 3.6-flash went 4/4 and is Google's advertised GA model.
    model = "gemini-3.6-flash",
    temperature = 0.9,
  } = options;

  return async (prompt: string) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini returned no candidate text");
    }
    return text;
  };
}

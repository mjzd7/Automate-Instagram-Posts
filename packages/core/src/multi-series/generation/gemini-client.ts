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
    model = "gemini-2.5-flash",
    temperature = 0.9,
  } = options;

  const candidateModels = [
    model,
    "gemini-3.5-flash-lite",
  ];

  return async (prompt: string) => {
    let lastError: Error | null = null;

    for (const m of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
          const res = await fetchImpl(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json", temperature },
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            lastError = new Error(`Gemini API (${m}) ${res.status}: ${errText}`);
            if (res.status === 503 || res.status === 429) {
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            }
            if (res.status === 404) {
              break;
            }
            throw lastError;
          }

          const data = (await res.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            throw new Error(`Gemini (${m}) returned no candidate text`);
          }
          return text;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }
    }

    // Fallback to Groq if GROQ_API_KEY is available
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const gRes = await fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature,
          }),
        });
        if (gRes.ok) {
          const gData = (await gRes.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const gText = gData.choices?.[0]?.message?.content;
          if (gText) return gText;
        }
      } catch {
        // Continue to throw lastError
      }
    }

    throw lastError ?? new Error("All LLM candidate models failed");
  };
}

export interface CaptionTemplate {
  id: string;
  build: (quoteText: string, author: string | null, hashtags: string[]) => string;
}

// Minimal caption formatting variants for aesthetics/mode-weighting.ts's
// selectCaptionTemplate to choose between -- the actual quote/author text
// goes in the composited image itself (compositor.ts), so these govern
// only the separate IG caption text (kept short; hashtags go in the first
// comment, not here, per plan.md §7.19 step 4g/9).
export const CAPTION_TEMPLATES: readonly CaptionTemplate[] = [
  {
    id: "quote-only",
    build: (quoteText, author) => (author ? `"${quoteText}" — ${author}` : `"${quoteText}"`),
  },
  {
    id: "quote-with-emoji",
    build: (quoteText, author) => (author ? `✨ "${quoteText}" — ${author}` : `✨ "${quoteText}"`),
  },
  {
    id: "quote-with-cta",
    build: (quoteText, author) => {
      const attribution = author ? ` — ${author}` : "";
      return `"${quoteText}"${attribution}\n\nSave this post for when you need it 🔖`;
    },
  },
  {
    id: "quote-with-question",
    build: (quoteText, author) => {
      const attribution = author ? ` — ${author}` : "";
      return `"${quoteText}"${attribution}\n\nWhat are your thoughts on this? Drop your perspective below 👇💬`;
    },
  },
  {
    id: "quote-with-engagement",
    build: (quoteText, author) => {
      const attribution = author ? ` — ${author}` : "";
      return `"${quoteText}"${attribution}\n\nDouble tap if this resonates with you ❤️\nShare with someone who needs this message today! ✨`;
    },
  },
  {
    id: "quote-with-action",
    build: (quoteText, author) => {
      const attribution = author ? ` — ${author}` : "";
      return `"${quoteText}"${attribution}\n\nHow do you put this into practice? Let's discuss in the comments 💡`;
    },
  },
];

export function findCaptionTemplate(id: string): CaptionTemplate {
  const template = CAPTION_TEMPLATES.find((t) => t.id === id);
  if (!template) {
    throw new Error(`Unknown caption template id "${id}"`);
  }
  return template;
}

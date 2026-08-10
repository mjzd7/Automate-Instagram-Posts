# Font pairing research

Sources (scraped in full via firecrawl, not just search snippets):
- [The Brief — 30 Charming Google Font Pairings 2026](https://www.thebrief.ai/blog/google-font-pairings/)
- [Design Work Life — Best Fonts for Quotes](https://designworklife.com/best-font-for-quotes/)
- [Canva — How to design a creative quote graphic](https://www.canva.com/learn/how-to-design-a-creative-quote-for-social-media/)

## Core findings

**Two-or-three-font rule.** Canva's own guidance for quote cards: "you can either pair two or three contrasting weights and styles or stick to one font that best represents the mood of your design." This confirms the plan's 2-font-max rule (`plan.md` §"Font pairing": never mix more than two fonts) is the right ceiling, not overly conservative.

**Pairing logic that works, per The Brief's 30 examples**: pair a **bold/black weight display font** with a **regular-weight companion in a different classification** — e.g. their #1 pairing is Montserrat *Black* (not just Montserrat) + Raleway *Regular*. The weight contrast matters as much as the typeface contrast. Applied to our templates: the quote-text font should render at a heavier weight (700/800/Black where the family offers it) even though the *family* pairing is already established; the author-line font stays at Regular.

**Font psychology (Design Work Life), directly actionable for category-to-template mapping**:
- Serif fonts → traditional, formal, sophisticated, "heritage/authority/prestige"
- Sans serif → clean, minimalist, modern, highest legibility at small sizes — explicitly called out as the right choice "for digital quotes on websites, mobile, social media—times when readability is paramount"
- Script/handwritten → personal, artistic, intimate — good for reflective/personal quote categories
- Slab serif → bold, attention-grabbing, "heaviness emphasizes importance" — good for high-impact/motivational categories
- Display/decorative → lively, playful, unique — good for humor categories

**Quote length → shorter is better.** Canva: "Shorter quotes work best, as you'll have more room for your text to breathe" — reinforces the plan's `TARGET_MAX_CHARS_PER_LINE=32` and the truncate-with-`…` fallback at `FONT_SIZE_MIN` rather than ever cramming.

**Letter-spacing as a deliberate device.** Canva's worked example: increase letter-spacing on the whole quote for breathing room, and increase it *more* on the author name specifically to create contrast between quote and attribution — cheap, high-leverage technique. **Actionable addition to `compositor.ts`**: apply `letter-spacing: 0.01em` on the quote text and `letter-spacing: 0.08em` + uppercase transform on the author line, on top of the font-pairing contrast already planned.

**Shape-behind-text device.** Canva also uses a simple line element placed *behind* the author's name (z-order: behind) to visually separate attribution from quote — a low-cost embellishment worth considering as a template variant, not required for MVP.

## Confirmed mapping — category → template lean

| Category type | Best-fit template (from the 4 chosen) |
|---|---|
| Motivational, business/success | `bold-modern` (Montserrat + Merriweather) — bold sans header matches "amplify the message" guidance |
| Stoic, wisdom | `editorial-elegant` (Bodoni Moda + Raleway) — serif gravity for "heritage/authority" tone |
| Humor, mindfulness/lighthearted | `soft-curvy` (Abril Fatface + Work Sans) |
| Love, personal/reflective | `authentic-personal` (Caveat + Lato) — script for "intimate, personal" per the psychology mapping above |

This mapping should seed `mode-weighting.ts`'s initial template-selection bias before real publish-success data accumulates (still subject to the `MODE_WEIGHTING_FLOOR`=0.20 so no template is ever fully excluded).

## Google Fonts confirmed available (all free, self-host as `.woff2` per plan §7.12)
Montserrat, Merriweather, Bodoni Moda, Raleway, Abril Fatface, Work Sans, Caveat, Lato — all present in the Google Fonts catalog referenced across sources above; no substitutions needed.

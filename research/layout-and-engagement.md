# Layout & engagement research

Sources (scraped in full via firecrawl):
- [Krumzi — 15 Instagram Carousel Ideas That Actually Drive Engagement in 2026](https://www.krumzi.com/blog/15-instagram-carousel-ideas-that-actually-drive-engagement-in-2026)
- [Canva — How to design a creative quote graphic for social media](https://www.canva.com/learn/how-to-design-a-creative-quote-for-social-media/)

Note: Krumzi's article is about multi-slide carousels, a different format from this project's single-image quote posts — findings below are filtered to what transfers to a single-card format; carousel-specific mechanics (slide count, swipe hooks) are noted as *not applicable* where relevant.

## Dimensions — direct confirmation

"Instagram carousels perform best at **1080 x 1350px (4:5 ratio)**. This vertical format takes up maximum screen space in the feed." Exact match to the plan's `IMAGE_WIDTH`/`IMAGE_HEIGHT` constants (§2.1) — confirmed, no change needed. This figure is now corroborated by two independent sources (this one, plus the original planning-phase citation).

## Mobile legibility — a concrete floor the plan didn't have

"Over 80% of Instagram users browse on phones. Use a **minimum of 24pt font for body text**... If you have to zoom in to read it, the text is too small." This is a genuinely new, concrete data point: the plan's `FONT_SIZE_MIN=32px` (§2.1) already clears this bar with margin (32px ≈ 24pt at typical rendering DPI), so **no change needed**, but this is worth recording as the empirical justification for why `FONT_SIZE_MIN` must not be lowered further in any future tuning pass — 24pt is presented as an engagement-relevant floor, not just a personal-preference readability guideline.

## First-impression / "stop the scroll" principle — applies directly

"Your first slide competes with thousands of other posts in the feed. Use **bold typography, high contrast**, and a clear headline." For a single-image quote post (no carousel "first slide" concept, but the *post itself* is the equivalent competing unit), this reinforces two things already in the plan: (1) the bold/display half of each font pairing should dominate visually (already true — quote text uses the bold display font, author line uses the calm companion), and (2) the WCAG contrast floor from `research/contrast-and-blending.md` is not just an accessibility nicety here but directly tied to scroll-stopping performance.

## Consistent branding across a set — applies to the multi-account/multi-post design directly

"Use the same colors, fonts, and layout style across every slide/post. This doesn't mean every [post] looks identical, but they should clearly belong to the same set." This directly supports the plan's per-account template-weighting design (`mode-weighting.ts`, §7.13): posts should draw from a **constrained, consistent set of 4 templates** (already the design) rather than fully randomizing font/color choices per post — the weighting mechanism naturally produces "clearly belongs to the same set" behavior over a day's ~20 posts, since it's drawing from a small fixed pool rather than generating novel combinations each time. No change needed; this is confirmation that the template-pool approach (vs. e.g. procedurally generating new font/color combos) was the right call.

## Caption structure — informs `caption template` design (not previously detailed in the plan)

Krumzi's guidance ("write your caption like a mini blog post... put your target keyword in the first sentence... add context, share a personal story, or ask a question that drives comments") is carousel/blog-content-specific and **does not transfer** to a short quote-card caption — a quote post's caption should stay short (the quote/author is the content; a long caption competes with, rather than supports, the image). No change to the plan's caption-template approach; noting explicitly that this source's caption advice was considered and deliberately not adopted, rather than overlooked.

## Posting-time guidance — corroborates, doesn't replace, the plan's scheduling design

"Post at peak engagement times... check your Instagram Insights to find when your audience is most active." This is the generic version of what the plan already does more specifically: `DEFAULT_POSTING_HOURS_LOCAL=[10,13,17,20]` (§2.6) is a reasonable default engagement-window set even without per-account Insights data (which the plan deliberately avoids depending on, per the earlier "no `instagram_manage_insights` dependency" decision). No change — this source doesn't provide more specific timing data than what's already encoded, since its guidance is oriented around manually checking per-account Insights, which this project intentionally doesn't build a dependency on.

## Letter-spacing / breathing room — cross-referenced with `fonts.md`

Canva's worked example (increasing letter-spacing on quote text and more on the author line) is covered in `research/fonts.md` — noted here only to flag that both sources independently emphasize **generous spacing over dense text** as an engagement-relevant (not just aesthetic) choice, reinforcing the plan's `TARGET_MAX_CHARS_PER_LINE=32` short-line design.

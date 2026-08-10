# Learnings — eliminate-quote-truncation

Conventions, patterns, and successful approaches discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

## 2026-08-10 Task: Core text rendering changes completed

- Added QuoteTruncatedError class to text-render.ts and exported it for use by compositor.ts
- Modified renderFittedText function to remove truncation fallback and instead throw QuoteTruncatedError when text doesn't fit at FONT_SIZE_MIN
- Updated compositor.ts to import QuoteTruncatedError from text-render.ts instead of defining it locally
- Increased CARD_VERTICAL_MARGIN_PX from 120 to 160 in constants.ts, increasing quoteMaxHeight from ~836px to ~916px
- Reduced MAX_QUOTE_WORDS from 25 to 22 in constants.ts to provide additional filtering of long quotes

These changes eliminate quote truncation by ensuring that when a quote doesn't fit within the available space, the pipeline throws an error and retries with a different quote rather than truncating the text.

## 2026-08-10 Task: Deferred enhancements

The following enhancements were considered but deferred for future work:

1. **Font-aware height calculation**: Analyzing font metrics for ascender/descender height to prevent truncation due to tall ascenders/descenders in fonts like Playfair Display. This would require parsing font files to extract metrics, which adds complexity and potential dependencies. The increased vertical margin (CARD_VERTICAL_MARGIN_PX) provides sufficient buffer for most use cases.

2. **Logging/monitoring for near-limit cases**: Adding detection when quotes use >90% of available height to help identify borderline cases for future adjustments. While useful for tuning, this is not essential to the core goal of eliminating truncation and can be added later if needed for optimization.

The core implementation successfully eliminates quote truncation by:
- Removing the truncation fallback mechanism in renderFittedText
- Making the pipeline retry with different quotes when text doesn't fit (via QuoteTruncatedError)
- Increasing vertical safety margins for more reliable text rendering
- Providing additional filtering of extremely long quotes via reduced MAX_QUOTE_WORDS


## 2026-08-10 Task: Tests updated and verified

- Updated packages/core/test/images/text-render.test.ts to reflect new behavior (throws QuoteTruncatedError instead of returning truncated result)
- Updated packages/core/test/content-filter/length-filter.test.ts to reflect new MAX_QUOTE_WORDS value of 22
- All tests pass: 300/300 tests successful
- TypeScript compilation succeeds with no errors

## 2026-08-10 Task: Deferred enhancements

The following enhancements were considered but deferred for future work:

1. **Font-aware height calculation**: Analyzing font metrics for ascender/descender height to prevent truncation due to tall ascenders/descenders in fonts like Playfair Display. This would require parsing font files to extract metrics, which adds complexity and potential dependencies. The increased vertical margin (CARD_VERTICAL_MARGIN_PX) provides sufficient buffer for most use cases.

2. **Logging/monitoring for near-limit cases**: Adding detection when quotes use >90% of available height to help identify borderline cases for future adjustments. While useful for tuning, this is not essential to the core goal of eliminating truncation and can be added later if needed for optimization.

The core implementation successfully eliminates quote truncation by:
- Removing the truncation fallback mechanism in renderFittedText
- Making the pipeline retry with different quotes when text doesn't fit (via QuoteTruncatedError)
- Increasing vertical safety margins for more reliable text rendering
- Providing additional filtering of extremely long quotes via reduced MAX_QUOTE_WORDS

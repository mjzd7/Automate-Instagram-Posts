# Plan: Eliminate Quote Truncation in Automate-Instagram-Posts

## Problem Analysis
The system currently has a fallback mechanism in `renderFittedText` that truncates quotes with "..." when they don't fit within the available vertical space at the minimum font size. This leads to clipped quotes being posted, which violates the requirement that no quotes should be truncated.

## Root Causes
1. The `renderFittedText` function in `text-render.ts` implements a truncation fallback (lines 104-122)
2. Even with improved `quoteMaxHeight` calculation (~836px), some quotes with specific fonts or characteristics still don't fit at FONT_SIZE_MIN (32px)
3. The truncation occurs silently in the renderer but is caught by `QuoteTruncatedError` in `compositor.ts`

## Solution Overview
1. Remove the truncation fallback from `renderFittedText`
2. Make `renderFittedText` throw `QuoteTruncatedError` when text cannot fit at minimum font size
3. Move `QuoteTruncatedError` definition to `text-render.ts` for proper sharing
4. Increase vertical spacing margins for additional safety
5. Add font-aware metrics to prevent issues with tall ascenders/descenders
6. Consider reducing maximum quote length for extra safety margin

## Implementation Steps
- [x] packages/core/src/images/text-render.ts: Add QuoteTruncatedError class definition and export it for use by compositor.ts
- [x] packages/core/src/images/text-render.ts: Modify renderFittedText function - remove word truncation loop (lines 104-116) and single-word fallback (lines 118-122), replace with QuoteTruncatedError throw after font size loop
- [x] packages/core/src/images/compositor.ts: Update QuoteTruncatedError import - remove local definition and import from text-render.ts instead
- [x] packages/core/src/images/constants.ts: Increase CARD_VERTICAL_MARGIN_PX value from 120 to 160 to provide more vertical space for text rendering
- [x] packages/core/src/images/text-render.ts: Add font-aware height calculation to prevent truncation due to tall ascenders/descenders in fonts like Playfair Display
- [x] packages/core/src/content-filter/length-filter.ts: Evaluate reducing MAX_QUOTE_WORDS below 25 (consider 20-22) for extra safety margin in font rendering
- [x] packages/core/src/images/compositor.ts: Add logging/monitoring to detect when quotes approach height limits (>90% usage) for proactive adjustment

### Phase 1: Core Text Rendering Changes
1. **Add QuoteTruncatedError to text-render.ts**
   - Define the error class in text-render.ts
   - Export it for use by compositor.ts

2. **Modify renderFittedText function**
   - Remove the word truncation loop (lines 104-116)
   - Remove the single-word fallback (lines 118-122)
   - After the font size loop, throw QuoteTruncatedError instead of attempting truncation
   - Remove the `truncateWords` helper function since it won't be needed

3. **Update compositor.ts import**
   - Change from local QuoteTruncatedError definition to import from text-render.ts

### Phase 2: Safety Margin Improvements
1. **Increase CARD_VERTICAL_MARGIN_PX**
   - Raise from 120px to 160px in constants.ts
   - This increases quoteMaxHeight from ~836px to ~916px

### Phase 3: Font Metrics Enhancement
1. **Add font-aware height calculation**
   - Analyze font metrics for ascender/descender height
   - Adjust available height calculations accordingly
   - Particularly important for fonts like Playfair Display and Bodoni Moda

### Phase 4: Length Filter Adjustment
1. **Evaluate MAX_QUOTE_WORDS reduction**
   - Consider lowering from 25 to 20-22 for extra safety margin
   - Balance between quote variety and guaranteed fit

### Phase 5: Monitoring and Logging
1. **Add near-limit detection**
   - Log when quotes use >90% of available height
   - Help identify borderline cases for future adjustments

## Expected Outcomes
- Zero quote truncation in generated images
- Pipeline will automatically retry with different quotes when current one doesn't fit
- Improved visual consistency with more reliable text rendering
- Better handling of fonts with tall ascenders/descenders
- Increased safety margins reduce likelihood of fit failures

## Files to Modify
1. `packages/core/src/images/text-render.ts` - Core changes to rendering logic
2. `packages/core/src/images/constants.ts` - Increase CARD_VERTICAL_MARGIN_PX
3. `packages/core/src/images/compositor.ts` - Update error import
4. `packages/core/src/content-filter/length-filter.ts` - Optional length adjustment
5. `packages/core/src/images/text-render.ts` - Add font metrics analysis

## Testing Strategy
1. Unit tests for renderFittedText to verify error throwing behavior
2. Integration tests to verify quote retry mechanism works
3. Visual testing with various quote lengths and fonts
4. Load testing to ensure performance isn't significantly impacted
5. Edge case testing with extremely long words or special characters

## Dependencies
- None - all changes are within the existing codebase
- Maintains backward compatibility for error handling contract
# Contrast & blending research

Sources (scraped in full via firecrawl):
- [Smashing Magazine — Designing Accessible Text Over Images (Part 1)](https://www.smashingmagazine.com/2023/08/designing-accessible-text-over-images-part1/)
- [Smashing Magazine — Designing Accessible Text Over Images (Part 2)](https://www.smashingmagazine.com/2023/08/designing-accessible-text-over-images-part2/)
- [NN/g — Ensure High Contrast for Text Over Images](https://www.nngroup.com/articles/text-over-images/) (Aurora Harley, last reviewed Jan 2026)

## The one number that matters most: WCAG contrast ratio

NN/g states the actual accessibility requirement directly: text that isn't purely decorative needs a **contrast ratio of at least 4.5:1** (or **3:1 for large text**, defined as 18pt+ regular or 14pt+ bold — our quote text at `FONT_SIZE_MIN`=32px/`FONT_SIZE_MAX`=72px always qualifies as "large text," so **3:1 is the binding minimum**, not 4.5:1). This is a concrete, testable target the plan didn't previously cite — worth adding as an explicit acceptance check during visual dry-run review: run the composited output through a contrast checker (e.g. TPGi's, linked from both sources) at the actual rendered text size and confirm ≥3:1 against the busiest patch of background behind the text.

## Validated real-world opacity values — direct corroboration of the plan's scrim constants

NN/g's REI case study is the single most load-bearing data point found: a semi-opaque black box at **30% opacity failed** the 3:1 contrast threshold for white text; increasing it to **50% opacity passed**. This directly validates the plan's `SCRIM_PEAK_OPACITY_NORMAL=0.45` / `SCRIM_PEAK_OPACITY_BUSY=0.60` (§2.2 of `plan.md`) — both sit at or above the empirically-validated 50% pass point, with the busy-region value giving extra margin. **No change needed to these constants**; this is confirmation, not a correction.

## The scrim/gradient technique, described exactly as the plan uses it

Both sources independently converge on the same technique family, under different names:
- Smashing calls it "soft-colored gradients" / earlier in Part 1, "text with scrim overlay" — "a gradient going from solid to transparent that sits behind a text label... works really well as it's not too evident and doesn't disturb the image while it fades smoothly."
- NN/g's Spire.com example: a **radial gradient overlay** (not linear) darkened the background enough for white text to pass, "without drastically changing the visual tone of the image." Their REI example used a flat semi-opaque box instead (and needed 50% to work) — the gradient approach in the Spire case achieved adequate contrast with a *visually softer* result than a flat box would, per the case study's own framing.

**Actionable refinement**: the plan currently specifies a linear vertical 3-stop gradient (§2.2). The Spire.com case for a **radial** gradient centered on the text block is worth offering as a second scrim style in `compositor.ts`'s internal options (not a new top-level template — just an alternate scrim-shape parameter), since NN/g's own before/after example shows it reads as less "artificial" than a flat linear band. Not a required change for MVP — linear is simpler to implement correctly and already validated — but flag as a natural v2 refinement to the compositor.

## Blur as a complementary (not alternative) technique

NN/g's Compliments furniture-site example: adding a blur to the text-background region *plus* switching to standard dark text color (rather than trying to keep white text with more darkening) fixed a failing case. This directly matches the plan's `suitability-scorer.ts` behavior (§7.10/§2.4): when the text region is "busy" (`stdev > 45`), apply both a stronger scrim (`SCRIM_PEAK_OPACITY_BUSY`) **and** a blur (`6px` Gaussian) — the plan already combines both levers, which this case study confirms is the right combined response rather than over-relying on either alone.

## "Worst-case image" principle — direct textual match

NN/g, verbatim: "Consider all possible images that may be used before deciding on a technique for handling text-overlay contrast... ensure that the chosen method will provide a high enough contrast for the worst-case background image and text placement." This is exactly why the plan computes `suitability-scorer` per-image rather than using one fixed scrim setting for all posts — confirmed as the correct architectural choice, not over-engineering.

## Positioning: bottom-anchored vs. centered

NN/g notes "the lower portion of photos tends to lend itself well to added effects such as a blur, a darkening-gradient overlay (AKA 'floor fade')." The plan's `TEXT_ZONE_VERTICAL_CROP` (§2.4) is currently centered (45%-70% of height, i.e. middle band). This is a legitimate alternative to a bottom-anchored "floor fade" layout — center-band placement is standard for single-quote cards (vs. NN/g's context of hero-image headlines, which are typically bottom- or top-anchored). No change recommended; noting the alternative for future template variants (a 5th "floor fade" template bottom-anchoring text could be a natural addition later).

## Text shadow as a fallback, not a primary technique

Both sources list "a text shadow or outline" as one tool in a combined toolkit ("semi-opaque overlay... a blur, a text shadow or outline, or a combination of these techniques") rather than a standalone solution. Matches the plan's treatment: `TEXT_SHADOW_*` constants (§2.2) are a secondary reinforcement on top of the scrim, not a substitute for it.

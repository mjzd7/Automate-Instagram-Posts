import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { composeStory, composeStoryImage, STORY_HEIGHT, STORY_WIDTH } from "../../src/images/story-compositor.js";
import { findTemplate, STORY_TEMPLATES } from "../../src/images/templates.js";
import { solidColorImage } from "./fixtures.js";

const calmSuitability = {
  busy: false,
  busynessScore: 5,
  scrimOpacity: 0.45,
  blurRegion: false,
  textZoneRegion: { left: 108, top: 607, width: 864, height: 337 },
};

const fixedRandom = () => 0.5;

describe("story-compositor", () => {
  it("produces a valid 9:16 JPEG at 1080 x 1920", async () => {
    const background = await solidColorImage(600, 800, { r: 30, g: 30, b: 30 });
    const buffer = await composeStoryImage({
      backgroundBuffer: background,
      quoteText: "The journey of a thousand miles begins with one step.",
      author: "Lao Tzu",
      template: findTemplate("bold-modern"),
      mode: "dark",
      suitability: calmSuitability,
      grainRandom: fixedRandom,
    });

    const metadata = await sharp(buffer).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(STORY_WIDTH);
    expect(metadata.height).toBe(STORY_HEIGHT);
  });

  it("returns ComposeStoryResult with linkStickerZone and templateId", async () => {
    const background = await solidColorImage(600, 800, { r: 50, g: 50, b: 50 });
    const result = await composeStory({
      backgroundBuffer: background,
      quoteText: "Opportunities don't happen. You create them.",
      author: "Chris Grosser",
      template: findTemplate("corporate-clean"),
      mode: "light",
      suitability: calmSuitability,
      storyTemplateId: "story-editorial-newspaper",
      grainRandom: fixedRandom,
    });

    expect(result.templateId).toBe("story-editorial-newspaper");
    expect(result.linkStickerZone).toEqual({ x: 180, y: 1320, width: 720, height: 130 });
    expect(result.imageBuffer).toBeInstanceOf(Buffer);

    const metadata = await sharp(result.imageBuffer).metadata();
    expect(metadata.width).toBe(STORY_WIDTH);
    expect(metadata.height).toBe(STORY_HEIGHT);
  });

  it("smoke-tests all 6 story templates: each composes without throwing", async () => {
    const background = await solidColorImage(600, 800, { r: 80, g: 80, b: 80 });
    for (const storyTpl of STORY_TEMPLATES) {
      const result = await composeStory({
        backgroundBuffer: background,
        quoteText: "Testing template composition.",
        author: "Tester",
        template: findTemplate("bold-modern"),
        mode: "dark",
        suitability: calmSuitability,
        storyTemplateId: storyTpl.id,
        grainRandom: fixedRandom,
      });

      const metadata = await sharp(result.imageBuffer).metadata();
      expect(metadata.width, storyTpl.id).toBe(STORY_WIDTH);
      expect(metadata.height, storyTpl.id).toBe(STORY_HEIGHT);
      expect(result.linkStickerZone, storyTpl.id).toBeDefined();
    }
  });

  it("accepts a pre-rendered 1:1 feedPostBuffer for exact post-reshare framing", async () => {
    const background = await solidColorImage(600, 800, { r: 100, g: 100, b: 100 });
    const feedPost = await solidColorImage(1080, 1080, { r: 200, g: 100, b: 50 });

    const result = await composeStory({
      backgroundBuffer: background,
      quoteText: "Pre-rendered feed post test.",
      author: "Author",
      template: findTemplate("bold-modern"),
      mode: "dark",
      suitability: calmSuitability,
      feedPostBuffer: feedPost,
      storyTemplateId: "story-polaroid-teaser",
      grainRandom: fixedRandom,
    });

    const metadata = await sharp(result.imageBuffer).metadata();
    expect(metadata.width).toBe(STORY_WIDTH);
    expect(metadata.height).toBe(STORY_HEIGHT);
  });

  it("renders visual audio equalizer badge overlay when audioTrack is specified", async () => {
    const background = await solidColorImage(600, 800, { r: 40, g: 40, b: 40 });
    const result = await composeStory({
      backgroundBuffer: background,
      quoteText: "Audio badge overlay test.",
      author: "Tester",
      template: findTemplate("bold-modern"),
      mode: "dark",
      suitability: calmSuitability,
      audioTrack: {
        title: "Ambient Reflection",
        artist: "Chill Sound",
      },
      grainRandom: fixedRandom,
    });

    const metadata = await sharp(result.imageBuffer).metadata();
    expect(metadata.width).toBe(STORY_WIDTH);
    expect(metadata.height).toBe(STORY_HEIGHT);
  });
});

// Per-series prompt contracts (docs/PLAN-multi-series.md §4.3). Pure string
// builders — no network, no clock — so constraint regressions are testable.

export const SERIES_IDS = [
  "hook-lab",
  "confession-cards",
  "villain-roasts",
  "fill-the-blank",
  "season-reset",
  "mindset-manual",
] as const;

export type SeriesId = (typeof SERIES_IDS)[number];

const PAIN_INVENTORY = [
  "doomscrolling comparison — checking someone's highlight reel right after checking your own screen time",
  "side-hustle burnout — weeknight number three on a project that has not paid a cent yet",
  "AI-era career anxiety — quietly wondering whether your role exists in five years",
  "gym consistency — the session you promised yourself and then negotiated away",
  "starting over at something you feel too old to start",
];

const VILLAIN_INVENTORY = [
  "doomscrolling",
  "fake gurus selling six-figure-blueprint courses",
  "the snooze button",
  "waiting to feel motivated before starting",
];

const SEASONAL_MOODS = [
  "Sunday-night dread before a heavy week",
  "Monday reset energy — fresh page, clean slate",
  "exam-season pressure and late-night study grind",
  "new-year energy two weeks after everyone quit",
];

const HOOK_ARCHETYPES = ["controversy", "stat", "callout", "negative", "story-open"] as const;

const ARCHETYPE_BRIEFS: Record<(typeof HOOK_ARCHETYPES)[number], string> = {
  controversy: "attacks the audience's favourite crutch; opinionated comment bait within the niche",
  stat: "leads with a specific number plus a curiosity gap about the payoff",
  callout: "second-person 'that's me' address; feels personally aimed",
  negative: "tells them to stop doing the thing this page normally celebrates; self-aware twist",
  "story-open": "opens a personal narrative mid-tension with the payoff withheld",
};

const DEFAULT_ARCHETYPE: (typeof HOOK_ARCHETYPES)[number] = "controversy";

function jsonOnlyInstruction(): string {
  return "Respond with ONLY a valid JSON object, no markdown, no commentary.";
}

function buildPrompt(seriesId: SeriesId, index: number): string {
  switch (seriesId) {
    case "hook-lab": {
      const archetype =
        HOOK_ARCHETYPES[index % HOOK_ARCHETYPES.length] ?? DEFAULT_ARCHETYPE;
      return `You are a viral content strategist for an Instagram motivation quote page (@success.for.sure, audience 18-35 into discipline and levelling up).

Write ONE scroll-stopping hook line that will appear as cover text on a quote card.

Archetype: ${archetype} — ${ARCHETYPE_BRIEFS[archetype]}.

Hard constraints:
- Maximum 12 words
- No clichés (banned: "grind", "dream big", "hustle harder")
- No emojis, no hashtags, no @mentions

${jsonOnlyInstruction()}
Format: {"archetype": "${archetype}", "text": "..."}`;
    }
    case "confession-cards":
      return `You write short first-person confession quotes for an Instagram self-improvement audience. They should feel like reading someone's private notes, not being lectured.

Pain angle for this item: ${PAIN_INVENTORY[index % PAIN_INVENTORY.length]}

Hard constraints:
- First person voice ("I...", "my...")
- Between 90 and 160 characters total
- At least 2 concrete specificity markers (time, place, object, or number)
- No emojis, no hashtags, no @mentions
- Banned abstractions: "grind", "hustle", "dream big", "success journey"

${jsonOnlyInstruction()}
Format: {"text": "..."}`;
    case "villain-roasts":
      return `You write one-line gentle roasts of the shared enemies of self-improvement people, for an Instagram quote page. Punchy enough to be sent in a group chat.

Villain for this item: ${VILLAIN_INVENTORY[index % VILLAIN_INVENTORY.length]}

Hard constraints:
- Maximum 100 characters
- Roast the behaviour, never a named individual, group, or @mention
- No emojis, no hashtags

Always append this exact share CTA as ctaTag: "Send this to your accountability partner."

${jsonOnlyInstruction()}
Format: {"text": "...", "ctaTag": "Send this to your accountability partner."}`;
    case "fill-the-blank":
      return `You write interactive fill-the-blank sentences for an Instagram motivation page. Readers complete the gap in the comments, so the missing word must be obvious enough to answer but fun to argue about.

Hard constraints:
- Exactly one {{BLANK}} token marking the gap
- Maximum 120 characters including the token
- Plus a binary caption question (two options only) that starts the comment thread
- No emojis beyond none, no hashtags

${jsonOnlyInstruction()}
Format: {"text": "Success is 10% talent and 90% {{BLANK}}", "captionQuestion": "Talent or system?"}`;
    case "season-reset":
      return `You write short first-person reset quotes tuned to a specific emotional season, for an Instagram self-improvement audience.

Seasonal mood for this item: ${SEASONAL_MOODS[index % SEASONAL_MOODS.length]}

Hard constraints:
- First person voice
- Between 90 and 160 characters total
- At least 1 concrete time marker (day, hour, date, season)
- No emojis, no hashtags, no @mentions

${jsonOnlyInstruction()}
Format: {"text": "..."}`;
    case "mindset-manual":
      return `You design compact named frameworks for an Instagram save-worthy series called "Mindset Manual". Frameworks are reference material people bookmark.

Theme for this item: ${THEME_ROTATION[index % THEME_ROTATION.length]}

Hard constraints:
- Title follows the exact pattern "The N-N-N Name" (like The 3-3-3 Morning)
- 3 to 5 steps, each imperative voice, max 8 words per step
- One practical utilityLine telling the reader to try it today
- Short plain-text summary of the framework for the card body
- No emojis, no hashtags

${jsonOnlyInstruction()}
Format: {"framework": {"title": "The 3-3-3 Morning", "steps": ["Journal 3 min", "Pick 3 priorities", "Block 3 focus hours"]}, "utilityLine": "Try it tomorrow morning.", "text": "Journal, prioritise, focus — before 9am."}`;
  }
}

const THEME_ROTATION = [
  "morning routines",
  "deep work",
  "handling setbacks",
  "saying no",
  "energy management",
  "evening wind-downs",
];

export function buildGenerationPrompt(seriesId: string, index: number): string {
  if (!SERIES_IDS.includes(seriesId as SeriesId)) {
    throw new Error(`Unknown series id: ${seriesId}`);
  }
  return buildPrompt(seriesId as SeriesId, index);
}

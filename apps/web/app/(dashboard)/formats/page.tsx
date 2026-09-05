import Link from "next/link";
import { PageHeader, TitaniumCard } from "@/components/ui";
import { loadSeriesConfig } from "@/lib/series-files";

interface SeriesDisplayMeta {
  id: string;
  name: string;
  format: "Reel" | "Carousel" | "Single Card";
  formatIcon: string;
  formatColor: string;
  aspectRatio: string;
  decisionReason: string;
  sampleImg: string;
  sampleQuote: string;
  sampleArchetype: string;
  algorithmTarget: string;
  postingSlot: string;
}

const SERIES_METAS: Record<string, SeriesDisplayMeta> = {
  "hook-lab": {
    id: "hook-lab",
    name: "Hook Lab",
    format: "Reel",
    formatIcon: "🎬",
    formatColor: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    aspectRatio: "9:16 Vertical Video (6.5s Auto-Loop)",
    decisionReason:
      "Short, provocative 1-liner hooks (<15 words) that create curiosity gaps or controversy. Best as a fast 6.5s looping Reel with trending audio to drive broad non-follower reach and high completion rates.",
    sampleImg: "/api/media/dry-run/hook-lab-2026-09-001.jpg",
    sampleQuote: "Your morning routine is just expensive procrastination.",
    sampleArchetype: "controversy · dark mode",
    algorithmTarget: "Explore & Reels feed discovery (High Loop Rate)",
    postingSlot: "Mon / Wed / Fri · 11:00 AM & 7:00 PM",
  },
  "mindset-manual": {
    id: "mindset-manual",
    name: "Mindset Manual",
    format: "Carousel",
    formatIcon: "📑",
    formatColor: "border-blue-500/40 bg-blue-500/10 text-blue-300",
    aspectRatio: "4:5 Swipeable Deck (3–5 Slides)",
    decisionReason:
      "Multi-step actionable frameworks and tactical mental models that cannot fit on one slide. Carousels get re-served to users on slide 2 if they scroll past slide 1, generating 3x more Saves and Shares.",
    sampleImg: "/api/media/dry-run/mindset-manual-2026-09-002.jpg",
    sampleQuote: "Stop the spiral, extract the data, and pivot instantly.",
    sampleArchetype: "framework · light mode",
    algorithmTarget: "Maximum Saves, Shares & Dwell Time",
    postingSlot: "Wed 11:00 AM · Sun 7:00 PM",
  },
  "confession-cards": {
    id: "confession-cards",
    name: "Confession Cards",
    format: "Single Card",
    formatIcon: "🖼️",
    formatColor: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    aspectRatio: "4:5 Portrait Feed Card",
    decisionReason:
      "High-contrast, raw vulnerability and honest admissions. Works best as an authoritative static feed post that anchors the signature dark/light checkerboard feed pattern.",
    sampleImg: "/api/media/dry-run/confession-cards-2026-09-001.jpg",
    sampleQuote: "I spent three years waiting for confidence before I realized action creates it.",
    sampleArchetype: "truth · dark mode",
    algorithmTarget: "Instant Likes & Feed Aesthetics Retention",
    postingSlot: "Mon / Tue / Thu / Sat (Alternating Slots)",
  },
  "villain-roasts": {
    id: "villain-roasts",
    name: "Villain Roasts",
    format: "Reel",
    formatIcon: "🎬",
    formatColor: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    aspectRatio: "9:16 Vertical Video (6.5s Auto-Loop)",
    decisionReason:
      "Sharp, witty roasts of fake productivity, toxic hustle, and modern delusions. Short punchlines designed for users to immediately DM to their friends ('Bro this is literally you').",
    sampleImg: "/api/media/dry-run/villain-roasts-2026-09-001.jpg",
    sampleQuote: "Your thumb is getting more exercise than the rest of your body.",
    sampleArchetype: "roast · dark mode",
    algorithmTarget: "Viral DM Shares & Comments",
    postingSlot: "Thu · 7:00 PM",
  },
  "fill-the-blank": {
    id: "fill-the-blank",
    name: "Fill the Blank",
    format: "Single Card",
    formatIcon: "🖼️",
    formatColor: "border-purple-500/40 bg-purple-500/10 text-purple-300",
    aspectRatio: "4:5 Portrait Feed Card",
    decisionReason:
      "Interactive sentence prompts designed for high comment participation. The user feels compelled to complete the thought in the comment section, triggering the algorithm's comment boost.",
    sampleImg: "/api/media/dry-run/fill-the-blank-2026-09-001.jpg",
    sampleQuote: "The hardest habit to break in your twenties is _______.",
    sampleArchetype: "prompt · light mode",
    algorithmTarget: "Comment Velocity & Community Engagement",
    postingSlot: "Tue 7:00 PM · Sat 11:00 AM",
  },
  "season-reset": {
    id: "season-reset",
    name: "Season Reset",
    format: "Carousel",
    formatIcon: "📑",
    formatColor: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    aspectRatio: "4:5 Multi-slide Deck (3 Slides)",
    decisionReason:
      "Reflective quarterly and monthly audits. Slide 1 introduces the audit question, Slide 2 lists the 3 questions to ask yourself, Slide 3 gives the actionable weekly reset routine.",
    sampleImg: "/api/media/dry-run/season-reset-2026-09-001.jpg",
    sampleQuote: "Audit your last 90 days before you plan your next 90.",
    sampleArchetype: "reflection · dark mode",
    algorithmTarget: "High Bookmark / Save Ratio",
    postingSlot: "Fri 7:00 PM · Sun 11:00 AM",
  },
};

const PHOTO_STYLES = [
  {
    name: "Obsidian Slate (Dark Mode)",
    desc: "Subtle architectural concrete texture with deep charcoal gradients and moody vignette shadows. Used for high-authority, dark checkerboard slots.",
    tone: "Deep Dark (#0A0A0C)",
    contrast: "Alabaster White Typography",
    series: "Hook Lab, Confession Cards, Villain Roasts",
  },
  {
    name: "Alabaster Editorial (Light Mode)",
    desc: "Clean, ultra-high-contrast minimalist paper texture with rich serif typography. Crucial for preserving the alternating 3-column checkerboard grid.",
    tone: "Warm Pure White (#FAFAFA)",
    contrast: "Jet Black Cormorant Typography",
    series: "Mindset Manual, Fill the Blank, Season Reset",
  },
  {
    name: "Glassmorphic Translucent Card",
    desc: "Frosted translucent titanium overlay (20px blur, 1px white/10 border) floating over deep ambient textures. Delivers modern luxury brand perception.",
    tone: "Titanium Glass Backdrop",
    contrast: "Bespoke Clean Typography",
    series: "Multi-Series Hero Cards & Quotes",
  },
  {
    name: "Cinematic 9:16 Typewriter Motion",
    desc: "Full-bleed vertical motion canvas with subtle grain and typewriter text overlay timed to trending lo-fi ambient audio for 6.5s auto-loops.",
    tone: "9:16 Fullscreen Video",
    contrast: "High-Visibility Centered Type",
    series: "Reels Pipeline & Story Covers",
  },
];

export default async function FormatsStudioPage() {
  const configs = await loadSeriesConfig();

  return (
    <div className="flex flex-col gap-8 pb-12">
      <PageHeader
        title="Studio & Content Formats"
        subtitle="How we categorize series, select visual styles, and decide between Reels, Carousels, and Feed Cards"
      />

      {/* 1. DECISION ENGINE: HOW WE DECIDE FORMATS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="font-display text-lg font-bold text-white">How We Decide: Reel vs. Carousel vs. Single Card</h2>
            <p className="font-mono text-xs text-slate-muted">Algorithmic rules and content criteria used to assign formats</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* REELS */}
          <TitaniumCard className="flex flex-col justify-between p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🎬</span>
                <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                  REEL (9:16 VIDEO)
                </span>
              </div>
              <h3 className="font-display text-base font-bold text-white">When We Make a Reel</h3>
              <ul className="space-y-2 font-mono text-xs text-slate-muted">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">▸</span>
                  <span><strong>Length:</strong> 1–2 punchy lines (&lt;18 words total).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">▸</span>
                  <span><strong>Trigger:</strong> Controversy, sharp callout, or relatable roast.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">▸</span>
                  <span><strong>Algorithm Goal:</strong> Broad non-follower discovery on the Reels feed.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">▸</span>
                  <span><strong>Format:</strong> 6.5-second auto-loop video with trending audio overlay.</span>
                </li>
              </ul>
            </div>
            <div className="mt-4 border-t border-white/5 pt-3 font-mono text-[11px] text-amber-300/80">
              Assigned Series: Hook Lab, Villain Roasts
            </div>
          </TitaniumCard>

          {/* CAROUSELS */}
          <TitaniumCard className="flex flex-col justify-between p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">📑</span>
                <span className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-300">
                  CAROUSEL (4:5 DECK)
                </span>
              </div>
              <h3 className="font-display text-base font-bold text-white">When We Make a Carousel</h3>
              <ul className="space-y-2 font-mono text-xs text-slate-muted">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">▸</span>
                  <span><strong>Length:</strong> Multi-step frameworks (3 to 5 slides).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">▸</span>
                  <span><strong>Trigger:</strong> Actionable steps, self-audit questions, before/after.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">▸</span>
                  <span><strong>Algorithm Goal:</strong> Maximum Saves & Shares. Instagram re-serves slide 2 if slide 1 was skipped.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">▸</span>
                  <span><strong>Format:</strong> Slide 1 (Hook) → Slides 2-4 (Steps) → Slide 5 (Save CTA).</span>
                </li>
              </ul>
            </div>
            <div className="mt-4 border-t border-white/5 pt-3 font-mono text-[11px] text-blue-300/80">
              Assigned Series: Mindset Manual, Season Reset
            </div>
          </TitaniumCard>

          {/* SINGLE CARDS */}
          <TitaniumCard className="flex flex-col justify-between p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🖼️</span>
                <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                  SINGLE CARD (4:5 FEED)
                </span>
              </div>
              <h3 className="font-display text-base font-bold text-white">When We Make a Single Card</h3>
              <ul className="space-y-2 font-mono text-xs text-slate-muted">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">▸</span>
                  <span><strong>Length:</strong> 1 authoritative, reflective statement.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">▸</span>
                  <span><strong>Trigger:</strong> Vulnerable confession, fill-the-blank prompt, deep truth.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">▸</span>
                  <span><strong>Algorithm Goal:</strong> High instant likes & comment velocity.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">▸</span>
                  <span><strong>Brand Role:</strong> Preserves the alternating Dark/Light checkerboard feed.</span>
                </li>
              </ul>
            </div>
            <div className="mt-4 border-t border-white/5 pt-3 font-mono text-[11px] text-emerald-300/80">
              Assigned Series: Confession Cards, Fill the Blank
            </div>
          </TitaniumCard>
        </div>
      </section>

      {/* 2. THE 6 MULTI-SERIES SHOWCASE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="font-display text-lg font-bold text-white">The 6 Content Series Roster & Renders</h2>
            <p className="font-mono text-xs text-slate-muted">Live visual preview of quotes, rendered cards, and format assignments</p>
          </div>
          <Link href="/series" className="font-mono text-xs text-slate-muted hover:text-white">
            View full series roster →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {configs.map((config) => {
            const meta = SERIES_METAS[config.id] ?? {
              id: config.id,
              name: config.name,
              format: "Single Card",
              formatIcon: "🖼️",
              formatColor: "border-white/20 text-white",
              aspectRatio: "4:5",
              decisionReason: "Standard quote card format.",
              sampleImg: `/api/media/dry-run/${config.id}-2026-09-001.jpg`,
              sampleQuote: "Live quote card from series.",
              sampleArchetype: "default",
              algorithmTarget: "Feed Engagement",
              postingSlot: "Scheduled Slot",
            };

            return (
              <TitaniumCard key={config.id} className="flex flex-col justify-between p-5">
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{meta.formatIcon}</span>
                        <h3 className="font-display text-base font-bold text-white">{config.name}</h3>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-slate-muted">
                        Category: <span className="text-white">{config.hashtagCategory}</span> · Slots/wk:{" "}
                        <span className="text-white">{config.slots.length}</span>
                      </p>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${meta.formatColor}`}>
                      {meta.format.toUpperCase()}
                    </span>
                  </div>

                  {/* Image & Quote Side-by-Side */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                    {/* Rendered Thumbnail */}
                    <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/10 bg-black sm:col-span-5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={meta.sampleImg}
                        alt={`${config.name} sample`}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </div>

                    {/* Details & Quote */}
                    <div className="flex flex-col justify-between space-y-3 sm:col-span-7">
                      <div className="space-y-2">
                        <blockquote className="rounded-lg border border-white/5 bg-white/[0.02] p-3 font-serif text-sm italic leading-relaxed text-platinum">
                          "{meta.sampleQuote}"
                        </blockquote>
                        <div className="space-y-1 font-mono text-[11px] text-slate-muted">
                          <div>
                            <span className="text-slate-400">Aspect Ratio:</span> {meta.aspectRatio}
                          </div>
                          <div>
                            <span className="text-slate-400">Archetype:</span> {meta.sampleArchetype}
                          </div>
                          <div>
                            <span className="text-slate-400">Schedule:</span> {meta.postingSlot}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/5 bg-zinc-950/60 p-2.5 font-mono text-[11px] text-slate-muted">
                        <strong className="text-white">Why this format:</strong> {meta.decisionReason}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="font-mono text-[11px] text-slate-muted">
                    Target: <span className="text-platinum">{meta.algorithmTarget}</span>
                  </span>
                  <Link
                    href={`/series/${config.id}`}
                    className="font-mono text-xs text-white hover:underline"
                  >
                    Series Details →
                  </Link>
                </div>
              </TitaniumCard>
            );
          })}
        </div>
      </section>

      {/* 3. PHOTOGRAPHY & TEXTURE STYLES */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-3">
          <h2 className="font-display text-lg font-bold text-white">Photography & Visual Texture Aesthetics</h2>
          <p className="font-mono text-xs text-slate-muted">
            The 4 visual styles engineered to balance aesthetic authority with the signature alternating checkerboard feed
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PHOTO_STYLES.map((style, idx) => (
            <TitaniumCard key={idx} className="flex flex-col justify-between p-5">
              <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-muted">Style #{idx + 1}</div>
                <h3 className="font-display text-sm font-bold text-white">{style.name}</h3>
                <p className="font-mono text-xs leading-relaxed text-slate-muted">{style.desc}</p>
              </div>

              <div className="mt-4 space-y-1.5 border-t border-white/5 pt-3 font-mono text-[10px] text-slate-muted">
                <div>
                  <span className="text-slate-400">Tone:</span> <span className="text-platinum">{style.tone}</span>
                </div>
                <div>
                  <span className="text-slate-400">Typography:</span> <span className="text-platinum">{style.contrast}</span>
                </div>
                <div>
                  <span className="text-slate-400">Active In:</span> <span className="text-platinum">{style.series}</span>
                </div>
              </div>
            </TitaniumCard>
          ))}
        </div>
      </section>

      {/* 4. FORMAT COMPARISON MATRIX */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-3">
          <h2 className="font-display text-lg font-bold text-white">Format Decision Matrix Table</h2>
          <p className="font-mono text-xs text-slate-muted">Quick reference guide for automated post creation</p>
        </div>

        <TitaniumCard className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-black text-slate-muted">
                <th className="p-3">Format</th>
                <th className="p-3">Aspect Ratio</th>
                <th className="p-3">Optimal Word Count</th>
                <th className="p-3">Primary Algorithm Driver</th>
                <th className="p-3">Checkerboard Alignment</th>
                <th className="p-3">Primary Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-platinum">
              <tr>
                <td className="p-3 font-bold text-amber-300">🎬 Reel</td>
                <td className="p-3">9:16 Vertical</td>
                <td className="p-3">&lt;18 words (1–2 lines)</td>
                <td className="p-3">6.5s Watch Completion Rate</td>
                <td className="p-3">Dark & Light Reel Covers</td>
                <td className="p-3 text-slate-muted">Explore / Viral Reach</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-blue-300">📑 Carousel</td>
                <td className="p-3">4:5 Portrait</td>
                <td className="p-3">30–60 words across 3–5 slides</td>
                <td className="p-3">Saves, Shares & Slide 2 Re-serves</td>
                <td className="p-3">Cover slide follows slot mode</td>
                <td className="p-3 text-slate-muted">Deep Engagement & Saves</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-emerald-300">🖼️ Single Card</td>
                <td className="p-3">4:5 / 1:1</td>
                <td className="p-3">15–35 words (1 statement)</td>
                <td className="p-3">Instant Feed Likes & Comments</td>
                <td className="p-3">Alternates Dark (AM) / Light (PM)</td>
                <td className="p-3 text-slate-muted">Grid Aesthetics & Brand Anchor</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-purple-300">📱 Story</td>
                <td className="p-3">9:16 Vertical</td>
                <td className="p-3">Quote + Interactive Question</td>
                <td className="p-3">Sticker Taps & DM Replies</td>
                <td className="p-3">24-hour ephemeral format</td>
                <td className="p-3 text-slate-muted">Follower DM Conversion</td>
              </tr>
            </tbody>
          </table>
        </TitaniumCard>
      </section>
    </div>
  );
}

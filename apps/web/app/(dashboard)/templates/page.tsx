"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, TitaniumCard } from "@/components/ui";

interface TemplateMeta {
  id: string;
  name: string;
  categories: readonly string[];
}

const TEMPLATE_METADATA: readonly TemplateMeta[] = [
  { id: "bold-modern", name: "Bold / Modern", categories: ["motivational", "inspiration", "productivity"] },
  { id: "editorial-elegant", name: "Editorial / Elegant", categories: ["stoic", "creativity"] },
  { id: "soft-curvy", name: "Soft / Curvy", categories: ["humor"] },
  { id: "authentic-personal", name: "Authentic / Personal", categories: ["love", "self-improvement"] },
  { id: "corporate-clean", name: "Corporate / Clean", categories: ["business", "entrepreneurship"] },
  { id: "classic-wisdom", name: "Classic / Wisdom", categories: ["wisdom", "mindset"] },
  { id: "calm-mindful", name: "Calm / Mindful", categories: ["mindfulness", "positive-thinking"] },
  { id: "bold-resilience", name: "Bold / Resilience", categories: ["resilience", "discipline"] },
  { id: "general-poppins", name: "General / Poppins", categories: [] },
  { id: "general-cormorant", name: "General / Cormorant", categories: [] },
];

const PRESETS = [
  {
    label: "⚡ Paradox Hook",
    quote: "Your morning routine is just expensive procrastination.",
    author: "Discipline Protocol",
  },
  {
    label: "🏛️ Stoic Reflection",
    quote: "I spent three years waiting for confidence before I realized action creates it.",
    author: "Marcus Aurelius",
  },
  {
    label: "📘 3-Step Protocol",
    quote: "1. Define the non-negotiable target\n2. Eliminate all reactive inputs\n3. Execute in 90-min blocks",
    author: "The 3-3-3 System",
  },
  {
    label: "🔥 Villain Roast",
    quote: "Your screen time report is basically a work of fiction at this point.",
    author: "Accountability Partner",
  },
];

const SIGNATURE_ARCHETYPES = [
  {
    id: "bold-modern",
    name: "01. Bold Liquid Titanium",
    tagline: "The Viral Paradox Hook & Single Truth Bomb",
    fontPairing: "Montserrat Bold + Merriweather",
    bestFor: "Hook Lab, High-CTR Reels covers, Punchy 1-liners",
    description:
      "Ultra-clean geometric sans-serif that delivers immediate cognitive contrast on fast-scrolling mobile feeds. Best suited for high-stakes paradox hooks and controversial statements.",
    recommendedSlot: "11:00 AM (Dark Obsidian)",
    seriesMapping: "Hook Lab, Mindset Quotes",
  },
  {
    id: "editorial-elegant",
    name: "02. Editorial Bodoni Elegance",
    tagline: "The High-Status Stoic & Confession Card",
    fontPairing: "Bodoni Moda Bold + Raleway",
    bestFor: "Confession Cards, Stoic Philosophy, High-Trust Wisdom",
    description:
      "High-contrast luxury serif with razor-thin horizontal serifs and thick vertical stems. Gives personal reflections and vulnerable confessions the aesthetic authority of a printed magazine.",
    recommendedSlot: "7:00 PM (Light Alabaster) or 11:00 AM",
    seriesMapping: "Confession Cards, Season Reset",
  },
  {
    id: "classic-wisdom",
    name: "03. Tactical Framework & Classical Playfair",
    tagline: "The High-Save Educational System",
    fontPairing: "Playfair Display Bold + Lora",
    bestFor: "Mindset Manual, Multi-Slide Carousels, Action Protocols",
    description:
      "Timeless editorial serif designed for high-density bookmarkable reference material. Structured with balanced letterforms that make multi-step frameworks feel established and reliable.",
    recommendedSlot: "Alternating (Wed AM / Sun PM)",
    seriesMapping: "Mindset Manual, Multi-Step Systems",
  },
  {
    id: "bold-resilience",
    name: "04. Heavy Condensed Street Callout",
    tagline: "The High-Share Villain Roast & Challenge",
    fontPairing: "Anton Regular + Roboto",
    bestFor: "Villain Roasts, DM-Share Challenges, Relatable Humor",
    description:
      "Aggressive tall condensed display typography that punches through the screen. Engineered for high-velocity DM forwarding ('Bro this is literally you') and instant group chat sharing.",
    recommendedSlot: "Thursday 7:00 PM (Dark Mode)",
    seriesMapping: "Villain Roasts, Fill the Blank",
  },
];

export default function TemplatesPage() {
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [quote, setQuote] = useState(PRESETS[0]!.quote);
  const [author, setAuthor] = useState(PRESETS[0]!.author);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Template Design Studio"
        subtitle="Review, calibrate, and finalize reusable template archetypes across Dark and Light contrast modes."
      />

      {/* Top Controls & Interactive Tester Bar */}
      <div className="rounded-2xl border border-titanium-border bg-titanium-card/95 p-6 backdrop-blur-md">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-cyan-400">
              Interactive Design Studio
            </span>
            <h2 className="mt-2 text-xl font-bold text-white">Live Template Calibrator & Previewer</h2>
            <p className="mt-1 text-xs text-slate-muted">
              Test typography, card padding, and optical balance in real-time across both feed contrast modes.
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-300">Slot Contrast Mode:</span>
            <div className="inline-flex rounded-lg border border-titanium-border bg-black/40 p-1">
              <button
                type="button"
                onClick={() => setMode("dark")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  mode === "dark"
                    ? "bg-slate-800 text-white shadow-sm ring-1 ring-white/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>🌑 Dark (11:00 AM)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("light")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  mode === "light"
                    ? "bg-amber-100 text-slate-900 shadow-sm ring-1 ring-amber-300"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>☀️ Light (7:00 PM)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Preset Buttons & Custom Quote Input */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex flex-wrap items-center gap-2 lg:col-span-12">
            <span className="text-xs font-medium text-slate-400">Quick Presets:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setQuote(preset.quote);
                  setAuthor(preset.author);
                }}
                className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                  quote === preset.quote
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                    : "border-titanium-border bg-slate-900/50 text-slate-300 hover:border-slate-500"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="lg:col-span-8">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Card Content / Quote Text
            </label>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-titanium-border bg-slate-950/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              placeholder="Enter custom hook or quote..."
            />
          </div>

          <div className="lg:col-span-4">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Author / Series Attribution
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-titanium-border bg-slate-950/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              placeholder="Attribution line..."
            />
          </div>
        </div>
      </div>

      {/* 4 PRIMARY REUSABLE TEMPLATES SECTION */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-cyan-400">✦</span>
              <h2 className="text-xl font-extrabold tracking-tight text-white">
                The 4 Core Signature Reusable Templates
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-muted">
              Engineered to cover all 6 series, single cards, 5-slide carousels, and the alternating checkerboard feed.
            </p>
          </div>
          <Link
            href="/formats"
            className="hidden rounded-lg border border-titanium-border bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white sm:inline-block"
          >
            Open Formats Studio ➔
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {SIGNATURE_ARCHETYPES.map((arch) => {
            const previewUrl = `/api/preview?template=${arch.id}&mode=${mode}&quote=${encodeURIComponent(
              quote,
            )}&author=${encodeURIComponent(author)}`;

            return (
              <TitaniumCard
                key={arch.id}
                className="flex flex-col overflow-hidden border-cyan-500/20 bg-slate-950/90 shadow-xl"
              >
                {/* Image Preview Container */}
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-900">
                  <img
                    src={previewUrl}
                    alt={arch.name}
                    width={400}
                    height={500}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                    loading="lazy"
                  />
                  <div className="absolute right-3 top-3">
                    <span className="rounded-md border border-black/40 bg-black/75 px-2 py-0.5 font-mono text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">
                      {mode.toUpperCase()} MODE
                    </span>
                  </div>
                </div>

                {/* Card Breakdown & Metadata */}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-mono text-sm font-bold text-white">{arch.name}</h3>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-cyan-400">{arch.tagline}</p>

                  <div className="mt-3 flex flex-col gap-1.5 border-t border-slate-800/80 pt-3 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Typography:</span>
                      <span className="font-mono font-medium text-slate-200">{arch.fontPairing}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Best For:</span>
                      <span className="text-slate-300">{arch.seriesMapping}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Slot Fit:</span>
                      <span className="font-mono text-amber-300">{arch.recommendedSlot}</span>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{arch.description}</p>
                </div>
              </TitaniumCard>
            );
          })}
        </div>
      </div>

      {/* FULL 10-TEMPLATE REPOSITORY */}
      <div className="border-t border-titanium-border pt-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Full Category Template Catalog</h3>
            <p className="mt-0.5 text-xs text-slate-muted">
              Complete catalog of all 10 code-defined typography pairings in packages/core.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {TEMPLATE_METADATA.map((template) => {
            const previewUrl = `/api/preview?template=${template.id}&mode=${mode}&quote=${encodeURIComponent(
              quote,
            )}&author=${encodeURIComponent(author)}`;

            return (
              <TitaniumCard key={template.id} className="overflow-hidden bg-slate-950/70">
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-900">
                  <img
                    src={previewUrl}
                    alt={template.name}
                    width={300}
                    height={375}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <p className="font-mono text-xs font-bold text-white truncate">{template.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-muted">
                    {template.categories.length > 0 ? template.categories.join(" · ") : "general"}
                  </p>
                </div>
              </TitaniumCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}


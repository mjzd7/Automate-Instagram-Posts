import Link from "next/link";
import { TEMPLATE_METADATA } from "core/src/images/template-metadata";
import { PageHeader, TitaniumCard } from "@/components/ui";
import { explainBackgroundChoice, type BackgroundExplanation } from "@/lib/background-match";

const DEFAULT_QUOTE = "The best time to plant a tree was twenty years ago. The second best time is now.";
const DEFAULT_AUTHOR = "Chinese Proverb";

const inputClass =
  "w-full rounded-lg border border-white/15 bg-black px-3.5 py-2.5 font-mono text-sm text-white outline-none transition-colors duration-200 ease-brand focus:border-white focus-visible:ring-2 focus-visible:ring-white/60";
const labelClass = "mb-1 block font-mono text-[11px] uppercase tracking-wider text-slate-muted";

function WhyPanel({
  explanation,
  shuffleHref,
}: {
  explanation: BackgroundExplanation | null;
  shuffleHref: string | null;
}) {
  if (!explanation) {
    return (
      <TitaniumCard className="p-6 font-mono text-xs text-slate-muted">
        Background explanation unavailable for this render.
      </TitaniumCard>
    );
  }
  if (explanation.error || !explanation.chosen) {
    return (
      <TitaniumCard className="p-6 font-mono text-xs text-slate-muted">
        No background chosen: {explanation.error ?? "unknown reason"}
      </TitaniumCard>
    );
  }
  const { chosen, similarity, matched, embeddingProvider, candidateCount, runnersUp } = explanation;
  return (
    <TitaniumCard className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wider text-slate-muted">Why this background</p>
        {shuffleHref && (
          <Link
            href={shuffleHref}
            className="rounded-lg border border-white/15 px-3 py-1.5 font-mono text-xs text-white transition-colors duration-200 ease-brand hover:bg-white/10"
          >
            ⟳ Shuffle background
          </Link>
        )}
      </div>
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote provider URL, no next/image optimization wanted */}
        <img
          src={chosen.sourceUrl}
          alt={chosen.description}
          className="h-40 w-32 flex-shrink-0 rounded-md border border-white/10 object-cover"
        />
        <div className="flex flex-col gap-1 font-mono text-xs text-platinum">
          <span className="text-white">
            {matched
              ? `Ranked #1 of ${candidateCount} by embedding similarity (${(similarity ?? 0).toFixed(2)}, ${embeddingProvider ?? "unknown provider"})`
              : `Random fallback from ${candidateCount} candidates — embeddings unavailable`}
          </span>
          <span>
            source: <span className="text-white">{chosen.source ?? "unknown"}</span> · darkness:{" "}
            <span className="text-white">{chosen.darkness}</span>
          </span>
          <span className="text-slate-muted">description: “{chosen.description}”</span>
        </div>
      </div>
      {runnersUp.length > 0 && (
        <div className="flex flex-col gap-1 font-mono text-xs text-slate-muted">
          <span className="uppercase tracking-wider">Runner-ups</span>
          {runnersUp.map((r, i) => (
            <span key={i}>
              #{i + 2} ({r.similarity.toFixed(2)}) {r.source ?? "unknown"} — “{r.description}”
            </span>
          ))}
        </div>
      )}
    </TitaniumCard>
  );
}

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; mode?: string; quote?: string; author?: string; exclude?: string }>;
}) {
  const params = await searchParams;
  const template = params.template ?? TEMPLATE_METADATA[0]!.id;
  const mode = params.mode === "light" ? "light" : "dark";
  const quote = params.quote ?? DEFAULT_QUOTE;
  const author = params.author ?? DEFAULT_AUTHOR;
  const excludeUrls = (params.exclude ?? "").split("|").filter(Boolean);

  const explanation = await explainBackgroundChoice(quote, mode, "general", excludeUrls).catch(() => null);
  const chosenUrl = explanation?.chosen?.sourceUrl ?? null;

  const previewParams = new URLSearchParams({
    template,
    mode,
    quote,
    ...(author ? { author } : {}),
  });
  if (chosenUrl) previewParams.set("background-url", chosenUrl);
  const previewSrc = `/api/preview?${previewParams.toString()}`;

  // Shuffle: re-run selection with every background shown so far excluded
  const baseParams = new URLSearchParams({ template, mode, quote, ...(author ? { author } : {}) });
  const shuffleExcludes = [...excludeUrls, ...(chosenUrl ? [chosenUrl] : [])];
  const shuffleHref = chosenUrl
    ? `/preview?${new URLSearchParams({ ...Object.fromEntries(baseParams), exclude: shuffleExcludes.join("|") }).toString()}`
    : null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <form method="get" data-testid="preview-form" className="flex w-full flex-col gap-3 sm:max-w-xs">
        <PageHeader title="Preview" subtitle="Render through the pipeline compositor" />
        <TitaniumCard className="mt-2 flex flex-col gap-3 p-6">
          <div>
            <label htmlFor="preview-template" className={labelClass}>Template</label>
            <select id="preview-template" name="template" defaultValue={template} className={inputClass}>
              {TEMPLATE_METADATA.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="preview-mode" className={labelClass}>Mode</label>
            <select id="preview-mode" name="mode" defaultValue={mode} className={inputClass}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div>
            <label htmlFor="preview-quote" className={labelClass}>Quote</label>
            <textarea id="preview-quote" name="quote" defaultValue={quote} rows={4} className={inputClass} />
          </div>
          <div>
            <label htmlFor="preview-author" className={labelClass}>Author (optional)</label>
            <input id="preview-author" name="author" defaultValue={author} className={inputClass} />
          </div>
          <button
            type="submit"
            className="mt-2 w-fit rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors duration-200 ease-brand outline-none hover:bg-platinum focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Render
          </button>
        </TitaniumCard>
      </form>

      <div className="flex flex-1 flex-col gap-4">
        <TitaniumCard className="flex items-center justify-center overflow-hidden p-4">
          <img src={previewSrc} alt="Preview" className="aspect-[4/5] w-full max-w-sm object-cover" />
        </TitaniumCard>
        <WhyPanel explanation={explanation} shuffleHref={shuffleHref} />
      </div>
    </div>
  );
}

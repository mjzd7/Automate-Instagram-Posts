import { TEMPLATE_METADATA } from "core/src/images/template-metadata";
import { PageHeader, TitaniumCard } from "@/components/ui";

const DEFAULT_QUOTE = "The best time to plant a tree was twenty years ago. The second best time is now.";
const DEFAULT_AUTHOR = "Chinese Proverb";

const inputClass =
  "w-full rounded-lg border border-white/15 bg-black px-3.5 py-2.5 font-mono text-sm text-white outline-none transition-colors duration-200 ease-brand focus:border-white focus-visible:ring-2 focus-visible:ring-white/60";
const labelClass = "mb-1 block font-mono text-[11px] uppercase tracking-wider text-slate-muted";

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; mode?: string; quote?: string; author?: string }>;
}) {
  const params = await searchParams;
  const template = params.template ?? TEMPLATE_METADATA[0]!.id;
  const mode = params.mode === "light" ? "light" : "dark";
  const quote = params.quote ?? DEFAULT_QUOTE;
  const author = params.author ?? DEFAULT_AUTHOR;

  const previewSrc = `/api/preview?template=${encodeURIComponent(template)}&mode=${mode}&quote=${encodeURIComponent(quote)}&author=${encodeURIComponent(author)}`;

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

      <TitaniumCard className="flex flex-1 items-center justify-center overflow-hidden p-4">
        <img src={previewSrc} alt="Preview" className="aspect-[4/5] w-full max-w-sm object-cover" />
      </TitaniumCard>
    </div>
  );
}

import { TEMPLATE_METADATA } from "core/src/images/template-metadata";

const DEFAULT_QUOTE = "The best time to plant a tree was twenty years ago. The second best time is now.";
const DEFAULT_AUTHOR = "Chinese Proverb";

const inputClass =
  "w-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-primary outline-none focus:border-primary";
const labelClass = "mb-1 block text-xs font-medium text-text-secondary";

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
    <div className="mx-auto flex max-w-4xl flex-col gap-6 sm:flex-row">
      <form
        method="get"
        className="shadow-elevated flex w-full flex-col gap-3 rounded-control border border-white/10 bg-surface p-6 sm:max-w-xs"
      >
        <h1 className="font-display mb-2 text-2xl font-light">Preview</h1>

        <div>
          <label className={labelClass}>Template</label>
          <select name="template" defaultValue={template} className={inputClass}>
            {TEMPLATE_METADATA.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Mode</label>
          <select name="mode" defaultValue={mode} className={inputClass}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Quote</label>
          <textarea name="quote" defaultValue={quote} rows={4} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Author (optional)</label>
          <input name="author" defaultValue={author} className={inputClass} />
        </div>

        <button
          type="submit"
          className="mt-2 w-fit rounded-control bg-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 ease-brand hover:bg-primary/90"
        >
          Render
        </button>
      </form>

      <div className="shadow-elevated flex flex-1 items-center justify-center overflow-hidden rounded-control border border-white/10 bg-surface p-4">
        <img src={previewSrc} alt="Preview" className="aspect-[4/5] w-full max-w-sm object-cover" />
      </div>
    </div>
  );
}

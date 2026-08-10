import { TEMPLATE_METADATA } from "core/src/images/template-metadata";

const SAMPLE_QUOTE = "The best time to plant a tree was twenty years ago. The second best time is now.";
const SAMPLE_AUTHOR = "Chinese Proverb";

export default function TemplatesPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="font-display text-3xl font-light">Templates</h1>
      <p className="text-sm text-text-secondary">
        Read-only -- templates are defined in code (packages/core/src/images/templates.ts) alongside their bundled
        font files, not in a JSON config file. Rendered here with a fixed sample quote for comparison; use Preview
        to try your own text and mode.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATE_METADATA.map((template) => (
          <div
            key={template.id}
            className="shadow-elevated overflow-hidden rounded-control border border-white/10 bg-surface"
          >
            <img
              src={`/api/preview?template=${template.id}&mode=dark&quote=${encodeURIComponent(SAMPLE_QUOTE)}&author=${encodeURIComponent(SAMPLE_AUTHOR)}`}
              alt={template.name}
              width={360}
              height={450}
              className="aspect-[4/5] w-full object-cover"
            />
            <div className="p-4">
              <p className="text-sm font-medium text-text-primary">{template.name}</p>
              <p className="mt-1 text-xs text-text-secondary">
                {template.categories.length > 0 ? template.categories.join(", ") : "general"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

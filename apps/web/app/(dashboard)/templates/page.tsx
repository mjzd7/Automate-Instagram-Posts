import { TEMPLATE_METADATA } from "core/src/images/template-metadata";
import { EmptyState, PageHeader, TitaniumCard } from "@/components/ui";

const SAMPLE_QUOTE = "The best time to plant a tree was twenty years ago. The second best time is now.";
const SAMPLE_AUTHOR = "Chinese Proverb";

export default async function TemplatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Templates"
        subtitle="Read-only — templates are code-defined in packages/core with bundled fonts; rendered here with a fixed sample quote."
      />

      {TEMPLATE_METADATA.length === 0 ? (
        <EmptyState message="No templates defined." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="template-grid">
          {TEMPLATE_METADATA.map((template) => (
            <TitaniumCard key={template.id} className="overflow-hidden">
              <img
                src={`/api/preview?template=${template.id}&mode=dark&quote=${encodeURIComponent(SAMPLE_QUOTE)}&author=${encodeURIComponent(SAMPLE_AUTHOR)}`}
                alt={template.name}
                width={360}
                height={450}
                className="aspect-[4/5] w-full object-cover"
                loading="lazy"
              />
              <div className="p-4">
                <p className="font-mono text-sm font-bold text-white">{template.name}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-slate-muted">
                  {template.categories.length > 0 ? template.categories.join(" · ") : "general"}
                </p>
              </div>
            </TitaniumCard>
          ))}
        </div>
      )}
    </div>
  );
}

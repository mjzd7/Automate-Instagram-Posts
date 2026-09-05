import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader, TitaniumCard } from "@/components/ui";
import { getDbHandle } from "@/lib/db";
import { loadPackItems, loadSeriesConfig, type PackItem } from "@/lib/series-files";
import { getPublishedEpisodesAsc, getSeriesState } from "core/src/db/repositories/series.repo";

const STATUS_CHIP: Record<string, string> = {
  approved: "bg-white text-black",
  draft: "border border-white/15 text-slate-muted",
};

export default async function SeriesDetailPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  const allSeries = await loadSeriesConfig();
  const config = allSeries.find((s) => s.id === seriesId);
  if (!config) notFound();

  const items = await loadPackItems(seriesId);
  const templateId = config.templateIds[0] ?? "glass-card";

  const { db, close } = await getDbHandle();
  let counter = 0;
  let lastPostedAt: string | null = null;
  let episodes: Awaited<ReturnType<typeof getPublishedEpisodesAsc>>;
  try {
    const state = await getSeriesState(db, seriesId);
    counter = state?.counter ?? 0;
    lastPostedAt = state?.lastPostedAt ?? null;
    episodes = await getPublishedEpisodesAsc(db, seriesId);
  } finally {
    close();
  }

  // Newest first; episode numbers are the tail of the published sequence
  // (counter burns only on approved+published), so newest post = #counter.
  const recentEpisodes = episodes.slice(-8).reverse();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={config.name}
        subtitle={`#${counter} published · slots/wk ${config.slots.length} · templates ${config.templateIds.join(", ")}`}
      />
      <Link href="/series" className="font-mono text-xs text-slate-muted hover:text-white">
        ← back to roster
      </Link>

      <TitaniumCard className="p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-slate-muted">Recent episodes</h2>
        {recentEpisodes.length === 0 ? (
          <p className="mt-2 font-mono text-xs text-slate-muted">
            No published episodes yet — counter sits at #{counter}. Last posted: {lastPostedAt ?? "never"}.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5 font-mono text-xs">
            {recentEpisodes.map((ep, offset) => {
              const episodeNo = counter - offset;
              return (
                <li key={ep.id} className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="text-white">#{episodeNo}</span>
                  <span className="text-slate-muted">{ep.publishedAt ?? "?"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </TitaniumCard>

      <section aria-label="Content pack">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-slate-muted">
          Content pack — {items.filter((i) => i.status === "approved").length} approved /{" "}
          {items.filter((i) => i.status === "draft").length} draft
        </h2>
        {items.length === 0 ? (
          <EmptyState message={`No pack items found for ${config.name} in recent months.`} />
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <PackCard key={item.id} item={item} templateId={templateId} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PackCard({ item, templateId }: { item: PackItem; templateId: string }) {
  const previewUrl = `/api/media/dry-run/${encodeURIComponent(item.id)}.jpg`;
  return (
    <figure className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={`Preview card for ${item.id}`}
        loading="lazy"
        width={216}
        height={270}
        className="aspect-[4/5] w-full rounded-lg object-cover"
      />
      <span className={`self-start rounded-md px-2 py-0.5 font-mono text-[10px] ${STATUS_CHIP[item.status] ?? ""}`}>
        {item.status}
      </span>
      <blockquote className="line-clamp-3 text-xs leading-snug text-white">{item.text}</blockquote>
      <figcaption className="font-mono text-[10px] text-slate-muted">
        {item.id}
        {item.archetype ? ` · ${item.archetype}` : ""}
      </figcaption>
    </figure>
  );
}

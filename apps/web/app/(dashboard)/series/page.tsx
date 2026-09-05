import Link from "next/link";
import { EmptyState, PageHeader, TitaniumCard } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { getDbHandle } from "@/lib/db";
import { loadPackItems, loadSeriesConfig } from "@/lib/series-files";
import { toggleSeriesActive } from "@/lib/actions/series";
import { getAllSeriesRows, getPublishedSignalsBySeries } from "core/src/db/repositories/series.repo";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export default async function SeriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const params = await searchParams;
  const config = await loadSeriesConfig();

  const { db, close } = await getDbHandle();
  let seriesRows: Awaited<ReturnType<typeof getAllSeriesRows>>;
  let publishedBySeries: Map<string, { count: number; views: number }>;
  try {
    seriesRows = await getAllSeriesRows(db);
    publishedBySeries = await getPublishedSignalsBySeries(db);
  } finally {
    close();
  }

  const packHealth = new Map<string, { approved: number; draft: number }>();
  await Promise.all(
    config.map(async (s) => {
      const items = await loadPackItems(s.id);
      packHealth.set(s.id, {
        approved: items.filter((i) => i.status === "approved").length,
        draft: items.filter((i) => i.status === "draft").length,
      });
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Series" subtitle="Content series roster — cadence, episode counters, pack supply, and pause controls" />
      {params.error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 font-mono text-sm text-red-400">{params.error}</div>}
      {params.done && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 font-mono text-sm text-emerald-400">{params.done}</div>}

      {config.length === 0 ? (
        <EmptyState message="No series defined in data/series.json yet." />
      ) : (
        <>
          <p className="font-mono text-[11px] text-slate-muted">
            counters &amp; signals read the git-committed app.db — as of last pipeline push, not live
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {config.map((s) => {
              const row = seriesRows.find((r) => r.id === s.id);
              const health = packHealth.get(s.id) ?? { approved: 0, draft: 0 };
              const signal = publishedBySeries.get(s.id) ?? { count: 0, views: 0 };
              return (
                <TitaniumCard key={s.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/series/${s.id}`} className="text-lg font-medium text-white hover:underline">
                        {s.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-slate-muted">
                        {s.templateIds.join(" · ")}
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 font-mono text-[11px] ${
                        s.active ? "bg-white text-black" : "border border-white/15 text-slate-muted"
                      }`}
                    >
                      {s.active ? "active" : "paused"}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-3 font-mono text-sm">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-slate-muted">Counter</dt>
                      <dd className="text-white">#{row?.counter ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-slate-muted">Published</dt>
                      <dd className="text-white">{signal.count}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-slate-muted">Views</dt>
                      <dd className="text-white">{signal.views.toLocaleString()}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex items-center gap-4 font-mono text-[11px]">
                    <span className="text-slate-muted">pack:</span>
                    <span className="text-emerald-400">{health.approved} approved</span>
                    <span className="text-slate-muted">{health.draft} draft</span>
                  </div>

                  <div className="mt-4 grid grid-cols-7 gap-1" aria-label={`Weekly cadence for ${s.name}`}>
                    {DAY_LABELS.map((label, dow) => {
                      const am = s.slots.some((slot) => slot.dayOfWeek === dow && slot.slot === "am");
                      const pm = s.slots.some((slot) => slot.dayOfWeek === dow && slot.slot === "pm");
                      return (
                        <div key={label} className="rounded-md border border-white/10 p-1.5 text-center font-mono text-[10px]">
                          <p className="text-slate-muted">{label}</p>
                          <p className={am ? "text-white" : "text-white/15"}>AM</p>
                          <p className={pm ? "text-white" : "text-white/15"}>PM</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-muted">
                      last posted {row?.lastPostedAt ?? "never"}
                    </span>
                    {s.active ? (
                      <details className="relative">
                        <summary className="cursor-pointer list-none rounded-lg border border-white/15 px-3 py-1.5 font-mono text-xs text-slate-muted transition-colors duration-200 ease-brand hover:border-white hover:text-white">
                          Pause
                        </summary>
                        <form action={toggleSeriesActive} className="mt-2 rounded-lg border border-red-500/30 bg-black p-3">
                          <input type="hidden" name="seriesId" value={s.id} />
                          <input type="hidden" name="nextActive" value="false" />
                          <p className="mb-2 max-w-[16rem] text-xs text-slate-muted">
                            The scheduler stops filling this series' slots from the next run.
                          </p>
                          <SubmitButton pendingLabel="Pausing…">Confirm pause</SubmitButton>
                        </form>
                      </details>
                    ) : (
                      <form action={toggleSeriesActive}>
                        <input type="hidden" name="seriesId" value={s.id} />
                        <input type="hidden" name="nextActive" value="true" />
                        <SubmitButton pendingLabel="Resuming…">Resume</SubmitButton>
                      </form>
                    )}
                  </div>
                </TitaniumCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

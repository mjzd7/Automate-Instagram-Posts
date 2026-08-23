import { EmptyState, PageHeader, TitaniumCard } from "@/components/ui";
import { buildPipeline } from "@/lib/actions/pipeline";
import { loadPipelineFile } from "@/lib/pipeline-files";
import { getDbHandle } from "@/lib/db";
import { getSetting } from "core/src/db/repositories/settings.repo";
import { parseStatuses, PIPELINE_STATUS_ACCOUNT, statusKey } from "core/src/schedule/status-merge";
import type { PipelineEntry } from "core/src/schedule/generator";
import { SubmitButton } from "@/components/SubmitButton";

function nextMonthIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_CHIP: Record<string, string> = {
  planned: "border border-white/10 text-slate-muted",
  published: "bg-white text-black",
  failed: "border border-red-500/40 text-red-400",
  skipped: "border border-white/10 text-slate-muted line-through",
};

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string }>;
}) {
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? (params.month as string) : nextMonthIso();
  const file = await loadPipelineFile(month);

  // Live statuses recorded by the GHA runner (settings-backed), merged over
  // the planned file so chips reflect execution without JSON write races.
  let liveStatuses: Partial<Record<string, "published" | "failed" | "skipped">> = {};
  if (file) {
    const { db, close: closeDb } = await getDbHandle();
    try {
      liveStatuses = parseStatuses(await getSetting(db, PIPELINE_STATUS_ACCOUNT, statusKey(month)));
    } finally {
      closeDb();
    }
  }

  const byDate = new Map<string, PipelineEntry[]>();
  for (const entry of file?.entries ?? []) {
        const override = liveStatuses[entry.id];
    const effective: PipelineEntry = { ...entry, status: override ?? entry.status };
    const list = byDate.get(effective.date) ?? [];
    list.push(effective);
    byDate.set(entry.date, list);
  }
  const days = [...byDate.keys()].sort();
  const firstDow = days.length > 0 ? new Date(`${days[0]}T00:00:00Z`).getUTCDay() : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pipeline" subtitle={`Composed posting plan for ${month} — binding-lite: the runner executes due planned entries`} />
      {params.error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 font-mono text-sm text-red-400">{params.error}</div>}

      <TitaniumCard className="p-6">
        <form action={buildPipeline} className="flex flex-wrap items-end gap-4" data-testid="pipeline-builder">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-muted">Month (YYYY-MM)</span>
            <input
              name="month"
              defaultValue={month}
              pattern="\d{4}-\d{2}"
              required
              data-testid="pipeline-month"
              className="w-40 rounded-lg border border-white/15 bg-black px-3.5 py-2.5 font-mono text-sm text-white outline-none transition-colors duration-200 ease-brand focus:border-white"
            />
          </label>
          <span data-testid="pipeline-generate">
            <SubmitButton pendingLabel="Building…">
              {file && file.month === month ? "Regenerate month" : "Generate month"}
            </SubmitButton>
          </span>
          <span className="font-mono text-[11px] text-slate-muted">
            Regenerating preserves executed entries; only new slots are added.
          </span>
        </form>
      </TitaniumCard>

      {!file || file.entries.length === 0 ? (
        <EmptyState message={`No pipeline built for ${month}. Pick a month above and generate.`} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="font-mono text-[11px] text-slate-muted" data-testid="pipeline-meta">
            seed {file.seed} · {file.entries.length} entries · generated {new Date(file.generatedAt).toISOString()}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7" data-testid="pipeline-calendar">
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`pad-${i}`} aria-hidden />
            ))}
            {days.map((date) => (
              <div key={date} data-date={date} className="rounded-xl border border-white/10 bg-black p-3">
                <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-slate-muted">{date.slice(8)}</p>
                <div className="flex flex-col gap-1.5">
                  {(byDate.get(date) ?? [])
                    .slice()
                    .sort((a, b) => a.hour - b.hour)
                    .map((entry) => (
                      <span key={entry.id} className={`inline-flex items-center justify-between rounded-md px-2 py-1 font-mono text-[11px] ${STATUS_CHIP[entry.status] ?? ""}`}>
                        <span>{entry.accountId}</span>
                        <span>{String(entry.hour).padStart(2, "0")}:00</span>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

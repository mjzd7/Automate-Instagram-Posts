import { Banner, PageHeader, TitaniumCard } from "@/components/ui";
import { getAccounts } from "@/lib/db";
import { saveSchedule } from "@/lib/actions/schedules";
import { SaveScheduleButton } from "@/components/SaveScheduleButton";

export default async function SchedulesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [accounts, { error }] = await Promise.all([getAccounts(), searchParams]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Schedules" subtitle="Per-account posting hours, caps, blackouts — written to data/accounts.json" />
      {error && <Banner variant="error">{error}</Banner>}
      {accounts.length === 0 && <TitaniumCard className="p-5">No accounts yet.</TitaniumCard>}
      {accounts.map((account) => (
        <TitaniumCard key={account.id} className="p-6">
          <form action={saveSchedule} className="flex flex-col gap-4">
            <input type="hidden" name="accountId" value={account.id} />
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-white">{account.id}</h2>
              {account.paused && (
                <span className="rounded-md bg-amber-live/15 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-amber-live">
                  paused
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-muted">Timezone (IANA)</span>
                <input
                  name="timezone"
                  defaultValue={account.timezone}
                  required
                  data-testid={`${account.id}-timezone`}
                  className="w-full rounded-lg border border-white/15 bg-black px-3.5 py-2.5 font-mono text-sm text-white outline-none transition-colors duration-200 ease-brand focus:border-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-muted">Hours (csv 0-23)</span>
                <input
                  name="postingHoursLocal"
                  defaultValue={account.postingHoursLocal.join(", ")}
                  required
                  data-testid={`${account.id}-hours`}
                  className="w-full rounded-lg border border-white/15 bg-black px-3.5 py-2.5 font-mono text-sm text-white outline-none transition-colors duration-200 ease-brand focus:border-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-muted">Daily cap</span>
                <input
                  name="dailyCap"
                  type="number"
                  min={0}
                  max={22}
                  defaultValue={account.dailyCap ?? ""}
                  placeholder="all hours"
                  data-testid={`${account.id}-cap`}
                  className="w-full rounded-lg border border-white/15 bg-black px-3.5 py-2.5 font-mono text-sm text-white outline-none transition-colors duration-200 ease-brand focus:border-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-muted">Blackout dates (csv YYYY-MM-DD)</span>
                <input
                  name="blackoutDates"
                  defaultValue={(account.blackoutDates ?? []).join(", ")}
                  data-testid={`${account.id}-blackouts`}
                  className="w-full rounded-lg border border-white/15 bg-black px-3.5 py-2.5 font-mono text-sm text-white outline-none transition-colors duration-200 ease-brand focus:border-white"
                />
              </label>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-mono text-xs text-platinum">
                <input type="checkbox" name="paused" defaultChecked={account.paused ?? false} data-testid={`${account.id}-paused`} />
                Pause this account
              </label>
              <SaveScheduleButton accountId={account.id} />
            </div>
          </form>
        </TitaniumCard>
      ))}
    </div>
  );
}

/**
 * IANA-wall-time ↔ UTC conversion used by the pipeline generator and the GHA
 * runner. Manual UTC-offset arithmetic is banned project-wide (DST rule):
 * every conversion goes through Intl.DateTimeFormat with the account's zone.
 */

export interface WallTimeResolution {
  instant: Date;
  /** False when the wall time is skipped by a spring-forward transition. */
  exists: boolean;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    partsCache.set(timeZone, fmt);
  }
  return fmt;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Offset (ms) of `timeZone` at the given instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

/**
 * Resolves local wall time (YYYY-MM-DD, hour 0-23) in `timeZone` to a UTC
 * instant. Returns exists=false for hours a spring-forward transition skips.
 * Ambiguous fall-back hours resolve to the EARLIER occurrence (deterministic
 * single-scheduling rule).
 */
export function resolveWallTime(dateIso: string, hour: number, timeZone: string): WallTimeResolution {
  const naive = Date.parse(`${dateIso}T${String(hour).padStart(2, "0")}:00:00Z`);
  // Sample offsets +/-26h around the naive instant: they bracket every civil
  // transition (largest real shift is 2h). Each sampled offset yields one
  // candidate; it is valid iff converting that instant back reproduces the
  // exact wall time. Zero valid -> spring-forward gap. Two valid (overlap)
  // -> the earlier instant is the first occurrence.
  const offsets = [...new Set([zoneOffsetMs(new Date(naive - 26 * 3600_000), timeZone), zoneOffsetMs(new Date(naive + 26 * 3600_000), timeZone)])];
  let found: Date | null = null;
  for (const offset of offsets) {
    const candidate = new Date(naive - offset);
    if (zoneOffsetMs(candidate, timeZone) !== offset) continue;
    if (localDateIso(candidate, timeZone) !== dateIso) continue;
    if (localHour(candidate, timeZone) !== hour) continue;
    if (found === null || candidate < found) found = candidate;
    else if (candidate > found) break;
  }
  return { instant: found ?? new Date(naive), exists: found !== null };
}

/** Local YYYY-MM-DD calendar date for an instant in `timeZone`. */
export function localDateIso(instant: Date, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Local hour (0-23) for an instant in `timeZone`. */
export function localHour(instant: Date, timeZone: string): number {
  const parts = formatterFor(timeZone).formatToParts(instant);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

/** Number of days in a month (leap-year safe). */
export function daysInMonth(monthIso: string): number {
  const parts = monthIso.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

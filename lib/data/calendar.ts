// NSE capital-market trading calendar. Dates are ISO `YYYY-MM-DD` strings in IST.

/**
 * Weekday trading holidays by year. Update every December from NSE's circular.
 * 2026: NSE/CMTR/71775 (circular 172/2025, 12 Dec 2025).
 */
export const NSE_HOLIDAYS: Readonly<Record<number, readonly string[]>> = {
  2026: [
    "2026-01-26", "2026-03-03", "2026-03-26", "2026-03-31", "2026-04-03",
    "2026-04-14", "2026-05-01", "2026-05-28", "2026-06-26", "2026-09-14",
    "2026-10-02", "2026-10-20", "2026-11-10", "2026-11-24", "2026-12-25",
  ],
};

/** Hour (IST) after which the day's close counts as published. */
const CLOSE_PUBLISHED_HOUR_IST = 18;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const holidaySets = new Map(Object.entries(NSE_HOLIDAYS).map(([y, days]) => [Number(y), new Set(days)]));

export function isTradingDay(date: string): boolean {
  const year = Number(date.slice(0, 4));
  const holidays = holidaySets.get(year);
  if (!holidays) throw new Error(`No NSE holiday table for ${year}; add it to lib/data/calendar.ts`);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !holidays.has(date);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Trading days d with from < d ≤ to. */
export function tradingDaysAfter(from: string, to: string): number {
  let count = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) if (isTradingDay(d)) count++;
  return count;
}

export function istDate(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function istHour(now: Date): number {
  return new Date(now.getTime() + IST_OFFSET_MS).getUTCHours();
}

export function previousTradingDay(date: string): string {
  let d = addDays(date, -1);
  while (!isTradingDay(d)) d = addDays(d, -1);
  return d;
}

/** The latest session whose close is published as of `now`. */
export function lastCompletedSession(now: Date): string {
  const today = istDate(now);
  return isTradingDay(today) && istHour(now) >= CLOSE_PUBLISHED_HOUR_IST ? today : previousTradingDay(today);
}

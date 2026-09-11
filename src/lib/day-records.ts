/**
 * Turns saved rows into the DayRecord shape the analytics/patterns/reset
 * helpers already expect. Pure functions, no network.
 */

import type { DayRecord } from "./analytics";
import { isoToZonedInput } from "./sleep";
import type { DailyCheckin, SleepEntry } from "@/types/db";

export type HistoryLike = {
  date: string;
  sleep: SleepEntry | null;
  checkin: DailyCheckin | null;
  napMinutes: number;
  reasons?: string[];
};

/** Local minutes since midnight for a stored UTC timestamp. */
function localMinutes(iso: string | null | undefined, timezone: string): number | null {
  const local = isoToZonedInput(iso ?? null, timezone);
  if (!local) return null;
  const time = local.slice(11);
  const hours = Number(time.slice(0, 2));
  const minutes = Number(time.slice(3, 5));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function toNoonMinutes(minutesSinceMidnight: number | null): number | null {
  if (minutesSinceMidnight == null) return null;
  return minutesSinceMidnight >= 720 ? minutesSinceMidnight - 720 : minutesSinceMidnight + 720;
}

export function toDayRecord(item: HistoryLike, timezone: string): DayRecord {
  const caffeineMinutes = localMinutes(item.checkin?.caffeine_last_time, timezone);
  return {
    date: item.date,
    totalSleepMinutes: item.sleep?.total_sleep_minutes ?? null,
    napMinutes: item.napMinutes ?? 0,
    sleepQuality: item.sleep?.sleep_quality ?? null,
    bedtimeMinutes: toNoonMinutes(localMinutes(item.sleep?.bedtime, timezone)),
    wakeMinutes: localMinutes(item.sleep?.wake_time, timezone),
    energy: item.checkin?.energy_level ?? null,
    mood: item.checkin?.mood_level ?? null,
    rested: item.checkin?.rested_level ?? null,
    stress: item.checkin?.stress_level ?? null,
    caffeineUsed: item.checkin?.caffeine_used ?? null,
    caffeineLateEvening:
      caffeineMinutes == null ? null : caffeineMinutes >= 16 * 60 || caffeineMinutes < 4 * 60,
    screenBeforeBed: item.checkin?.screen_before_bed ?? null,
    phoneInBed: item.checkin?.phone_in_bed ?? null,
    reasons: item.reasons ?? [],
  };
}

/** Newest-first in, newest-first out. */
export function toDayRecords(items: HistoryLike[], timezone: string): DayRecord[] {
  return items.map((item) => toDayRecord(item, timezone));
}

/**
 * Deterministic sleep analytics helpers. Pure functions only — no React, no AI.
 * All clock values are minutes: bedtime is minutes since noon (so 23:10 -> 670,
 * 00:40 -> 760), wake time is minutes since midnight.
 */

export type DayRecord = {
  date: string;
  totalSleepMinutes: number | null;
  napMinutes: number;
  sleepQuality: number | null;
  bedtimeMinutes: number | null;
  wakeMinutes: number | null;
  energy: number | null;
  mood: number | null;
  rested: number | null;
  stress: number | null;
  caffeineUsed: boolean | null;
  caffeineLateEvening: boolean | null;
  screenBeforeBed: boolean | null;
  phoneInBed: boolean | null;
  reasons: string[];
};

export type RangeKey = "7" | "30" | "90" | "all";

export const RANGE_OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: null },
];

/* ---------- basic maths ---------- */

export function values(days: DayRecord[], pick: (d: DayRecord) => number | null | undefined): number[] {
  const out: number[] = [];
  for (const day of days) {
    const value = pick(day);
    if (typeof value === "number" && Number.isFinite(value)) out.push(value);
  }
  return out;
}

export function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function average(
  days: DayRecord[],
  pick: (d: DayRecord) => number | null | undefined,
): { value: number | null; count: number } {
  const nums = values(days, pick);
  return { value: mean(nums), count: nums.length };
}

export function stdDev(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const m = mean(nums)!;
  const variance = nums.reduce((total, n) => total + (n - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

export function total24(day: DayRecord): number | null {
  if (day.totalSleepMinutes == null) return day.napMinutes > 0 ? day.napMinutes : null;
  return day.totalSleepMinutes + day.napMinutes;
}

/* ---------- clock formatting ---------- */

function toClock(minutesSinceMidnight: number): string {
  const wrapped = ((Math.round(minutesSinceMidnight) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** Bedtime stored as minutes since noon. */
export function formatBedtimeMinutes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return toClock(value + 720);
}

export function formatWakeMinutes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return toClock(value);
}

export function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} / 5`;
}

export function formatMinutesDelta(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${abs} min`;
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/* ---------- consistency ---------- */

export type Consistency = {
  label: "Not enough data" | "Very steady" | "Fairly steady" | "Somewhat varied" | "Quite varied";
  spreadMinutes: number | null;
  count: number;
  sentence: string;
};

export function consistency(
  days: DayRecord[],
  pick: (d: DayRecord) => number | null | undefined,
  noun: string,
): Consistency {
  const nums = values(days, pick);
  const spread = stdDev(nums);
  if (spread == null || nums.length < 3) {
    return {
      label: "Not enough data",
      spreadMinutes: spread,
      count: nums.length,
      sentence: `A few more nights and we can describe how steady your ${noun} has been.`,
    };
  }
  const label: Consistency["label"] =
    spread < 30 ? "Very steady" : spread < 60 ? "Fairly steady" : spread < 90 ? "Somewhat varied" : "Quite varied";

  // Drift: newest-first arrays are normalised to oldest-first before calling.
  const half = Math.floor(nums.length / 2);
  const earlier = mean(nums.slice(0, half));
  const later = mean(nums.slice(nums.length - half));
  let drift = "";
  if (earlier != null && later != null && Math.abs(later - earlier) >= 25) {
    drift = ` It has been shifting ${later > earlier ? "later" : "earlier"} by about ${formatMinutesDelta(later - earlier)}.`;
  }

  return {
    label,
    spreadMinutes: spread,
    count: nums.length,
    sentence: `Your ${noun} has varied by about ${formatMinutesDelta(spread)} across ${nums.length} recorded ${nums.length === 1 ? "night" : "nights"}.${drift}`,
  };
}

/* ---------- sleep balance ---------- */

export type SleepBalance = {
  nights: number;
  goalMinutes: number;
  averageMinutes: number | null;
  averageDiff: number | null;
  totalDiff: number | null;
};

export function sleepBalance(days: DayRecord[], goalMinutes: number): SleepBalance {
  const nums = values(days, total24);
  const avg = mean(nums);
  return {
    nights: nums.length,
    goalMinutes,
    averageMinutes: avg,
    averageDiff: avg == null ? null : avg - goalMinutes,
    totalDiff: nums.length === 0 ? null : nums.reduce((total, n) => total + (n - goalMinutes), 0),
  };
}

/* ---------- period comparison ---------- */

export type MetricChange = {
  key: string;
  label: string;
  format: "duration" | "bedtime" | "waketime" | "score";
  current: number | null;
  previous: number | null;
  delta: number | null;
  sentence: string | null;
};

const CHANGE_METRICS: {
  key: string;
  label: string;
  format: MetricChange["format"];
  pick: (d: DayRecord) => number | null;
  minDelta: number;
}[] = [
  { key: "duration", label: "Sleep at night", format: "duration", pick: (d) => d.totalSleepMinutes, minDelta: 10 },
  { key: "total24", label: "Total sleep with naps", format: "duration", pick: total24, minDelta: 10 },
  { key: "bedtime", label: "Bedtime", format: "bedtime", pick: (d) => d.bedtimeMinutes, minDelta: 10 },
  { key: "waketime", label: "Wake time", format: "waketime", pick: (d) => d.wakeMinutes, minDelta: 10 },
  { key: "quality", label: "Sleep quality", format: "score", pick: (d) => d.sleepQuality, minDelta: 0.3 },
  { key: "energy", label: "Energy", format: "score", pick: (d) => d.energy, minDelta: 0.3 },
  { key: "mood", label: "Mood", format: "score", pick: (d) => d.mood, minDelta: 0.3 },
];

export function comparePeriods(current: DayRecord[], previous: DayRecord[]): MetricChange[] {
  return CHANGE_METRICS.map((metric) => {
    const now = average(current, metric.pick);
    const before = average(previous, metric.pick);
    const delta = now.value != null && before.value != null ? now.value - before.value : null;
    let sentence: string | null = null;
    if (delta != null && now.count >= 2 && before.count >= 2) {
      if (Math.abs(delta) < metric.minDelta) {
        sentence = `${metric.label} stayed about the same.`;
      } else if (metric.format === "duration") {
        sentence = `${metric.label} ${delta > 0 ? "increased" : "decreased"} by ${formatMinutesDelta(delta)}.`;
      } else if (metric.format === "bedtime" || metric.format === "waketime") {
        sentence = `Average ${metric.label.toLowerCase()} moved ${formatMinutesDelta(delta)} ${delta > 0 ? "later" : "earlier"}.`;
      } else {
        sentence = `${metric.label} was ${delta > 0 ? "higher" : "lower"} by ${Math.abs(delta).toFixed(1)} out of 5.`;
      }
    }
    return {
      key: metric.key,
      label: metric.label,
      format: metric.format,
      current: now.value,
      previous: before.value,
      delta,
      sentence,
    };
  });
}

/* ---------- best / harder days ---------- */

export type ScoredDay = {
  date: string;
  score: number;
  parts: string[];
};

export function scoreDay(day: DayRecord, goalMinutes: number): ScoredDay | null {
  const parts: string[] = [];
  let sum = 0;
  let weight = 0;

  const sleep = total24(day);
  if (sleep != null) {
    const ratio = Math.max(0, Math.min(1.15, sleep / goalMinutes));
    sum += Math.min(1, ratio) * 0.4;
    weight += 0.4;
    parts.push(`${formatMinutesDelta(sleep)} of sleep`);
  }
  if (day.sleepQuality != null) {
    sum += ((day.sleepQuality - 1) / 4) * 0.2;
    weight += 0.2;
    parts.push(`quality ${day.sleepQuality}/5`);
  }
  if (day.energy != null) {
    sum += ((day.energy - 1) / 4) * 0.2;
    weight += 0.2;
    parts.push(`energy ${day.energy}/5`);
  }
  if (day.rested != null) {
    sum += ((day.rested - 1) / 4) * 0.2;
    weight += 0.2;
    parts.push(`rested ${day.rested}/5`);
  }

  if (weight < 0.55 || parts.length < 2) return null;
  return { date: day.date, score: sum / weight, parts };
}

export function rankDays(days: DayRecord[], goalMinutes: number): { best: ScoredDay[]; harder: ScoredDay[] } {
  const scored = days
    .map((day) => scoreDay(day, goalMinutes))
    .filter((entry): entry is ScoredDay => entry !== null)
    .sort((a, b) => b.score - a.score);
  if (scored.length < 3) return { best: [], harder: [] };
  return {
    best: scored.slice(0, 2),
    harder: scored.slice(-2).reverse(),
  };
}

/* ---------- range helpers ---------- */

/** Days are stored newest-first; returns newest-first slice within the range. */
export function withinRange(days: DayRecord[], rangeDays: number | null): DayRecord[] {
  if (rangeDays == null) return days;
  const cutoff = Date.now() - rangeDays * 86_400_000;
  return days.filter((day) => Date.parse(`${day.date}T12:00:00Z`) >= cutoff);
}

export function previousRange(days: DayRecord[], rangeDays: number): DayRecord[] {
  const end = Date.now() - rangeDays * 86_400_000;
  const start = end - rangeDays * 86_400_000;
  return days.filter((day) => {
    const time = Date.parse(`${day.date}T12:00:00Z`);
    return time < end && time >= start;
  });
}

export function oldestFirst(days: DayRecord[]): DayRecord[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export type DataStage = "none" | "learning" | "early" | "ready";

export function dataStage(count: number): DataStage {
  if (count === 0) return "none";
  if (count <= 3) return "learning";
  if (count <= 6) return "early";
  return "ready";
}

export const STAGE_COPY: Record<DataStage, { title: string; description: string }> = {
  none: {
    title: "Nothing to look at yet",
    description: "Start logging your sleep and we'll learn your patterns over time.",
  },
  learning: {
    title: "Still learning",
    description: "A few more nights will give us a clearer picture of how your sleep behaves.",
  },
  early: {
    title: "Early signals are starting to appear",
    description: "There's a little to go on now. Around a week of nights makes the trends much steadier.",
  },
  ready: { title: "", description: "" },
};

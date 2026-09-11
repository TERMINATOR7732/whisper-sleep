/**
 * Deterministic pattern engine. No AI, no network. Given day records it reports
 * observed associations with an honest confidence level and sample size.
 */

import {
  average,
  formatMinutesDelta,
  mean,
  total24,
  values,
  type DayRecord,
} from "./analytics";
import { SLEEP_REASONS } from "./sleep";

export type Confidence = "none" | "early" | "moderate" | "strong";

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  none: "Not enough data",
  early: "Early signal",
  moderate: "Moderate pattern",
  strong: "Stronger pattern",
};

export type PatternCategory =
  | "caffeine"
  | "phone_usage"
  | "screens"
  | "naps"
  | "stress"
  | "reasons"
  | "next_day"
  | "weekend";

export type Pattern = {
  id: string;
  category: PatternCategory;
  title: string;
  observation: string;
  stat?: string | undefined;
  observations: number;
  confidence: Confidence;
  from: string | null;
  to: string | null;
};

type Metric = {
  label: string;
  pick: (d: DayRecord) => number | null;
  threshold: number;
  describe: (delta: number) => string;
};

const DURATION: Metric = {
  label: "sleep",
  pick: total24,
  threshold: 20,
  describe: (delta) => `total sleep was usually about ${formatMinutesDelta(delta)} ${delta > 0 ? "longer" : "shorter"}`,
};

const NIGHT_SLEEP: Metric = {
  label: "night sleep",
  pick: (d) => d.totalSleepMinutes,
  threshold: 20,
  describe: (delta) => `night sleep was usually about ${formatMinutesDelta(delta)} ${delta > 0 ? "longer" : "shorter"}`,
};

const QUALITY: Metric = {
  label: "quality",
  pick: (d) => d.sleepQuality,
  threshold: 0.4,
  describe: (delta) => `sleep quality was usually ${Math.abs(delta).toFixed(1)} points ${delta > 0 ? "higher" : "lower"} out of 5`,
};

const BEDTIME: Metric = {
  label: "bedtime",
  pick: (d) => d.bedtimeMinutes,
  threshold: 20,
  describe: (delta) => `bedtime was usually about ${formatMinutesDelta(delta)} ${delta > 0 ? "later" : "earlier"}`,
};

const WAKETIME: Metric = {
  label: "wake time",
  pick: (d) => d.wakeMinutes,
  threshold: 20,
  describe: (delta) => `wake time was usually about ${formatMinutesDelta(delta)} ${delta > 0 ? "later" : "earlier"}`,
};

const ENERGY: Metric = {
  label: "energy",
  pick: (d) => d.energy,
  threshold: 0.4,
  describe: (delta) => `energy was usually ${Math.abs(delta).toFixed(1)} points ${delta > 0 ? "higher" : "lower"} out of 5`,
};

const MOOD: Metric = {
  label: "mood",
  pick: (d) => d.mood,
  threshold: 0.4,
  describe: (delta) => `mood was usually ${Math.abs(delta).toFixed(1)} points ${delta > 0 ? "higher" : "lower"} out of 5`,
};

function dateRange(days: DayRecord[]): { from: string | null; to: string | null } {
  const dates = days.map((d) => d.date).sort();
  return { from: dates[0] ?? null, to: dates[dates.length - 1] ?? null };
}

function confidenceFor(minGroup: number, effect: number, threshold: number): Confidence {
  if (minGroup < 3 || effect < threshold) return "none";
  if (minGroup >= 10 && effect >= threshold * 2) return "strong";
  if (minGroup >= 6 && effect >= threshold * 1.5) return "moderate";
  return "early";
}

type Comparison = {
  withMean: number;
  withoutMean: number;
  delta: number;
  nWith: number;
  nWithout: number;
  confidence: Confidence;
  sentence: string;
  observations: number;
};

function compare(
  days: DayRecord[],
  flag: (d: DayRecord) => boolean | null,
  metric: Metric,
): Comparison | null {
  const withDays = days.filter((d) => flag(d) === true);
  const withoutDays = days.filter((d) => flag(d) === false);
  const a = average(withDays, metric.pick);
  const b = average(withoutDays, metric.pick);
  if (a.value == null || b.value == null) return null;
  const delta = a.value - b.value;
  const minGroup = Math.min(a.count, b.count);
  const confidence = confidenceFor(minGroup, Math.abs(delta), metric.threshold);
  if (confidence === "none") return null;
  return {
    withMean: a.value,
    withoutMean: b.value,
    delta,
    nWith: a.count,
    nWithout: b.count,
    confidence,
    sentence: metric.describe(delta),
    observations: a.count + b.count,
  };
}

function build(
  id: string,
  category: PatternCategory,
  title: string,
  lead: string,
  comparison: Comparison,
  days: DayRecord[],
  stat?: string,
): Pattern {
  const range = dateRange(days);
  return {
    id,
    category,
    title,
    observation: `${lead} ${comparison.sentence}.`,
    stat,
    observations: comparison.observations,
    confidence: comparison.confidence,
    from: range.from,
    to: range.to,
  };
}

/** Reasons recorded for being awake, counted. */
export function reasonCounts(days: DayRecord[]): { reason: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const day of days) {
    for (const reason of day.reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({
      reason,
      label: SLEEP_REASONS.find((r) => r.value === reason)?.label ?? reason,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function generatePatterns(days: DayRecord[]): Pattern[] {
  const patterns: Pattern[] = [];
  const push = (pattern: Pattern | null) => {
    if (pattern) patterns.push(pattern);
  };

  const withComparison = (
    id: string,
    category: PatternCategory,
    title: string,
    lead: string,
    flag: (d: DayRecord) => boolean | null,
    metric: Metric,
    stat?: (c: Comparison) => string,
  ) => {
    const comparison = compare(days, flag, metric);
    if (!comparison) return;
    push(build(id, category, title, lead, comparison, days, stat ? stat(comparison) : undefined));
  };

  // Caffeine
  withComparison(
    "caffeine-duration",
    "caffeine",
    "Caffeine & sleep length",
    "On days when caffeine was recorded,",
    (d) => d.caffeineUsed,
    DURATION,
    (c) => `${c.nWith} days with caffeine, ${c.nWithout} without.`,
  );
  withComparison(
    "caffeine-quality",
    "caffeine",
    "Caffeine & sleep quality",
    "On days when caffeine was recorded,",
    (d) => d.caffeineUsed,
    QUALITY,
  );
  withComparison(
    "caffeine-late",
    "caffeine",
    "Late caffeine & sleep quality",
    "When caffeine was recorded later in the day,",
    (d) => d.caffeineLateEvening,
    QUALITY,
    (c) => `${c.nWith} later-caffeine days observed.`,
  );

  // Phone in bed
  withComparison(
    "phone-bedtime",
    "phone_usage",
    "Phone use & bedtime",
    "On nights when phone use in bed was recorded,",
    (d) => d.phoneInBed,
    BEDTIME,
    (c) => `${c.nWith} nights with phone use, ${c.nWithout} without.`,
  );
  withComparison(
    "phone-duration",
    "phone_usage",
    "Phone use & sleep length",
    "On nights when phone use in bed was recorded,",
    (d) => d.phoneInBed,
    NIGHT_SLEEP,
  );

  // Evening screens
  withComparison(
    "screens-bedtime",
    "screens",
    "Evening screens & bedtime",
    "On evenings with screen use before bed,",
    (d) => d.screenBeforeBed,
    BEDTIME,
    (c) => `${c.nWith} evenings with screens, ${c.nWithout} without.`,
  );
  withComparison(
    "screens-quality",
    "screens",
    "Evening screens & sleep quality",
    "On evenings with screen use before bed,",
    (d) => d.screenBeforeBed,
    QUALITY,
  );

  // Naps
  withComparison(
    "naps-bedtime",
    "naps",
    "Naps & bedtime",
    "On days with a recorded nap,",
    (d) => d.napMinutes > 0,
    BEDTIME,
    (c) => `${c.nWith} nap days, ${c.nWithout} without naps.`,
  );
  withComparison(
    "naps-total",
    "naps",
    "Naps & total sleep",
    "On days with a recorded nap,",
    (d) => d.napMinutes > 0,
    DURATION,
  );

  // Stress
  const stressFlag = (d: DayRecord) => (d.stress == null ? null : d.stress >= 4);
  withComparison("stress-duration", "stress", "Higher stress & sleep length", "On days with higher stress recorded,", stressFlag, NIGHT_SLEEP);
  withComparison("stress-quality", "stress", "Higher stress & sleep quality", "On days with higher stress recorded,", stressFlag, QUALITY);
  withComparison("stress-energy", "stress", "Higher stress & energy", "On days with higher stress recorded,", stressFlag, ENERGY);
  withComparison("stress-mood", "stress", "Higher stress & mood", "On days with higher stress recorded,", stressFlag, MOOD);

  // Recurring reasons for being awake
  const reasons = reasonCounts(days);
  const nightsWithReasons = days.filter((d) => d.reasons.length > 0).length;
  if (reasons.length > 0 && nightsWithReasons >= 3) {
    const top = reasons.slice(0, 3);
    const confidence: Confidence =
      nightsWithReasons >= 12 && top[0]!.count >= 6
        ? "strong"
        : nightsWithReasons >= 7 && top[0]!.count >= 4
          ? "moderate"
          : "early";
    const range = dateRange(days);
    patterns.push({
      id: "recurring-reasons",
      category: "reasons",
      title: "What tends to keep you awake",
      observation: `The reasons recorded most often were ${top.map((r) => `${r.label.toLowerCase()} (${r.count})`).join(", ")}.`,
      stat: `Recorded across ${nightsWithReasons} nights.`,
      observations: nightsWithReasons,
      confidence,
      from: range.from,
      to: range.to,
    });
  }

  // Previous night's sleep vs next-day energy / mood
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const pairs: { sleep: number; energy: number | null; mood: number | null }[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const today = sorted[i]!;
    const prevDate = Date.parse(`${prev.date}T12:00:00Z`);
    const todayDate = Date.parse(`${today.date}T12:00:00Z`);
    const sleep = total24(prev);
    if (todayDate - prevDate !== 86_400_000 || sleep == null) continue;
    pairs.push({ sleep, energy: today.energy, mood: today.mood });
  }
  const medianSleep = (() => {
    const nums = pairs.map((p) => p.sleep).sort((a, b) => a - b);
    if (nums.length === 0) return null;
    return nums[Math.floor(nums.length / 2)]!;
  })();
  if (medianSleep != null) {
    for (const [key, label, field, threshold] of [
      ["next-day-energy", "energy", "energy", 0.4],
      ["next-day-mood", "mood", "mood", 0.4],
    ] as const) {
      const longer = pairs.filter((p) => p.sleep >= medianSleep && p[field] != null).map((p) => p[field]!);
      const shorter = pairs.filter((p) => p.sleep < medianSleep && p[field] != null).map((p) => p[field]!);
      const a = mean(longer);
      const b = mean(shorter);
      if (a == null || b == null) continue;
      const delta = a - b;
      const confidence = confidenceFor(Math.min(longer.length, shorter.length), Math.abs(delta), threshold);
      if (confidence === "none") continue;
      const range = dateRange(days);
      patterns.push({
        id: key,
        category: "next_day",
        title: `Longer nights & next-day ${label}`,
        observation: `After your longer nights, next-day ${label} was usually ${Math.abs(delta).toFixed(1)} points ${delta > 0 ? "higher" : "lower"} out of 5.`,
        stat: `Compared ${longer.length} longer nights with ${shorter.length} shorter ones.`,
        observations: longer.length + shorter.length,
        confidence,
        from: range.from,
        to: range.to,
      });
    }
  }

  // Weekday vs weekend
  const weekendFlag = (d: DayRecord) => isWeekend(d.date);
  for (const [id, title, metric] of [
    ["weekend-duration", "Weekends & sleep length", DURATION],
    ["weekend-bedtime", "Weekends & bedtime", BEDTIME],
    ["weekend-waketime", "Weekends & wake time", WAKETIME],
    ["weekend-quality", "Weekends & sleep quality", QUALITY],
  ] as const) {
    const comparison = compare(days, weekendFlag, metric);
    if (!comparison) continue;
    push(
      build(
        id,
        "weekend",
        title,
        "On weekends compared with weekdays,",
        comparison,
        days,
        `${comparison.nWith} weekend days, ${comparison.nWithout} weekdays.`,
      ),
    );
  }

  const order: Record<Confidence, number> = { strong: 0, moderate: 1, early: 2, none: 3 };
  return patterns.sort((a, b) => order[a.confidence] - order[b.confidence] || b.observations - a.observations);
}

/** The single friendliest observation for the Home page, if any exists. */
export function headlinePattern(patterns: Pattern[]): Pattern | null {
  return patterns.find((p) => p.confidence !== "none") ?? null;
}

/** Ensure a stat line is present. */
export function observationLine(pattern: Pattern): string {
  return `Based on ${pattern.observations} recorded ${pattern.observations === 1 ? "night" : "nights"}.`;
}

export { values };

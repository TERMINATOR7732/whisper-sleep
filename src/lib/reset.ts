/**
 * Deterministic sleep-reset planning helpers. Pure functions, no AI, no network.
 *
 * Clock conventions match src/lib/analytics.ts:
 *  - bedtime is minutes since noon (23:10 -> 670, 00:40 -> 760)
 *  - wake time is minutes since midnight
 *
 * Nothing here is medical advice: these are routine-planning suggestions only.
 */

import {
  average,
  formatMinutesDelta,
  mean,
  total24,
  values,
  type DayRecord,
} from "./analytics";

export type AdjustmentPace = "gentle" | "steady" | "faster";

export const PACE_OPTIONS: {
  value: AdjustmentPace;
  label: string;
  note: string;
  stepMinutes: number;
  nightsPerStage: number;
}[] = [
  { value: "gentle", label: "Gentle", note: "15 min every 3 nights", stepMinutes: 15, nightsPerStage: 3 },
  { value: "steady", label: "Steady", note: "20 min every 2 nights", stepMinutes: 20, nightsPerStage: 2 },
  { value: "faster", label: "A bit faster", note: "30 min every 2 nights", stepMinutes: 30, nightsPerStage: 2 },
];

export function paceOption(pace: AdjustmentPace | string | null | undefined) {
  return PACE_OPTIONS.find((option) => option.value === pace) ?? PACE_OPTIONS[0]!;
}

/* ---------- time value helpers ("HH:MM" from <input type="time">) ---------- */

export function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(minutesSinceMidnight: number | null | undefined): string {
  if (minutesSinceMidnight == null || !Number.isFinite(minutesSinceMidnight)) return "";
  const wrapped = ((Math.round(minutesSinceMidnight) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** "23:10" -> 670 (minutes since noon), "00:40" -> 760. */
export function bedtimeToNoonMinutes(value: string | null | undefined): number | null {
  const minutes = timeToMinutes(value);
  if (minutes == null) return null;
  return minutes >= 720 ? minutes - 720 : minutes + 720;
}

/** 670 -> "23:10". */
export function noonMinutesToTime(noonMinutes: number | null | undefined): string {
  if (noonMinutes == null || !Number.isFinite(noonMinutes)) return "";
  return minutesToTime(noonMinutes + 720);
}

export function formatTimeLabel(value: string | null | undefined): string {
  const minutes = timeToMinutes(value);
  if (minutes == null) return "—";
  const hour24 = Math.floor(minutes / 60);
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minutes % 60).padStart(2, "0")} ${suffix}`;
}

/* ---------- gradual schedule ---------- */

export type ResetStage = {
  id: string;
  bedtime: string; // "HH:MM"
  nights: number;
  note?: string;
};

export type GradualPlan = {
  diffMinutes: number | null; // negative = target is earlier
  direction: "earlier" | "later" | "same" | null;
  headline: string;
  stages: ResetStage[];
};

/** Builds a small, realistic series of bedtime steps between now and the target. */
export function buildGradualPlan(
  currentBedtime: string | null | undefined,
  targetBedtime: string | null | undefined,
  pace: AdjustmentPace,
): GradualPlan {
  const from = bedtimeToNoonMinutes(currentBedtime);
  const to = bedtimeToNoonMinutes(targetBedtime);

  if (from == null || to == null) {
    return {
      diffMinutes: null,
      direction: null,
      headline: "Add your usual bedtime and the bedtime you'd like, and we'll suggest small steps.",
      stages: [],
    };
  }

  const diff = to - from;
  const { stepMinutes, nightsPerStage } = paceOption(pace);

  if (Math.abs(diff) <= 15) {
    return {
      diffMinutes: diff,
      direction: "same",
      headline: "Your target is already close to your usual bedtime — steadiness matters more than moving it.",
      stages: [{ id: "stage-1", bedtime: noonMinutesToTime(to), nights: 7, note: "Keep this time as steady as you can." }],
    };
  }

  const sign = diff < 0 ? -1 : 1;
  const stageCount = Math.ceil(Math.abs(diff) / stepMinutes);
  const stages: ResetStage[] = [];
  for (let index = 1; index <= stageCount; index += 1) {
    const value = index === stageCount ? to : from + sign * stepMinutes * index;
    stages.push({
      id: `stage-${index}`,
      bedtime: noonMinutesToTime(value),
      nights: nightsPerStage,
      ...(index === stageCount ? { note: "Then hold this time and let it settle." } : {}),
    });
  }

  return {
    diffMinutes: diff,
    direction: diff < 0 ? "earlier" : "later",
    headline: `Your target is about ${formatMinutesDelta(diff)} ${diff < 0 ? "earlier" : "later"} than your usual bedtime. A gradual shift may be easier than changing it in one night.`,
    stages,
  };
}

export function planLengthNights(stages: ResetStage[]): number {
  return stages.reduce((total, stage) => total + Math.max(1, stage.nights || 1), 0);
}

/** Which stage the user is on, counting nights from the plan start date. */
export function currentStage(stages: ResetStage[], startedOn: string | null | undefined, today: string) {
  if (stages.length === 0) return { index: -1, stage: null as ResetStage | null, nightsIn: 0 };
  const start = startedOn ? Date.parse(`${startedOn}T12:00:00Z`) : NaN;
  const now = Date.parse(`${today}T12:00:00Z`);
  const nightsIn = Number.isNaN(start) || Number.isNaN(now) ? 0 : Math.max(0, Math.round((now - start) / 86_400_000));

  let remaining = nightsIn;
  for (let index = 0; index < stages.length; index += 1) {
    const nights = Math.max(1, stages[index]!.nights || 1);
    if (remaining < nights) return { index, stage: stages[index]!, nightsIn };
    remaining -= nights;
  }
  return { index: stages.length - 1, stage: stages[stages.length - 1]!, nightsIn };
}

/* ---------- current vs target ---------- */

export type Comparison = {
  currentMinutes: number | null;
  targetMinutes: number | null;
  diffMinutes: number | null;
  nights: number;
  sentence: string;
};

/** Average recorded bedtime (minutes since noon) vs the planned bedtime. */
export function compareBedtime(days: DayRecord[], targetBedtime: string | null | undefined): Comparison {
  const target = bedtimeToNoonMinutes(targetBedtime);
  const { value, count } = average(days, (d) => d.bedtimeMinutes);
  return buildComparison(value, target, count, "bedtime", (m) => noonMinutesToTime(m));
}

/** Average recorded wake time (minutes since midnight) vs the planned wake time. */
export function compareWakeTime(days: DayRecord[], targetWake: string | null | undefined): Comparison {
  const target = timeToMinutes(targetWake);
  const { value, count } = average(days, (d) => d.wakeMinutes);
  return buildComparison(value, target, count, "wake time", (m) => minutesToTime(m));
}

function buildComparison(
  current: number | null,
  target: number | null,
  nights: number,
  noun: string,
  toTime: (minutes: number) => string,
): Comparison {
  const diff = current != null && target != null ? current - target : null;
  let sentence: string;
  if (current == null) {
    sentence = `Once a few nights are logged we can show your current average ${noun}.`;
  } else if (target == null) {
    sentence = `Your current average ${noun} is around ${formatTimeLabel(toTime(current))}.`;
  } else if (diff != null && Math.abs(diff) < 15) {
    sentence = `Your average ${noun} is already close to your plan — nice and steady.`;
  } else {
    sentence = `Your current average ${noun} is around ${formatTimeLabel(toTime(current))}, about ${formatMinutesDelta(diff!)} ${diff! > 0 ? "later" : "earlier"} than your planned ${formatTimeLabel(toTime(target))}.`;
  }
  return { currentMinutes: current, targetMinutes: target, diffMinutes: diff, nights, sentence };
}

/* ---------- reset progress ---------- */

export type ResetProgress = {
  nights: number;
  bedtime: Comparison;
  wake: Comparison;
  averageNightSleep: number | null;
  averageTotalSleep: number | null;
  desiredSleepMinutes: number | null;
  nightsOnPlan: number;
  nightsConsidered: number;
};

export function resetProgress(
  days: DayRecord[],
  plan: {
    target_bedtime: string | null;
    target_wake_time: string | null;
    desired_sleep_minutes: number | null;
  },
): ResetProgress {
  const bedtime = compareBedtime(days, plan.target_bedtime);
  const wake = compareWakeTime(days, plan.target_wake_time);
  const nightSleep = average(days, (d) => d.totalSleepMinutes);
  const totalSleep = average(days, total24);

  const targetBed = bedtimeToNoonMinutes(plan.target_bedtime);
  const targetWake = timeToMinutes(plan.target_wake_time);
  const desired = plan.desired_sleep_minutes;

  let nightsOnPlan = 0;
  let nightsConsidered = 0;
  for (const day of days) {
    const checks: boolean[] = [];
    if (targetBed != null && day.bedtimeMinutes != null) checks.push(Math.abs(day.bedtimeMinutes - targetBed) <= 45);
    if (targetWake != null && day.wakeMinutes != null) checks.push(Math.abs(day.wakeMinutes - targetWake) <= 45);
    const slept = total24(day);
    if (desired != null && slept != null) checks.push(slept >= desired - 45);
    if (checks.length === 0) continue;
    nightsConsidered += 1;
    if (checks.every(Boolean)) nightsOnPlan += 1;
  }

  return {
    nights: days.length,
    bedtime,
    wake,
    averageNightSleep: nightSleep.value,
    averageTotalSleep: totalSleep.value,
    desiredSleepMinutes: desired,
    nightsOnPlan,
    nightsConsidered,
  };
}

/* ---------- rough night detection ---------- */

export type RoughNight = {
  isRough: boolean;
  day: DayRecord | null;
  sleptMinutes: number | null;
  baselineMinutes: number | null;
  targetMinutes: number;
  shortfallMinutes: number | null;
  reason: "below-baseline" | "below-target" | null;
};

/**
 * Compares the most recent recorded night against the person's own recent
 * baseline and their own target — never a fixed "everyone needs 8 hours" rule.
 * `days` must be newest-first.
 */
export function detectRoughNight(days: DayRecord[], targetMinutes: number): RoughNight {
  const withSleep = days.filter((day) => total24(day) != null);
  const latest = withSleep[0] ?? null;
  const empty: RoughNight = {
    isRough: false,
    day: latest,
    sleptMinutes: latest ? total24(latest) : null,
    baselineMinutes: null,
    targetMinutes,
    shortfallMinutes: null,
    reason: null,
  };
  if (!latest) return empty;

  const slept = total24(latest)!;
  const baseline = mean(values(withSleep.slice(1, 15), total24));
  const baselineCut = baseline != null ? baseline * 0.8 : null;
  const targetCut = targetMinutes * 0.75;

  let reason: RoughNight["reason"] = null;
  if (baselineCut != null && slept < baselineCut) reason = "below-baseline";
  else if (slept < targetCut) reason = "below-target";

  return {
    ...empty,
    baselineMinutes: baseline,
    isRough: reason != null,
    shortfallMinutes: baseline != null ? Math.round(baseline - slept) : Math.round(targetMinutes - slept),
    reason,
  };
}

/** Gentle nudge toward a professional — only after a persistent pattern, never alarming. */
export function persistentShortSleep(days: DayRecord[], targetMinutes: number): string | null {
  const recent = days.slice(0, 14);
  const slept = values(recent, total24);
  if (slept.length < 10) return null;
  const shortNights = slept.filter((minutes) => minutes < targetMinutes * 0.75).length;
  const lowEnergy = values(recent, (d) => d.energy).filter((score) => score <= 2).length;
  if (shortNights < 7 && lowEnergy < 7) return null;
  return "Your logs show quite a stretch of short nights and low-energy days. If it keeps up, it may be worth talking it through with a doctor or another qualified professional — they can look at things this app can't.";
}

/* ---------- recovery suggestions ---------- */

export function recoverySuggestions(rough: RoughNight, day: DayRecord | null): string[] {
  const list: string[] = [
    "Keep today's schedule as manageable as you can — fewer things, done gently.",
  ];
  if (day?.caffeineUsed !== false) {
    list.push("Coffee or tea earlier in the day is fine; try to keep the later ones lighter so tonight isn't harder.");
  }
  if (day?.napMinutes === 0) {
    list.push("If you end up napping, log it so your total sleep for the day stays accurate.");
  } else {
    list.push("Your nap is logged, so your total for the day includes it.");
  }
  list.push(
    `Give yourself enough room for tonight — around ${formatMinutesDelta(rough.targetMinutes)} in bed, not less.`,
  );
  list.push("Starting your wind-down a little earlier tonight can make getting to sleep feel easier.");
  list.push("Today is about recovery, not judging last night.");
  return list;
}

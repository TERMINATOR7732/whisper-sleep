/** Timezone-aware helpers for sleep tracking. All stored timestamps are UTC ISO strings. */

function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUTC - date.getTime();
}

export function safeTimezone(timezone?: string | null): string {
  if (!timezone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

/** "2026-09-05T23:30" understood in `timezone` -> UTC ISO string. */
export function zonedInputToISO(localValue: string, timezone: string): string | null {
  if (!localValue) return null;
  const tz = safeTimezone(timezone);
  const guess = Date.parse(`${localValue.length === 16 ? localValue : localValue.slice(0, 16)}:00Z`);
  if (Number.isNaN(guess)) return null;
  let offset = tzOffsetMs(new Date(guess), tz);
  let result = guess - offset;
  offset = tzOffsetMs(new Date(result), tz);
  result = guess - offset;
  return new Date(result).toISOString();
}

/** UTC ISO string -> "2026-09-05T23:30" in `timezone` (for datetime-local inputs). */
export function isoToZonedInput(iso: string | null | undefined, timezone: string): string {
  if (!iso) return "";
  const tz = safeTimezone(timezone);
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** Today's calendar date (YYYY-MM-DD) in the given timezone. */
export function todayInTimezone(timezone?: string | null): string {
  const tz = safeTimezone(timezone);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function shiftDate(dateString: string, days: number): string {
  const base = Date.parse(`${dateString}T12:00:00Z`);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/** Minutes between two UTC ISO timestamps, tolerating a crossed midnight. */
export function minutesBetween(startISO?: string | null, endISO?: string | null): number | null {
  if (!startISO || !endISO) return null;
  const start = Date.parse(startISO);
  const end = Date.parse(endISO);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  let diff = end - start;
  if (diff < 0) diff += 86_400_000; // sleep crossed midnight and only times were given
  if (diff < 0) return null;
  return Math.round(diff / 60_000);
}

export function formatDuration(minutes?: number | null): string {
  if (minutes == null || minutes < 0) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

export function formatClock(iso: string | null | undefined, timezone: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimezone(timezone),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDateLabel(dateString: string, timezone: string): string {
  const date = new Date(`${dateString}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimezone(timezone),
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

export const QUALITY_LABELS: Record<number, string> = {
  1: "Terrible",
  2: "Poor",
  3: "Okay",
  4: "Good",
  5: "Great",
};

export const AWAKENING_OPTIONS = [
  { label: "No", value: 0 },
  { label: "Once", value: 1 },
  { label: "2–3 times", value: 3 },
  { label: "4+ times", value: 4 },
];

export const CAFFEINE_AMOUNTS = ["1 drink", "2 drinks", "3+ drinks", "Not sure"];

export const PHONE_ACTIVITIES = [
  "Instagram / social media",
  "YouTube",
  "Netflix / shows",
  "Gaming",
  "Messaging",
  "Studying / work",
  "Other",
];

export const SLEEP_REASONS: { value: string; label: string }[] = [
  { value: "not_sleepy", label: "I wasn't sleepy" },
  { value: "phone", label: "Phone" },
  { value: "social_media", label: "Instagram / social media" },
  { value: "youtube_video", label: "YouTube / videos" },
  { value: "gaming", label: "Gaming" },
  { value: "studying", label: "Studying" },
  { value: "work", label: "Work" },
  { value: "overthinking", label: "Overthinking" },
  { value: "stress", label: "Stress" },
  { value: "caffeine", label: "Caffeine" },
  { value: "noise", label: "Noise" },
  { value: "environment", label: "Room/environment" },
  { value: "physical_discomfort", label: "Physical discomfort" },
  { value: "unknown", label: "I don't know" },
  { value: "other", label: "Something else" },
];

export const TIMEZONES: string[] = (() => {
  const withSupport = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  const list = withSupport.supportedValuesOf?.("timeZone");
  if (list && list.length > 0) return list;
  return [
    "UTC",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Australia/Sydney",
  ];
})();

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function greetingFor(timezone?: string | null): string {
  let hour = new Date().getHours();
  if (timezone) {
    try {
      hour = Number(
        new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone }).format(
          new Date(),
        ),
      );
    } catch {
      /* fall back to local hour */
    }
  }
  if (hour < 5) return "Still awake";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

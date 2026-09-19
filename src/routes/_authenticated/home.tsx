import { createFileRoute, Link } from "@tanstack/react-router";
import { BatteryCharging, Flame, Heart, HeartHandshake, Moon, RotateCcw, Smile, Sparkles, Sun, Target, X } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/app/app-shell";
import { EmptyState } from "@/components/app/empty-state";
import { RoleGate } from "@/components/app/role-gate";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationOptInPopup } from "@/components/app/notification-opt-in-popup";
import { StreakCard } from "@/components/sleep/streak-card";
import { useNotificationPreferences } from "@/hooks/use-notifications";
import { useProfile } from "@/hooks/use-profile";
import { useResetPlan, useWindDownSessions } from "@/hooks/use-reset";
import { useSleepHistory } from "@/hooks/use-sleep";
import { useStreak } from "@/hooks/use-streak";
import { toDayRecords } from "@/lib/day-records";
import { generatePatterns, headlinePattern, observationLine } from "@/lib/patterns";
import { detectRoughNight } from "@/lib/reset";
import {
  QUALITY_LABELS,
  formatClock,
  formatDateLabel,
  formatDuration,
  safeTimezone,
  todayInTimezone,
} from "@/lib/sleep";
import { greetingFor } from "@/lib/timezones";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — Nightly" },
      { name: "description", content: "A calm daily view of your sleep, energy and mood." },
      { property: "og:title", content: "Home — Nightly" },
      { property: "og:description", content: "A calm daily view of your sleep, energy and mood." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGate role="user">
      <HomePage />
    </RoleGate>
  ),
});

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-medium">{value}</p>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function parseTimeToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length < 2 || parts[0] === undefined || parts[1] === undefined) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getLocalMinutes(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return h * 60 + m;
  } catch {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

function HomePage() {
  const { data: profile } = useProfile();
  const timezone = safeTimezone(profile?.timezone);
  const today = todayInTimezone(timezone);
  const name = profile?.nickname || profile?.display_name;
  const { data: history, isLoading } = useSleepHistory(30);
  const { data: plan } = useResetPlan();
  const { preferences: notifPrefs } = useNotificationPreferences();
  const { streak } = useStreak();
  const { data: windDownSessions } = useWindDownSessions(1);
  const [dismissedCue, setDismissedCue] = useState(false);

  const latest = history?.[0] ?? null;
  const sleep = latest?.sleep ?? null;
  const checkin = latest?.checkin ?? null;
  const napMinutes = latest?.napMinutes ?? 0;
  const totalWithNaps =
    sleep?.total_sleep_minutes == null ? napMinutes || null : sleep.total_sleep_minutes + napMinutes;
  const loggedToday = latest?.date === today;
  const days = useMemo(() => toDayRecords(history ?? [], timezone), [history, timezone]);
  const sleepDays = useMemo(() => days.filter((day) => day.totalSleepMinutes != null), [days]);
  const targetMinutes = plan?.desired_sleep_minutes ?? profile?.sleep_goal_minutes ?? 480;
  const rough = useMemo(() => detectRoughNight(sleepDays, targetMinutes), [sleepDays, targetMinutes]);
  const patterns = useMemo(() => generatePatterns(days), [days]);
  const headline = useMemo(() => headlinePattern(patterns), [patterns]);

  const reminderCue = useMemo(() => {
    if (dismissedCue || !notifPrefs) return null;

    const nowMins = getLocalMinutes(timezone);

    // 1. Quiet hours check
    if (notifPrefs.quiet_hours_enabled) {
      const qStart = parseTimeToMinutes(notifPrefs.quiet_hours_start);
      const qEnd = parseTimeToMinutes(notifPrefs.quiet_hours_end);
      if (qStart !== null && qEnd !== null) {
        const isQuiet =
          qStart > qEnd
            ? nowMins >= qStart || nowMins < qEnd
            : nowMins >= qStart && nowMins < qEnd;
        if (isQuiet) return null;
      }
    }

    // 2. Evening Wind-down reminder
    if (notifPrefs.wind_down_reminders_enabled) {
      const windDownDone = windDownSessions?.[0]?.session_date === today;
      const windDownMins = parseTimeToMinutes(notifPrefs.wind_down_reminder_time) ?? 1350;
      if (!windDownDone && nowMins >= windDownMins) {
        return {
          icon: Moon,
          title: "Evening routine",
          text: "Your evening wind-down is ready whenever you are.",
          actionText: "Begin wind-down",
          href: "/wind-down",
        };
      }
    }

    // 3. Streak / Check-in reminder (only if today's check-in is not complete)
    if (!loggedToday) {
      if (notifPrefs.streak_reminders_enabled && (streak?.current_streak ?? 0) > 0) {
        return {
          icon: Flame,
          title: "Daily rhythm",
          text: "Your streak is waiting for today’s check-in.",
          actionText: "Log check-in",
          href: "/check-in",
        };
      }

      if (notifPrefs.checkin_reminders_enabled) {
        const checkinMins = parseTimeToMinutes(notifPrefs.checkin_reminder_time) ?? 1200;
        if (nowMins >= checkinMins) {
          return {
            icon: Sun,
            title: "Check-in reminder",
            text: "A small check-in can help you keep your rhythm.",
            actionText: "Check in now",
            href: "/check-in",
          };
        }
      }
    }

    return null;
  }, [
    dismissedCue,
    notifPrefs,
    timezone,
    windDownSessions,
    today,
    loggedToday,
    streak?.current_streak,
  ]);

  const todayGuidance = !rough.day
    ? {
        title: "A little context will help",
        hint: "Log a night when you can, and Nightly can offer a gentler read on today and tonight.",
        recoveryLabel: "Recovery",
      }
    : rough.isRough
      ? {
          title: "A rough night",
          hint: "You may want a gentler day today. Tonight, keep your routine steady rather than trying to force a big change.",
          recoveryLabel: "See recovery guidance",
        }
      : rough.baselineMinutes == null
        ? {
            title: "Still getting to know your range",
            hint: "A few more logged nights will make this guidance more personal. For now, a steady evening is enough.",
            recoveryLabel: "Recovery",
          }
        : {
            title: "A steadier day",
            hint: "Last night was closer to your usual range. Keep tonight simple and consistent.",
            recoveryLabel: "Recovery",
          };

  return (
    <div className="space-y-4">
      <NotificationOptInPopup />
      <PageHeader
        title={
          <>
            {greetingFor(profile?.timezone)}
            {name ? `, ${name}` : ""} <Heart className="inline size-6 text-primary" aria-hidden="true" />
          </>
        }
        subtitle={
          loggedToday
            ? "Today's check-in is saved. Here's how it looks."
            : "Whenever you're ready, tell Nightly how the night went."
        }
      />

      {reminderCue ? (
        <div className="card-soft fade-rise flex items-center justify-between gap-3 p-3.5 border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <reminderCue.icon className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{reminderCue.title}</p>
              <p className="text-xs text-muted-foreground">{reminderCue.text}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="default" className="h-7 text-xs">
              <Link to={reminderCue.href}>{reminderCue.actionText}</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setDismissedCue(true)}
              aria-label="Dismiss reminder"
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

      <StreakCard />

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : !latest ? (
        <div className="card-soft fade-rise">
          <EmptyState
            icon={Moon}
            title="Your sleep summary will appear here"
            description="Nothing recorded yet. One short check-in and this page starts filling in."
          >
            <Button asChild className="mt-2">
              <Link to="/check-in">Log your sleep</Link>
            </Button>
          </EmptyState>
        </div>
      ) : (
        <>
          <SectionCard
            title={loggedToday ? "Last night" : formatDateLabel(latest.date, timezone)}
            icon={Moon}
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="Time asleep" value={formatDuration(sleep?.total_sleep_minutes)} />
              <Metric
                label="Including naps"
                value={formatDuration(totalWithNaps)}
                note={napMinutes ? `naps ${formatDuration(napMinutes)}` : "no naps"}
              />
              <Metric
                label="Quality"
                value={(sleep?.sleep_quality ? QUALITY_LABELS[sleep.sleep_quality] : null) ?? "—"}
              />
              <Metric
                label="Bed → wake"
                value={`${formatClock(sleep?.bedtime, timezone)} → ${formatClock(sleep?.wake_time, timezone)}`}
              />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button asChild className="sm:w-auto">
                <Link to="/check-in">{loggedToday ? "Update today" : "Log your sleep"}</Link>
              </Button>
              <Button asChild variant="outline" className="sm:w-auto">
                <Link to="/history">See all nights</Link>
              </Button>
            </div>
          </SectionCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard
              title="Energy"
              icon={BatteryCharging}
              hint={
                checkin?.energy_level
                  ? `${checkin.energy_level} out of 5 on ${formatDateLabel(latest.date, timezone)}.`
                  : "No energy noted for this day yet."
              }
            />
            <SectionCard
              title="Mood"
              icon={Smile}
              hint={
                checkin?.mood_level
                  ? `${checkin.mood_level} out of 5 on ${formatDateLabel(latest.date, timezone)}.`
                  : "No mood noted for this day yet."
              }
            />
            <SectionCard
              title="Rested"
              icon={Sun}
              hint={
                checkin?.rested_level
                  ? `${checkin.rested_level} out of 5 when you woke up.`
                  : "No restedness noted for this day yet."
              }
            />
            <SectionCard
              title="Today's focus"
              icon={Target}
              hint="One gentle intention a day, suggested once there's enough to go on."
            />
          </div>
        </>
      )}

      <SectionCard title={todayGuidance.title} icon={rough.isRough ? HeartHandshake : Sun} hint={todayGuidance.hint}>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant={rough.isRough ? "default" : "outline"} size="sm">
            <Link to="/recovery"><HeartHandshake /> {todayGuidance.recoveryLabel}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/wind-down"><Moon /> Wind down tonight</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/reset"><RotateCcw /> {plan ? "View reset plan" : "Make a reset plan"}</Link>
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Insights"
        icon={Sparkles}
        hint={
          headline
            ? headline.observation
            : days.length >= 6
              ? "Based on your recent nights, your sleep routine looks fairly steady with no strong disruptions."
              : days.length === 0
                ? "Patterns need a little history first. When they're ready, they'll appear here in plain language — never as a clinical chart."
                : `${days.length} of 6 nights recorded. Once you have a few more nights, Nightly will highlight gentle patterns here.`
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {headline ? (
            <span className="text-xs text-muted-foreground">{observationLine(headline)}</span>
          ) : days.length > 0 && days.length < 6 ? (
            <span className="text-xs text-muted-foreground">Keep logging to see early signals</span>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link to="/insights">
              {headline ? "View all insights" : "See insights"}
            </Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

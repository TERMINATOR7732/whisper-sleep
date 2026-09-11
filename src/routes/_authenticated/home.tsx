import { createFileRoute, Link } from "@tanstack/react-router";
import { BatteryCharging, Heart, HeartHandshake, Moon, RotateCcw, Smile, Sparkles, Sun, Target } from "lucide-react";
import { useMemo } from "react";

import { PageHeader } from "@/components/app/app-shell";
import { EmptyState } from "@/components/app/empty-state";
import { RoleGate } from "@/components/app/role-gate";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import { useResetPlan } from "@/hooks/use-reset";
import { useSleepHistory } from "@/hooks/use-sleep";
import { toDayRecords } from "@/lib/day-records";
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

function HomePage() {
  const { data: profile } = useProfile();
  const timezone = safeTimezone(profile?.timezone);
  const today = todayInTimezone(timezone);
  const name = profile?.nickname || profile?.display_name;
  const { data: history, isLoading } = useSleepHistory(7);
  const { data: plan } = useResetPlan();

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
        hint="Patterns need a little history first. When they're ready, they'll appear here in plain language — never as a clinical chart."
      />
    </div>
  );
}

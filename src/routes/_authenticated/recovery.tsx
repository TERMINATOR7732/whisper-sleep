import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, HeartHandshake, Moon, RotateCcw, Sun, Sunrise } from "lucide-react";
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
import { formatMinutesDelta, total24 } from "@/lib/analytics";
import { toDayRecords } from "@/lib/day-records";
import {
  currentStage,
  detectRoughNight,
  formatTimeLabel,
  persistentShortSleep,
  recoverySuggestions,
  type ResetStage,
} from "@/lib/reset";
import { formatDateLabel, formatDuration, safeTimezone, todayInTimezone } from "@/lib/sleep";

export const Route = createFileRoute("/_authenticated/recovery")({
  head: () => ({
    meta: [
      { title: "Recovery — Nightly" },
      { name: "description", content: "A softer, practical plan for the day after a short night." },
    ],
  }),
  component: () => (
    <RoleGate role="user">
      <RecoveryPage />
    </RoleGate>
  ),
});

function RecoveryPage() {
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile();
  const { data: plan, isLoading: planLoading, error: planError } = useResetPlan();
  const { data: history, isLoading: historyLoading, error: historyError } = useSleepHistory(60);
  const timezone = safeTimezone(profile?.timezone);
  const today = todayInTimezone(timezone);
  const days = useMemo(() => toDayRecords(history ?? [], timezone), [history, timezone]);
  const sleepDays = useMemo(() => days.filter((day) => day.totalSleepMinutes != null), [days]);
  const targetMinutes = plan?.desired_sleep_minutes ?? profile?.sleep_goal_minutes ?? 480;
  const rough = useMemo(() => detectRoughNight(sleepDays, targetMinutes), [sleepDays, targetMinutes]);
  const suggestions = useMemo(() => recoverySuggestions(rough, rough.day), [rough]);
  const professionalNote = useMemo(() => persistentShortSleep(sleepDays, targetMinutes), [sleepDays, targetMinutes]);
  const stages = useMemo<ResetStage[]>(
    () => (Array.isArray(plan?.stages) ? (plan.stages as unknown as ResetStage[]) : []),
    [plan],
  );
  const stage = useMemo(() => currentStage(stages, plan?.started_on, today), [stages, plan?.started_on, today]);
  const loading = profileLoading || planLoading || historyLoading;
  const error = profileError ?? planError ?? historyError;
  const latest = rough.day;
  const total = latest ? total24(latest) : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Recovery" subtitle="A softer plan for the day after a short night." />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Recovery" subtitle="A softer plan for the day after a short night." />
        <div className="card-soft p-5 text-sm text-destructive">
          {error.message || "We couldn't work out your recovery view. Please try again."}
        </div>
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="space-y-4">
        <PageHeader title="Recovery" subtitle="A softer plan for the day after a short night." />
        <div className="card-soft fade-rise">
          <EmptyState
            icon={Sunrise}
            title="Nothing to recover from yet"
            description="Log a night or a check-in and this page can offer a gentle, personal read on the day ahead."
          >
            <Button asChild className="mt-2"><Link to="/check-in">Log your sleep</Link></Button>
          </EmptyState>
        </div>
        <SectionCard title="Tonight, gently" icon={Moon} hint="A simple wind-down can make a little more room for rest.">
          <Button asChild variant="outline" size="sm"><Link to="/wind-down">Open wind-down</Link></Button>
        </SectionCard>
      </div>
    );
  }

  const statusTitle = rough.isRough
    ? "A rough night"
    : rough.baselineMinutes == null
      ? "Still getting to know your range"
      : "Your sleep was closer to your usual range";
  const statusHint = rough.isRough
    ? "You may want a gentler day today. This is a check-in, not a judgment."
    : rough.baselineMinutes == null
      ? "There isn't enough history for a personal baseline yet, but this night is not showing as especially short against your current goal."
      : "This night looks closer to the range your recent logs describe.";

  return (
    <div className="space-y-4">
      <PageHeader title="Recovery" subtitle="A softer plan for the day after a short night." />

      <SectionCard title={statusTitle} icon={rough.isRough ? HeartHandshake : Sun} hint={statusHint}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Last recorded night</p>
            <p className="text-lg font-medium">{formatDateLabel(latest.date, timezone)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sleep at night</p>
            <p className="text-lg font-medium">{formatDuration(latest.totalSleepMinutes)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">24-hour total</p>
            <p className="text-lg font-medium">{formatDuration(total)}</p>
            <p className="text-xs text-muted-foreground">
              {latest.napMinutes > 0 ? `includes ${formatDuration(latest.napMinutes)} of naps` : "no naps logged"}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-1 text-sm leading-relaxed text-muted-foreground">
          {rough.baselineMinutes != null ? (
            <p>
              Your recent 24-hour baseline is around {formatDuration(Math.round(rough.baselineMinutes))}.
              {total != null ? ` This day was ${formatMinutesDelta(total - rough.baselineMinutes)} ${total >= rough.baselineMinutes ? "above" : "below"} that.` : ""}
            </p>
          ) : (
            <p>With only one recorded night, there isn't a personal baseline to compare yet.</p>
          )}
          <p>Your current sleep goal is {formatDuration(targetMinutes)}.</p>
        </div>
      </SectionCard>

      <SectionCard title="For today" icon={HeartHandshake} hint="Small, kind choices can be enough after a difficult night.">
        <ul className="space-y-3">
          {suggestions.map((suggestion) => (
            <li key={suggestion} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      {plan ? (
        <SectionCard title="Tonight's reset" icon={CalendarClock} hint="Keep the shift gradual — one rough night does not mean you need to force an earlier bedtime.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Planned bedtime</p>
              <p className="text-lg font-medium">{formatTimeLabel(stage.stage?.bedtime ?? plan.target_bedtime)}</p>
              {stage.stage ? <p className="text-xs text-muted-foreground">Step {stage.index + 1} of your gradual plan</p> : null}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Planned wake time</p>
              <p className="text-lg font-medium">{formatTimeLabel(plan.target_wake_time)}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/reset">View reset plan</Link></Button>
            <Button asChild size="sm"><Link to="/wind-down">Start wind-down</Link></Button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Tonight" icon={Moon} hint="If you want a steadier routine, a reset plan can make small changes feel more manageable.">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/reset"><RotateCcw /> Make a reset plan</Link></Button>
            <Button asChild size="sm"><Link to="/wind-down">Open wind-down</Link></Button>
          </div>
        </SectionCard>
      )}

      {professionalNote ? (
        <SectionCard title="A little extra support" icon={HeartHandshake} hint={professionalNote} />
      ) : null}

      <SectionCard title="Keep the picture current" icon={Sun} hint="A short check-in helps tomorrow's view reflect how today actually felt.">
        <Button asChild variant="outline" size="sm"><Link to="/check-in">Log today's check-in</Link></Button>
      </SectionCard>
    </div>
  );
}

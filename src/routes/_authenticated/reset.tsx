import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, HeartHandshake, Moon, RotateCcw, Sparkles, Sunrise } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/app-shell";
import { EmptyState } from "@/components/app/empty-state";
import { RoleGate } from "@/components/app/role-gate";
import { SectionCard } from "@/components/app/section-card";
import { ChoiceGroup, Field, YesNo } from "@/components/sleep/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { useResetPlan, useSaveResetPlan } from "@/hooks/use-reset";
import { useSleepHistory } from "@/hooks/use-sleep";
import { formatMinutesDelta } from "@/lib/analytics";
import { toDayRecords } from "@/lib/day-records";
import { generatePatterns, headlinePattern, observationLine } from "@/lib/patterns";
import {
  PACE_OPTIONS,
  buildGradualPlan,
  currentStage,
  formatTimeLabel,
  paceOption,
  planLengthNights,
  resetProgress,
  type AdjustmentPace,
  type ResetStage,
} from "@/lib/reset";
import { formatDuration, safeTimezone, todayInTimezone } from "@/lib/sleep";

export const Route = createFileRoute("/_authenticated/reset")({
  head: () => ({
    meta: [
      { title: "Reset — Nightly" },
      { name: "description", content: "A kind, step-by-step way to rebuild your sleep routine." },
      { property: "og:title", content: "Reset — Nightly" },
      { property: "og:description", content: "A kind, step-by-step way to rebuild your sleep routine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGate role="user">
      <ResetPage />
    </RoleGate>
  ),
});

const SLEEP_LENGTH_OPTIONS = [360, 390, 420, 450, 480, 510, 540].map((minutes) => ({
  value: minutes,
  label: formatDuration(minutes),
}));

function ResetPage() {
  const { data: profile } = useProfile();
  const timezone = safeTimezone(profile?.timezone);
  const today = todayInTimezone(timezone);
  const { data: plan, isLoading } = useResetPlan();
  const save = useSaveResetPlan();
  const { data: history } = useSleepHistory(60);

  const [desired, setDesired] = useState<number | null>(480);
  const [wake, setWake] = useState("");
  const [currentBed, setCurrentBed] = useState("");
  const [targetBed, setTargetBed] = useState("");
  const [dayStart, setDayStart] = useState("");
  const [pace, setPace] = useState<AdjustmentPace>("gentle");
  const [naps, setNaps] = useState<boolean | null>(null);
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) return;
    setDesired(plan.desired_sleep_minutes ?? 480);
    setWake((plan.target_wake_time ?? "").slice(0, 5));
    setCurrentBed((plan.current_bedtime ?? "").slice(0, 5));
    setTargetBed((plan.target_bedtime ?? "").slice(0, 5));
    setDayStart((plan.day_start_time ?? "").slice(0, 5));
    setPace((plan.adjustment_pace as AdjustmentPace) ?? "gentle");
    setNaps(plan.naps_needed);
    setGoal(plan.personal_goal ?? "");
  }, [plan]);

  const gradual = useMemo(() => buildGradualPlan(currentBed, targetBed, pace), [currentBed, targetBed, pace]);

  const days = useMemo(() => toDayRecords(history ?? [], timezone), [history, timezone]);
  const savedStages = useMemo<ResetStage[]>(
    () => (Array.isArray(plan?.stages) ? (plan!.stages as unknown as ResetStage[]) : []),
    [plan],
  );
  const progress = useMemo(
    () =>
      plan
        ? resetProgress(days, {
            target_bedtime: plan.target_bedtime,
            target_wake_time: plan.target_wake_time,
            desired_sleep_minutes: plan.desired_sleep_minutes,
          })
        : null,
    [days, plan],
  );
  const stageNow = useMemo(
    () => currentStage(savedStages, plan?.started_on, today),
    [savedStages, plan?.started_on, today],
  );
  const relatedPattern = useMemo(() => headlinePattern(generatePatterns(days)), [days]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!currentBed || !targetBed) {
      setError("Add your usual bedtime and the bedtime you'd like, so we can suggest small steps.");
      return;
    }
    try {
      await save.mutateAsync({
        ...(plan?.id ? { id: plan.id } : {}),
        desired_sleep_minutes: desired,
        target_wake_time: wake || null,
        current_bedtime: currentBed,
        target_bedtime: targetBed,
        day_start_time: dayStart || null,
        adjustment_pace: pace,
        naps_needed: naps,
        personal_goal: goal.trim() || null,
        stages: gradual.stages,
        restart: !plan,
      });
      toast.success(plan ? "Your reset plan is updated" : "Your reset plan is saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't save that. Please try again.");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Reset" subtitle="For the weeks when sleep needs a fresh start." />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Reset" subtitle="For the weeks when sleep needs a fresh start." />

      {!plan ? (
        <div className="card-soft fade-rise">
          <EmptyState
            icon={RotateCcw}
            title="No reset plan yet"
            description="Tell Nightly the bedtime you have now and the one you'd like. It'll suggest small steps instead of one big jump — and nothing is shared unless you choose."
          />
        </div>
      ) : null}

      <form onSubmit={onSave} className="card-soft fade-rise space-y-6 p-5 sm:p-6">
        <ChoiceGroup<number>
          label="How much sleep would you like each day?"
          value={desired}
          options={SLEEP_LENGTH_OPTIONS}
          onChange={setDesired}
          allowClear={false}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Wake-up time you need" hint="The one that's mostly fixed." htmlFor="r-wake">
            <Input id="r-wake" type="time" value={wake} onChange={(e) => setWake(e.target.value)} className="h-12 text-base" />
          </Field>
          <Field label="Work or college start" hint="Optional." htmlFor="r-day">
            <Input id="r-day" type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} className="h-12 text-base" />
          </Field>
          <Field label="Bedtime you have now" htmlFor="r-current">
            <Input id="r-current" type="time" value={currentBed} onChange={(e) => setCurrentBed(e.target.value)} className="h-12 text-base" />
          </Field>
          <Field label="Bedtime you'd like" htmlFor="r-target">
            <Input id="r-target" type="time" value={targetBed} onChange={(e) => setTargetBed(e.target.value)} className="h-12 text-base" />
          </Field>
        </div>

        <ChoiceGroup<AdjustmentPace>
          label="How quickly would you like to shift?"
          value={pace}
          options={PACE_OPTIONS.map((option) => ({ label: `${option.label} · ${option.note}`, value: option.value }))}
          onChange={(next) => setPace(next ?? "gentle")}
          allowClear={false}
        />

        <YesNo label="Do you need naps for now?" value={naps} onChange={setNaps} />

        <Field label="Anything you're doing this for?" hint="Optional — a sentence to come back to." htmlFor="r-goal">
          <Textarea
            id="r-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            placeholder="I'd like mornings to feel less of a fight."
          />
        </Field>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : plan ? "Update plan" : "Save plan"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to="/wind-down">Wind-down routine</Link>
          </Button>
        </div>
      </form>

      <SectionCard title="Your gradual schedule" icon={CalendarClock} hint={gradual.headline}>
        {gradual.stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add both bedtimes above and the steps will appear here.
          </p>
        ) : (
          <>
            <ol className="space-y-2">
              {gradual.stages.map((stage, index) => {
                const isNow = plan != null && savedStages.length > 0 && index === stageNow.index;
                return (
                  <li
                    key={stage.id}
                    className={`flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border px-4 py-3 ${
                      isNow ? "border-primary bg-secondary/60" : "border-border/70"
                    }`}
                  >
                    <span className="text-sm font-medium">
                      Step {index + 1} — bed around {formatTimeLabel(stage.bedtime)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {stage.nights} {stage.nights === 1 ? "night" : "nights"}
                      {isNow ? " · you're here now" : ""}
                    </span>
                    {stage.note ? <span className="w-full text-xs text-muted-foreground">{stage.note}</span> : null}
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              About {planLengthNights(gradual.stages)} nights at a {paceOption(pace).label.toLowerCase()} pace. Missing a
              night doesn't undo anything — pick it back up whenever.
            </p>
          </>
        )}
      </SectionCard>

      {plan ? (
        <SectionCard
          title="How it's going"
          icon={Sunrise}
          hint={
            progress && progress.nights >= 3
              ? `${progress.nightsOnPlan} of ${progress.nightsConsidered} recorded ${progress.nightsConsidered === 1 ? "night" : "nights"} landed close to your plan.`
              : "Once a few more nights are logged, your progress will show here."
          }
        >
          {progress ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Sleep at night</p>
                <p className="text-lg font-medium">{formatDuration(progress.averageNightSleep ?? null)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total including naps</p>
                <p className="text-lg font-medium">{formatDuration(progress.averageTotalSleep ?? null)}</p>
                <p className="text-xs text-muted-foreground">
                  {progress.desiredSleepMinutes && progress.averageTotalSleep != null
                    ? `${formatMinutesDelta(progress.averageTotalSleep - progress.desiredSleepMinutes)} ${
                        progress.averageTotalSleep >= progress.desiredSleepMinutes ? "over" : "under"
                      } your goal`
                    : "goal not set"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nights recorded</p>
                <p className="text-lg font-medium">{progress.nights}</p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground sm:col-span-3">{progress.bedtime.sentence}</p>
              <p className="text-sm leading-relaxed text-muted-foreground sm:col-span-3">{progress.wake.sentence}</p>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {relatedPattern ? (
        <SectionCard title="Worth keeping in mind" icon={Sparkles} hint={observationLine(relatedPattern)}>
          <Button asChild variant="outline" size="sm">
            <Link to="/insights">See your insights</Link>
          </Button>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="Wind-down" icon={Moon} hint="A short checklist for the last stretch before bed.">
          <Button asChild variant="outline" size="sm">
            <Link to="/wind-down">Open wind-down</Link>
          </Button>
        </SectionCard>
        <SectionCard title="After a rough night" icon={HeartHandshake} hint="A softer plan for the day after little sleep.">
          <Button asChild variant="outline" size="sm">
            <Link to="/recovery">Open recovery</Link>
          </Button>
        </SectionCard>
      </div>
    </div>
  );
}

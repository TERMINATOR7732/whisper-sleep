import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronUp, Moon, Pencil, Plus, RotateCcw, Settings2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/app-shell";
import { EmptyState } from "@/components/app/empty-state";
import { RoleGate } from "@/components/app/role-gate";
import { SectionCard } from "@/components/app/section-card";
import { ChoiceGroup } from "@/components/sleep/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useLogWindDownSession,
  useSaveWindDownPreferences,
  useSaveWindDownTasks,
  useSeedDefaultTasks,
  useWindDownPreferences,
  useWindDownSessions,
  useWindDownTasks,
} from "@/hooks/use-reset";
import { useProfile } from "@/hooks/use-profile";
import {
  COMMUNICATION_STYLES,
  DURATION_OPTIONS,
  styleOf,
  type CommunicationStyle,
  type WindDownTaskDraft,
  windDownCopy,
} from "@/lib/wind-down";
import { safeTimezone, todayInTimezone } from "@/lib/sleep";

export const Route = createFileRoute("/_authenticated/wind-down")({
  head: () => ({
    meta: [
      { title: "Wind-down — Nightly" },
      { name: "description", content: "A quiet, personal checklist for the last stretch before bed." },
    ],
  }),
  component: () => (
    <RoleGate role="user">
      <WindDownPage />
    </RoleGate>
  ),
});

type TaskState = "done" | "skipped";

function WindDownPage() {
  const { data: profile } = useProfile();
  const timezone = safeTimezone(profile?.timezone);
  const today = todayInTimezone(timezone);
  const { data: preferences, isLoading: preferencesLoading, error: preferencesError } = useWindDownPreferences();
  const { data: savedTasks, isLoading: tasksLoading, error: tasksError } = useWindDownTasks();
  const { data: sessions } = useWindDownSessions(7);
  const savePreferences = useSaveWindDownPreferences();
  const saveTasks = useSaveWindDownTasks();
  const seedDefaults = useSeedDefaultTasks();
  const logSession = useLogWindDownSession();

  const [draftTasks, setDraftTasks] = useState<WindDownTaskDraft[]>([]);
  const [taskState, setTaskState] = useState<Record<string, TaskState | undefined>>({});
  const [setupOpen, setSetupOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!savedTasks) return;
    setDraftTasks(
      savedTasks.map((task) => ({
        id: task.id,
        label: task.label,
        phase: task.phase === "sixty" ? "sixty" : "thirty",
        position: task.position,
        enabled: task.enabled,
      })),
    );
    setTaskState({});
  }, [savedTasks]);

  const duration = preferences?.duration_minutes === 60 ? 60 : 30;
  const style = styleOf(preferences?.communication_style) as CommunicationStyle;
  const copy = windDownCopy(style);
  const activeTasks = useMemo(
    () =>
      draftTasks.filter(
        (task) => task.enabled && (duration === 60 || task.phase === "thirty"),
      ),
    [draftTasks, duration],
  );
  const completed = activeTasks.filter((task) => task.id && taskState[task.id] === "done").length;
  const skipped = activeTasks.filter((task) => task.id && taskState[task.id] === "skipped").length;
  const progress = activeTasks.length ? Math.round((completed / activeTasks.length) * 100) : 0;
  const allCompleted = activeTasks.length > 0 && completed === activeTasks.length;
  const alreadyLogged = sessions?.some((session) => session.session_date === today) ?? false;
  const loading = preferencesLoading || tasksLoading;

  async function savePreferenceChange(values: {
    duration_minutes?: number;
    communication_style?: string;
    use_default_checklist?: boolean;
  }) {
    setSaveError(null);
    try {
      await savePreferences.mutateAsync({ id: preferences?.id ?? null, ...values });
      toast.success("Wind-down preferences saved");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "We couldn't save those preferences. Please try again.");
    }
  }

  async function saveChecklist() {
    setSaveError(null);
    try {
      await saveTasks.mutateAsync(draftTasks.map((task, position) => ({ ...task, position })));
      toast.success("Your checklist is saved");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "We couldn't save your checklist. Please try again.");
    }
  }

  async function restoreDefaults() {
    setSaveError(null);
    try {
      await seedDefaults.seed();
      if (preferences?.use_default_checklist === false) {
        await savePreferences.mutateAsync({ id: preferences.id, use_default_checklist: true });
      }
      toast.success("The default checklist is ready");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "We couldn't restore the default checklist. Please try again.");
    }
  }

  async function finishRoutine() {
    setSessionError(null);
    if (alreadyLogged) {
      setSessionError("Tonight's routine is already saved. You can still restart the checklist whenever you like.");
      return;
    }
    const completedCount = activeTasks.filter((task) => task.id && taskState[task.id] === "done").length;
    const skippedCount = activeTasks.length - completedCount;
    try {
      await logSession.mutateAsync({
        session_date: today,
        duration_minutes: duration,
        tasks_completed: completedCount,
        tasks_skipped: skippedCount,
        tasks_total: activeTasks.length,
      });
      toast.success(allCompleted ? copy.done : "Your wind-down is saved for tonight");
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "We couldn't save tonight's routine. Please try again.");
    }
  }

  function updateTask(index: number, patch: Partial<WindDownTaskDraft>) {
    setDraftTasks((tasks) => tasks.map((task, taskIndex) => (taskIndex === index ? { ...task, ...patch } : task)));
  }

  function moveTask(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draftTasks.length) return;
    setDraftTasks((tasks) => {
      const next = [...tasks];
      const [item] = next.splice(index, 1);
      if (!item) return tasks;
      next.splice(target, 0, item);
      return next.map((task, position) => ({ ...task, position }));
    });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Wind-down" subtitle="A little room to let the day go." />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (preferencesError || tasksError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Wind-down" subtitle="A little room to let the day go." />
        <div className="card-soft p-5 text-sm text-destructive">
          {preferencesError?.message ?? tasksError?.message ?? "We couldn't load your wind-down routine. Please try again."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Wind-down" subtitle="A little room to let the day go." />

      <SectionCard title={`${duration}-minute routine`} icon={Moon} hint={allCompleted ? copy.done : copy.intro}>
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{completed} of {activeTasks.length} complete</span>
            <span className="text-muted-foreground">{duration} minutes</span>
          </div>
          <Progress value={progress} aria-label={`${completed} of ${activeTasks.length} tasks complete`} />
          {skipped > 0 ? <p className="text-xs text-muted-foreground">{skipped} {skipped === 1 ? "task is" : "tasks are"} set aside for tonight.</p> : null}
          {alreadyLogged ? <p className="text-sm text-muted-foreground">Tonight's routine has been saved. You can still use this list again, gently and without pressure.</p> : null}
        </div>
      </SectionCard>

      {activeTasks.length === 0 ? (
        <div className="card-soft fade-rise">
          <EmptyState
            icon={Moon}
            title="Your checklist is empty"
            description={preferences?.use_default_checklist === false ? "Add a few things that help you settle, whenever you're ready." : "Start with the calm default checklist, then make it your own."}
          >
            {preferences?.use_default_checklist !== false ? <Button type="button" onClick={() => void restoreDefaults()} disabled={seedDefaults.isPending}>Use the default checklist</Button> : null}
          </EmptyState>
        </div>
      ) : (
        <SectionCard title="Tonight's checklist" icon={Check} hint={allCompleted ? copy.done : completed > 0 ? copy.midway : "Move through this at your own pace. Anything unfinished can wait."}>
          <ol className="space-y-2">
            {activeTasks.map((task) => {
              const status = task.id ? taskState[task.id] : undefined;
              return (
                <li key={task.id ?? `${task.label}-${task.position}`} className="flex items-center gap-3 rounded-2xl border border-border/70 px-3 py-3">
                  <button
                    type="button"
                    aria-label={`Mark ${task.label} complete`}
                    aria-pressed={status === "done"}
                    onClick={() => task.id && setTaskState((state) => ({ ...state, [task.id!]: status === "done" ? undefined : "done" }))}
                    className={`grid size-10 shrink-0 place-items-center rounded-full border transition-colors ${status === "done" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-secondary"}`}
                  >
                    <Check className="size-4" aria-hidden="true" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>{task.label}</p>
                    <p className="text-xs text-muted-foreground">{task.phase === "sixty" ? "60-minute stretch" : "Last 30 minutes"}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => task.id && setTaskState((state) => ({ ...state, [task.id!]: status === "skipped" ? undefined : "skipped" }))}
                  >
                    {status === "skipped" ? "Bring back" : "Skip"}
                  </Button>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void finishRoutine()} disabled={logSession.isPending || activeTasks.length === 0}>
              {logSession.isPending ? "Saving…" : allCompleted ? "Finish routine" : "Save tonight's routine"}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setTaskState({}); setSessionError(null); }}>
              <RotateCcw /> Restart checklist
            </Button>
          </div>
          {sessionError ? <p className="mt-3 text-sm text-destructive">{sessionError}</p> : null}
        </SectionCard>
      )}

      <SectionCard title="Make it yours" icon={Settings2} hint={copy.reminder}>
        <div className="space-y-5">
          <ChoiceGroup<number>
            label="Routine length"
            value={duration}
            options={DURATION_OPTIONS.map(({ value, label }) => ({ value, label }))}
            onChange={(value) => value && void savePreferenceChange({ duration_minutes: value })}
            allowClear={false}
          />
          <ChoiceGroup<CommunicationStyle>
            label="Tone"
            value={style}
            options={COMMUNICATION_STYLES}
            onChange={(value) => value && void savePreferenceChange({ communication_style: value })}
            allowClear={false}
          />
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Use the default checklist</p>
              <p className="text-xs text-muted-foreground">Keep the starting routine available when you need a reset.</p>
            </div>
            <Switch
              checked={preferences?.use_default_checklist ?? true}
              onCheckedChange={(checked) => void savePreferenceChange({ use_default_checklist: checked })}
              aria-label="Use the default checklist"
            />
          </div>
          <Button type="button" variant="outline" onClick={() => setSetupOpen((open) => !open)}>
            <Pencil /> {setupOpen ? "Close checklist editor" : "Edit checklist"}
          </Button>
        </div>
      </SectionCard>

      {setupOpen ? (
        <SectionCard title="Checklist editor" icon={Sparkles} hint="Choose what belongs in your evening. Changes save only when you say so.">
          <div className="space-y-3">
            {draftTasks.map((task, index) => (
              <div key={task.id ?? `new-${index}`} className="rounded-2xl border border-border/70 p-3">
                <div className="flex gap-2">
                  <Input value={task.label} onChange={(event) => updateTask(index, { label: event.target.value })} aria-label={`Task ${index + 1} label`} className="h-11" />
                  <Switch checked={task.enabled} onCheckedChange={(enabled) => updateTask(index, { enabled })} aria-label={`Enable ${task.label || "task"}`} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" variant={task.phase === "sixty" ? "secondary" : "outline"} size="sm" onClick={() => updateTask(index, { phase: "sixty" })}>60-minute</Button>
                  <Button type="button" variant={task.phase === "thirty" ? "secondary" : "outline"} size="sm" onClick={() => updateTask(index, { phase: "thirty" })}>30-minute</Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => moveTask(index, -1)} disabled={index === 0} aria-label="Move task up"><ChevronUp /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => moveTask(index, 1)} disabled={index === draftTasks.length - 1} aria-label="Move task down"><ChevronDown /></Button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setDraftTasks((tasks) => [...tasks, { label: "", phase: "thirty", position: tasks.length, enabled: true }])}><Plus /> Add task</Button>
              <Button type="button" onClick={() => void saveChecklist()} disabled={saveTasks.isPending}>{saveTasks.isPending ? "Saving…" : "Save checklist"}</Button>
              <Button type="button" variant="ghost" onClick={() => void restoreDefaults()} disabled={seedDefaults.isPending}>Restore defaults</Button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
    </div>
  );
}

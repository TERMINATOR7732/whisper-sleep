import { useEffect, useMemo, useState } from "react";
import { Coffee, Loader2, Moon, Plus, Smartphone, Sun, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ChoiceGroup,
  DateTimeField,
  Field,
  MultiChoice,
  ScalePicker,
  YesNo,
} from "@/components/sleep/inputs";
import type { DayLog, DayLogInput, NapInput } from "@/hooks/use-sleep";
import {
  AWAKENING_OPTIONS,
  CAFFEINE_AMOUNTS,
  PHONE_ACTIVITIES,
  QUALITY_LABELS,
  SLEEP_REASONS,
  formatDuration,
  isoToZonedInput,
  minutesBetween,
  zonedInputToISO,
} from "@/lib/sleep";

type NapDraft = {
  key: string;
  started_at: string;
  ended_at: string;
  quality: number | null;
  notes: string;
};

type FormState = {
  bedtime: string;
  fell_asleep_at: string;
  wake_time: string;
  out_of_bed_at: string;
  sleep_quality: number | null;
  awakenings_count: number | null;
  notes: string;
  energy_level: number | null;
  mood_level: number | null;
  rested_level: number | null;
  caffeine_used: boolean | null;
  caffeine_amount: string | null;
  caffeine_last_time: string;
  screen_before_bed: boolean | null;
  phone_in_bed: boolean | null;
  phone_activity: string | null;
  exercise_done: boolean | null;
  outdoor_time: boolean | null;
  previous_evening_notes: string;
  reasons: string[];
  naps: NapDraft[];
};

function newKey() {
  return Math.random().toString(36).slice(2);
}

function buildState(log: DayLog | null | undefined, timezone: string, date: string): FormState {
  const sleep = log?.sleep ?? null;
  const checkin = log?.checkin ?? null;
  return {
    bedtime: isoToZonedInput(sleep?.bedtime, timezone) || `${date}T22:30`,
    fell_asleep_at: isoToZonedInput(sleep?.fell_asleep_at, timezone),
    wake_time: isoToZonedInput(sleep?.wake_time, timezone) || `${date}T07:00`,
    out_of_bed_at: isoToZonedInput(sleep?.out_of_bed_at, timezone),
    sleep_quality: sleep?.sleep_quality ?? null,
    awakenings_count: sleep?.awakenings_count ?? null,
    notes: sleep?.notes ?? "",
    energy_level: checkin?.energy_level ?? null,
    mood_level: checkin?.mood_level ?? null,
    rested_level: checkin?.rested_level ?? null,
    caffeine_used: checkin ? checkin.caffeine_used : null,
    caffeine_amount: checkin?.caffeine_amount ?? null,
    caffeine_last_time: isoToZonedInput(checkin?.caffeine_last_time, timezone),
    screen_before_bed: checkin?.screen_before_bed ?? null,
    phone_in_bed: checkin?.phone_in_bed ?? null,
    phone_activity: checkin?.phone_activity ?? null,
    exercise_done: checkin?.exercise_done ?? null,
    outdoor_time: checkin?.outdoor_time ?? null,
    previous_evening_notes: checkin?.previous_evening_notes ?? "",
    reasons: (log?.reasons ?? []).map((r) => r.reason),
    naps: (log?.naps ?? []).map((nap) => ({
      key: nap.id,
      started_at: isoToZonedInput(nap.started_at, timezone),
      ended_at: isoToZonedInput(nap.ended_at, timezone),
      quality: nap.quality,
      notes: nap.notes ?? "",
    })),
  };
}

export function DayForm({
  date,
  timezone,
  log,
  saving,
  submitLabel,
  onSubmit,
}: {
  date: string;
  timezone: string;
  log: DayLog | null | undefined;
  saving: boolean;
  submitLabel: string;
  onSubmit: (input: DayLogInput) => void;
}) {
  const [state, setState] = useState<FormState>(() => buildState(log, timezone, date));

  // Re-seed when the day or the loaded record changes (e.g. editing another day).
  useEffect(() => {
    setState(buildState(log, timezone, date));
  }, [log?.sleep?.id, log?.checkin?.id, log?.naps?.length, log?.reasons?.length, date, timezone]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const iso = (local: string) => zonedInputToISO(local, timezone);

  const latency = useMemo(
    () => minutesBetween(iso(state.bedtime), iso(state.fell_asleep_at)),
    [state.bedtime, state.fell_asleep_at, timezone],
  );
  const nightMinutes = useMemo(
    () => minutesBetween(iso(state.fell_asleep_at) ?? iso(state.bedtime), iso(state.wake_time)),
    [state.fell_asleep_at, state.bedtime, state.wake_time, timezone],
  );
  const napMinutes = useMemo(
    () =>
      state.naps.reduce(
        (total, nap) => total + (minutesBetween(iso(nap.started_at), iso(nap.ended_at)) ?? 0),
        0,
      ),
    [state.naps, timezone],
  );

  function addNap() {
    setState((prev) => ({
      ...prev,
      naps: [
        ...prev.naps,
        { key: newKey(), started_at: `${date}T14:00`, ended_at: `${date}T14:30`, quality: null, notes: "" },
      ],
    }));
  }

  function updateNap(key: string, patch: Partial<NapDraft>) {
    setState((prev) => ({
      ...prev,
      naps: prev.naps.map((nap) => (nap.key === key ? { ...nap, ...patch } : nap)),
    }));
  }

  function removeNap(key: string) {
    setState((prev) => ({ ...prev, naps: prev.naps.filter((nap) => nap.key !== key) }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    for (const nap of state.naps) {
      if (!nap.started_at || !nap.ended_at) {
        toast.error("Each nap needs a start and an end time.");
        return;
      }
      const mins = minutesBetween(iso(nap.started_at), iso(nap.ended_at));
      if (!mins || mins <= 0) {
        toast.error("A nap's end time has to come after its start time.");
        return;
      }
    }

    const naps: NapInput[] = state.naps.map((nap) => ({
      started_at: iso(nap.started_at),
      ended_at: iso(nap.ended_at),
      quality: nap.quality,
      notes: nap.notes.trim() || null,
    }));

    onSubmit({
      date,
      sleep: {
        bedtime: iso(state.bedtime),
        fell_asleep_at: iso(state.fell_asleep_at),
        wake_time: iso(state.wake_time),
        out_of_bed_at: iso(state.out_of_bed_at),
        sleep_quality: state.sleep_quality,
        awakenings_count: state.awakenings_count,
        notes: state.notes.trim() || null,
      },
      checkin: {
        energy_level: state.energy_level,
        mood_level: state.mood_level,
        rested_level: state.rested_level,
        caffeine_used: state.caffeine_used === true,
        caffeine_amount: state.caffeine_used ? state.caffeine_amount : null,
        caffeine_last_time: state.caffeine_used ? iso(state.caffeine_last_time) : null,
        screen_before_bed: state.screen_before_bed,
        phone_in_bed: state.phone_in_bed,
        phone_activity: state.phone_in_bed ? state.phone_activity : null,
        exercise_done: state.exercise_done,
        outdoor_time: state.outdoor_time,
        previous_evening_notes: state.previous_evening_notes.trim() || null,
      },
      naps,
      reasons: state.reasons.map((reason) => ({ reason })),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SectionCard title="Your night" icon={Moon}>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeField
            id="bedtime"
            label="Went to bed"
            value={state.bedtime}
            onChange={(v) => set("bedtime", v)}
          />
          <DateTimeField
            id="fell-asleep"
            label="Fell asleep (if you know)"
            value={state.fell_asleep_at}
            onChange={(v) => set("fell_asleep_at", v)}
          />
          <DateTimeField
            id="wake-time"
            label="Woke up"
            value={state.wake_time}
            onChange={(v) => set("wake_time", v)}
          />
          <DateTimeField
            id="out-of-bed"
            label="Got out of bed"
            value={state.out_of_bed_at}
            onChange={(v) => set("out_of_bed_at", v)}
          />
        </div>

        <dl className="mt-4 grid gap-3 rounded-2xl bg-secondary/60 p-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Time asleep</dt>
            <dd className="text-lg font-medium">{formatDuration(nightMinutes)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Time to fall asleep</dt>
            <dd className="text-lg font-medium">{formatDuration(latency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Including naps</dt>
            <dd className="text-lg font-medium">
              {formatDuration(nightMinutes == null ? null : nightMinutes + napMinutes)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 space-y-4">
          <ScalePicker
            label="How was the quality of your sleep?"
            value={state.sleep_quality}
            onChange={(v) => set("sleep_quality", v)}
            labels={QUALITY_LABELS}
          />
          <ChoiceGroup<number>
            label="Did you wake up during the night?"
            value={state.awakenings_count}
            options={AWAKENING_OPTIONS}
            onChange={(v) => set("awakenings_count", v)}
          />
        </div>
      </SectionCard>

      <SectionCard title="How today feels" icon={Sun}>
        <div className="space-y-4">
          <ScalePicker
            label="Energy"
            value={state.energy_level}
            onChange={(v) => set("energy_level", v)}
          />
          <ScalePicker label="Mood" value={state.mood_level} onChange={(v) => set("mood_level", v)} />
          <ScalePicker
            label="Rested"
            value={state.rested_level}
            onChange={(v) => set("rested_level", v)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Caffeine" icon={Coffee}>
        <div className="space-y-4">
          <YesNo
            label="Any caffeine yesterday?"
            value={state.caffeine_used}
            onChange={(v) => set("caffeine_used", v)}
          />
          {state.caffeine_used ? (
            <>
              <ChoiceGroup<string>
                label="How much?"
                value={state.caffeine_amount}
                options={CAFFEINE_AMOUNTS.map((a) => ({ label: a, value: a }))}
                onChange={(v) => set("caffeine_amount", v)}
              />
              <DateTimeField
                id="caffeine-last"
                label="Last one was at"
                value={state.caffeine_last_time}
                onChange={(v) => set("caffeine_last_time", v)}
              />
            </>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Evening & screens" icon={Smartphone}>
        <div className="space-y-4">
          <YesNo
            label="Screens in the hour before bed?"
            value={state.screen_before_bed}
            onChange={(v) => set("screen_before_bed", v)}
          />
          <YesNo
            label="Phone in bed?"
            value={state.phone_in_bed}
            onChange={(v) => set("phone_in_bed", v)}
          />
          {state.phone_in_bed ? (
            <ChoiceGroup<string>
              label="What were you doing?"
              value={state.phone_activity}
              options={PHONE_ACTIVITIES.map((a) => ({ label: a, value: a }))}
              onChange={(v) => set("phone_activity", v)}
            />
          ) : null}
          <YesNo
            label="Did you move your body yesterday?"
            value={state.exercise_done}
            onChange={(v) => set("exercise_done", v)}
          />
          <YesNo
            label="Any time outdoors?"
            value={state.outdoor_time}
            onChange={(v) => set("outdoor_time", v)}
          />
          <Field label="Anything about last evening?" htmlFor="evening-notes">
            <Textarea
              id="evening-notes"
              value={state.previous_evening_notes}
              onChange={(e) => set("previous_evening_notes", e.target.value)}
              placeholder="Only if you feel like writing something."
              rows={3}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="If you were awake" icon={Moon}>
        <MultiChoice
          label="What kept you up? Pick as many as you like."
          values={state.reasons}
          options={SLEEP_REASONS.map((r) => ({ label: r.label, value: r.value }))}
          onToggle={(value) =>
            set(
              "reasons",
              state.reasons.includes(value)
                ? state.reasons.filter((r) => r !== value)
                : [...state.reasons, value],
            )
          }
        />
      </SectionCard>

      <SectionCard title="Naps" icon={Sun} hint="Add as many as you had. Leave empty if you didn't nap.">
        <div className="space-y-4">
          {state.naps.map((nap, index) => {
            const mins = minutesBetween(iso(nap.started_at), iso(nap.ended_at));
            return (
              <div key={nap.key} className="rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Nap {index + 1}
                    <span className="ml-2 text-muted-foreground">{formatDuration(mins)}</span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeNap(nap.key)}
                    aria-label={`Remove nap ${index + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <DateTimeField
                    id={`nap-start-${nap.key}`}
                    label="Started"
                    value={nap.started_at}
                    onChange={(v) => updateNap(nap.key, { started_at: v })}
                  />
                  <DateTimeField
                    id={`nap-end-${nap.key}`}
                    label="Ended"
                    value={nap.ended_at}
                    onChange={(v) => updateNap(nap.key, { ended_at: v })}
                  />
                </div>
                <div className="mt-4 space-y-4">
                  <ScalePicker
                    label="How did it feel?"
                    value={nap.quality}
                    onChange={(v) => updateNap(nap.key, { quality: v })}
                    labels={QUALITY_LABELS}
                  />
                  <Field label="Note" htmlFor={`nap-notes-${nap.key}`}>
                    <Textarea
                      id={`nap-notes-${nap.key}`}
                      value={nap.notes}
                      onChange={(e) => updateNap(nap.key, { notes: e.target.value })}
                      rows={2}
                    />
                  </Field>
                </div>
              </div>
            );
          })}
          <Button type="button" variant="outline" onClick={addNap} className="w-full sm:w-auto">
            <Plus className="size-4" aria-hidden="true" />
            Add a nap
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Private note" icon={Moon}>
        <Field label="Anything else about the night?" htmlFor="sleep-notes">
          <Textarea
            id="sleep-notes"
            value={state.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Just for you."
            rows={3}
          />
        </Field>
      </SectionCard>

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <Button type="submit" size="lg" disabled={saving} className="w-full shadow-lift">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

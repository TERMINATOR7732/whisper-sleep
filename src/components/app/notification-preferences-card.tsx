import { useState, useEffect } from "react";
import { Bell, Flame, Loader2, Moon, Sparkles, Sun, VolumeX } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/use-notifications";

function formatTimeValue(timeStr?: string | null, fallback = "20:00"): string {
  if (!timeStr) return fallback;
  return timeStr.slice(0, 5);
}

function normalizeTimeToDb(val: string): string {
  if (!val) return val;
  if (val.length === 5) return `${val}:00`;
  return val;
}

export function NotificationPreferencesCard() {
  const { preferences, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();

  const [checkinEnabled, setCheckinEnabled] = useState(DEFAULT_NOTIFICATION_PREFERENCES.checkin_reminders_enabled);
  const [checkinTime, setCheckinTime] = useState(DEFAULT_NOTIFICATION_PREFERENCES.checkin_reminder_time);

  const [windDownEnabled, setWindDownEnabled] = useState(DEFAULT_NOTIFICATION_PREFERENCES.wind_down_reminders_enabled);
  const [windDownTime, setWindDownTime] = useState(DEFAULT_NOTIFICATION_PREFERENCES.wind_down_reminder_time);

  const [streakEnabled, setStreakEnabled] = useState(DEFAULT_NOTIFICATION_PREFERENCES.streak_reminders_enabled);

  const [quietHoursEnabled, setQuietHoursEnabled] = useState(DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_enabled);
  const [quietHoursStart, setQuietHoursStart] = useState(DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_start);
  const [quietHoursEnd, setQuietHoursEnd] = useState(DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_end);

  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (preferences) {
      setCheckinEnabled(preferences.checkin_reminders_enabled);
      setCheckinTime(formatTimeValue(preferences.checkin_reminder_time, "20:00"));
      setWindDownEnabled(preferences.wind_down_reminders_enabled);
      setWindDownTime(formatTimeValue(preferences.wind_down_reminder_time, "22:30"));
      setStreakEnabled(preferences.streak_reminders_enabled);
      setQuietHoursEnabled(preferences.quiet_hours_enabled);
      setQuietHoursStart(formatTimeValue(preferences.quiet_hours_start, "22:00"));
      setQuietHoursEnd(formatTimeValue(preferences.quiet_hours_end, "07:00"));
    }
  }, [preferences]);

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSaveError(null);

    try {
      await updateMutation.mutateAsync({
        checkin_reminders_enabled: checkinEnabled,
        checkin_reminder_time: normalizeTimeToDb(checkinTime),
        wind_down_reminders_enabled: windDownEnabled,
        wind_down_reminder_time: normalizeTimeToDb(windDownTime),
        streak_reminders_enabled: streakEnabled,
        quiet_hours_enabled: quietHoursEnabled,
        quiet_hours_start: normalizeTimeToDb(quietHoursStart),
        quiet_hours_end: normalizeTimeToDb(quietHoursEnd),
      });
      toast.success("Reminder preferences saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't save reminder preferences.";
      setSaveError(msg);
      toast.error(msg);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-2xl" />;
  }

  return (
    <SectionCard
      title="In-App Reminders"
      icon={Bell}
      hint="Gentle contextual prompts shown inside Nightly while you are using the app. No lock-screen push notifications or noisy alerts."
    >
      <form onSubmit={handleSave} className="space-y-6">
        {/* Daily Check-in Reminder */}
        <div className="rounded-xl border border-border/60 p-4 transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sun className="size-4 text-primary" aria-hidden="true" />
                <Label htmlFor="toggle-checkin" className="text-sm font-medium text-foreground cursor-pointer">
                  Daily check-in reminder
                </Label>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Shows a gentle reminder on Home if today's check-in has not been recorded yet.
              </p>
            </div>
            <Switch
              id="toggle-checkin"
              checked={checkinEnabled}
              onCheckedChange={setCheckinEnabled}
              aria-label="Toggle daily check-in reminders"
            />
          </div>

          {checkinEnabled ? (
            <div className="mt-3.5 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
              <Label htmlFor="checkin-time" className="text-xs text-muted-foreground">
                Remind after
              </Label>
              <Input
                id="checkin-time"
                type="time"
                value={checkinTime}
                onChange={(e) => setCheckinTime(e.target.value)}
                className="w-32 text-center text-xs h-8"
              />
            </div>
          ) : null}
        </div>

        {/* Evening Wind-down Reminder */}
        <div className="rounded-xl border border-border/60 p-4 transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Moon className="size-4 text-primary" aria-hidden="true" />
                <Label htmlFor="toggle-wind-down" className="text-sm font-medium text-foreground cursor-pointer">
                  Evening wind-down reminder
                </Label>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                A calm nudge when it is time for your evening wind-down routine.
              </p>
            </div>
            <Switch
              id="toggle-wind-down"
              checked={windDownEnabled}
              onCheckedChange={setWindDownEnabled}
              aria-label="Toggle wind-down reminders"
            />
          </div>

          {windDownEnabled ? (
            <div className="mt-3.5 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
              <Label htmlFor="wind-down-time" className="text-xs text-muted-foreground">
                Remind after
              </Label>
              <Input
                id="wind-down-time"
                type="time"
                value={windDownTime}
                onChange={(e) => setWindDownTime(e.target.value)}
                className="w-32 text-center text-xs h-8"
              />
            </div>
          ) : null}
        </div>

        {/* Streak Rhythm Reminder */}
        <div className="rounded-xl border border-border/60 p-4 transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-amber-500" aria-hidden="true" />
                <Label htmlFor="toggle-streak" className="text-sm font-medium text-foreground cursor-pointer">
                  Streak rhythm reminder
                </Label>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Encourages your check-in rhythm when you have an active streak waiting for today.
              </p>
            </div>
            <Switch
              id="toggle-streak"
              checked={streakEnabled}
              onCheckedChange={setStreakEnabled}
              aria-label="Toggle streak rhythm reminders"
            />
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="rounded-xl border border-border/60 p-4 transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <VolumeX className="size-4 text-muted-foreground" aria-hidden="true" />
                <Label htmlFor="toggle-quiet-hours" className="text-sm font-medium text-foreground cursor-pointer">
                  Quiet hours
                </Label>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Silences all in-app reminder prompts during your resting window.
              </p>
            </div>
            <Switch
              id="toggle-quiet-hours"
              checked={quietHoursEnabled}
              onCheckedChange={setQuietHoursEnabled}
              aria-label="Toggle quiet hours"
            />
          </div>

          {quietHoursEnabled ? (
            <div className="mt-3.5 pt-3 border-t border-border/40 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="quiet-start" className="text-xs text-muted-foreground">
                  From
                </Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                  className="text-center text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quiet-end" className="text-xs text-muted-foreground">
                  Until
                </Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                  className="text-center text-xs h-8"
                />
              </div>
            </div>
          ) : null}
        </div>

        {saveError ? (
          <p className="text-xs text-destructive">{saveError}</p>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={updateMutation.isPending}
            className="w-full sm:w-auto"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                Saving...
              </>
            ) : (
              "Save reminder preferences"
            )}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

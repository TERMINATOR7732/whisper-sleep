import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/app-shell";
import { RoleGate } from "@/components/app/role-gate";
import { DayForm } from "@/components/sleep/day-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import { useDayLog, useSaveDayLog } from "@/hooks/use-sleep";
import { formatDateLabel, safeTimezone, shiftDate, todayInTimezone } from "@/lib/sleep";

export const Route = createFileRoute("/_authenticated/check-in")({
  head: () => ({
    meta: [
      { title: "Check-in — Nightly" },
      { name: "description", content: "Log last night's sleep, naps, mood and energy in a minute." },
      { property: "og:title", content: "Check-in — Nightly" },
      { property: "og:description", content: "Log last night's sleep, naps, mood and energy in a minute." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGate role="user">
      <CheckInPage />
    </RoleGate>
  ),
});

function CheckInPage() {
  const { data: profile } = useProfile();
  const timezone = safeTimezone(profile?.timezone);
  const today = todayInTimezone(timezone);
  const [date, setDate] = useState(today);
  const [saved, setSaved] = useState(false);

  const { data: log, isLoading } = useDayLog(date);
  const save = useSaveDayLog();

  const isToday = date === today;

  return (
    <div className="space-y-4">
      <PageHeader title="Check-in" subtitle="A minute or two, once a day. Nothing more." />

      <div className="card-soft flex items-center justify-between gap-2 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSaved(false);
            setDate(shiftDate(date, -1));
          }}
          aria-label="Previous day"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <p className="text-center text-sm font-medium">
          {isToday ? "Today" : formatDateLabel(date, timezone)}
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={isToday}
          onClick={() => {
            setSaved(false);
            setDate(shiftDate(date, 1));
          }}
          aria-label="Next day"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {saved ? (
        <div className="card-soft fade-rise space-y-4 p-6 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-xl">Saved — thank you</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateLabel(date, timezone)} is recorded. Rest easy.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to="/home">Back to home</Link>
            </Button>
            <Button variant="outline" onClick={() => setSaved(false)}>
              Keep editing
            </Button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <DayForm
          date={date}
          timezone={timezone}
          log={log}
          saving={save.isPending}
          submitLabel={log?.sleep || log?.checkin ? "Update this day" : "Save my check-in"}
          onSubmit={(input) =>
            save.mutate(input, {
              onSuccess: () => setSaved(true),
              onError: (error) =>
                toast.error(error instanceof Error ? error.message : "We couldn't save that."),
            })
          }
        />
      )}
    </div>
  );
}

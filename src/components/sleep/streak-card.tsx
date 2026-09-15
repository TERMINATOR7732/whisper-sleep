import { Link } from "@tanstack/react-router";
import { Check, Flame, Trophy } from "lucide-react";

import { SectionCard } from "@/components/app/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStreak } from "@/hooks/use-streak";
import { cn } from "@/lib/utils";

export function StreakCard() {
  const { streak, isLoading } = useStreak();

  if (isLoading) {
    return <Skeleton className="h-36 w-full rounded-2xl" />;
  }

  const current = streak?.current_streak ?? 0;
  const longest = streak?.longest_streak ?? 0;
  const checkedToday = streak?.checked_in_today ?? false;
  const recentDays = streak?.recent_days ?? [];

  return (
    <SectionCard
      title="Check-in Streak"
      icon={Flame}
      className="relative overflow-hidden"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              {current} {current === 1 ? "day" : "days"}
            </span>
            {longest > 0 ? (
              <Badge variant="secondary" className="gap-1 text-xs font-normal">
                <Trophy className="size-3 text-amber-500" aria-hidden="true" />
                Best: {longest} {longest === 1 ? "day" : "days"}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {current === 0
              ? longest > 0
                ? "Your streak paused. Today is a calm opportunity to restart."
                : "Complete a daily check-in to begin your streak."
              : checkedToday
                ? "Today's check-in complete. Wonderful consistency."
                : "Check in today to keep your streak going."}
          </p>
        </div>

        {!checkedToday ? (
          <div>
            <Button asChild size="sm" variant={current > 0 ? "default" : "outline"}>
              <Link to="/check-in">
                {current > 0 ? "Check in today" : "Start check-in"}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      {/* 7-day strip */}
      {recentDays.length > 0 ? (
        <div className="mt-4 border-t border-border/50 pt-3">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {recentDays.map((day) => (
              <div
                key={day.date}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg px-1 py-1.5 text-center transition-colors",
                  day.is_today && "bg-primary/5 ring-1 ring-primary/20",
                )}
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  {day.day_label}
                </span>
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs transition-all",
                    day.completed
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : day.is_today
                        ? "border border-dashed border-primary/50 text-muted-foreground"
                        : "bg-muted/50 text-muted-foreground/40",
                  )}
                  title={`${day.date}: ${day.completed ? "Checked in" : "Not checked in"}`}
                >
                  {day.completed ? (
                    <Check className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                  ) : day.is_today ? (
                    <span className="size-1.5 rounded-full bg-primary/60" />
                  ) : (
                    <span className="size-1 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/70">
                  {day.is_today ? "Today" : day.date.slice(8)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

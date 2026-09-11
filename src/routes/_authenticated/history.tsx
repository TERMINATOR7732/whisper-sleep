import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Moon } from "lucide-react";

import { PageHeader } from "@/components/app/app-shell";
import { EmptyState } from "@/components/app/empty-state";
import { RoleGate } from "@/components/app/role-gate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import { useSleepHistory } from "@/hooks/use-sleep";
import { QUALITY_LABELS, formatDateLabel, formatDuration, safeTimezone } from "@/lib/sleep";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Your nights — Nightly" },
      { name: "description", content: "Every night you've recorded, newest first." },
      { property: "og:title", content: "Your nights — Nightly" },
      { property: "og:description", content: "Every night you've recorded, newest first." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGate role="user">
      <HistoryPage />
    </RoleGate>
  ),
});

function HistoryPage() {
  const { data: profile } = useProfile();
  const timezone = safeTimezone(profile?.timezone);
  const { data: items, isLoading, error } = useSleepHistory(60);

  return (
    <div className="space-y-4">
      <PageHeader title="Your nights" subtitle="Tap any night to look again or change something." />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="card-soft p-6 text-sm text-muted-foreground">
          We couldn't load your nights just now. Please refresh and try again.
        </div>
      ) : !items || items.length === 0 ? (
        <div className="card-soft fade-rise">
          <EmptyState
            icon={CalendarDays}
            title="Nothing recorded yet"
            description="Your nights will collect here as soon as you start checking in."
          >
            <Button asChild className="mt-2">
              <Link to="/check-in">Log your sleep</Link>
            </Button>
          </EmptyState>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const total =
              item.sleep?.total_sleep_minutes == null
                ? item.napMinutes || null
                : item.sleep.total_sleep_minutes + item.napMinutes;
            return (
              <li key={item.date}>
                <Link
                  to="/day/$date"
                  params={{ date: item.date }}
                  className="card-soft fade-rise flex items-center gap-4 p-4 transition-shadow hover:shadow-lift"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <Moon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {formatDateLabel(item.date, timezone)}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {formatDuration(total)}
                      {item.sleep?.sleep_quality
                        ? ` · ${QUALITY_LABELS[item.sleep.sleep_quality]}`
                        : ""}
                      {item.napMinutes ? ` · naps ${formatDuration(item.napMinutes)}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Calendar,
  Coffee,
  HelpCircle,
  Info,
  Moon,
  Smartphone,
  Sparkles,
  Sunrise,
  Tv,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";

import { PageHeader } from "@/components/app/app-shell";
import { EmptyState } from "@/components/app/empty-state";
import { RoleGate } from "@/components/app/role-gate";
import { SectionCard } from "@/components/app/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import { useSleepHistory } from "@/hooks/use-sleep";
import { toDayRecords } from "@/lib/day-records";
import {
  CONFIDENCE_LABELS,
  generatePatterns,
  observationLine,
  type Confidence,
  type Pattern,
  type PatternCategory,
} from "@/lib/patterns";
import { formatDateLabel, safeTimezone } from "@/lib/sleep";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Nightly" },
      { name: "description", content: "Plain-language observations and patterns from your recorded nights." },
      { property: "og:title", content: "Insights — Nightly" },
      { property: "og:description", content: "Plain-language observations and patterns from your recorded nights." },
    ],
  }),
  component: () => (
    <RoleGate role="user">
      <InsightsPage />
    </RoleGate>
  ),
});

const CATEGORY_META: Record<PatternCategory, { label: string; icon: LucideIcon }> = {
  caffeine: { label: "Caffeine", icon: Coffee },
  phone_usage: { label: "Phone in bed", icon: Smartphone },
  screens: { label: "Evening screens", icon: Tv },
  naps: { label: "Daytime naps", icon: Moon },
  stress: { label: "Daytime stress", icon: Activity },
  reasons: { label: "Night awakenings", icon: HelpCircle },
  next_day: { label: "Next-day effect", icon: Sunrise },
  weekend: { label: "Weekend rhythm", icon: Calendar },
};

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const label = CONFIDENCE_LABELS[confidence] ?? confidence;
  if (confidence === "strong") {
    return (
      <Badge variant="default" className="text-xs font-normal">
        {label}
      </Badge>
    );
  }
  if (confidence === "moderate") {
    return (
      <Badge variant="secondary" className="text-xs font-normal">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
      {label}
    </Badge>
  );
}

function PatternCard({ pattern, timezone }: { pattern: Pattern; timezone: string }) {
  const meta = CATEGORY_META[pattern.category] ?? { label: "Observation", icon: Sparkles };
  const Icon = meta.icon;

  const dateSpan =
    pattern.from && pattern.to && pattern.from !== pattern.to
      ? `${formatDateLabel(pattern.from, timezone)} – ${formatDateLabel(pattern.to, timezone)}`
      : null;

  return (
    <article className="card-soft fade-rise space-y-3 p-5 transition-shadow duration-300 hover:shadow-lift sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
            {meta.label}
          </span>
        </div>
        <ConfidenceBadge confidence={pattern.confidence} />
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground">{pattern.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">{pattern.observation}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span>{pattern.stat || observationLine(pattern)}</span>
        {dateSpan ? <span>{dateSpan}</span> : null}
      </div>
    </article>
  );
}

function InsightsPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: history, isLoading: historyLoading, error } = useSleepHistory(60);

  const timezone = safeTimezone(profile?.timezone);
  const days = useMemo(() => toDayRecords(history ?? [], timezone), [history, timezone]);
  const patterns = useMemo(() => generatePatterns(days), [days]);

  const isLoading = profileLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Insights" subtitle="Gentle observations, written like a friend would say them." />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Insights" subtitle="Gentle observations, written like a friend would say them." />
        <div className="card-soft p-5 text-sm text-destructive">
          We couldn't load your sleep patterns right now. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Insights" subtitle="Gentle observations, written like a friend would say them." />

      {days.length === 0 ? (
        <div className="space-y-4">
          <div className="card-soft fade-rise p-6 text-center">
            <EmptyState
              icon={Sparkles}
              title="Nothing to notice yet"
              description="Once you start recording your nights and daily check-ins, Nightly will begin highlighting patterns in what helps and what disrupts your rest."
            >
              <Button asChild className="mt-4">
                <Link to="/check-in">Log your sleep</Link>
              </Button>
            </EmptyState>
          </div>

          <SectionCard
            title="What Nightly looks for"
            icon={Info}
            hint="As your logs accumulate, Nightly watches for gentle, honest associations:"
          >
            <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Caffeine timing and nighttime sleep length
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Screens and phone use before sleep
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Daytime naps and subsequent bedtime
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Weekend vs weekday sleep schedule drift
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Stress levels and next-day energy or mood
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Recurring reasons for being awake
              </li>
            </ul>
          </SectionCard>
        </div>
      ) : days.length < 6 ? (
        <div className="space-y-4">
          <div className="card-soft fade-rise space-y-4 p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-foreground">Still learning your patterns</h2>
                <p className="text-xs text-muted-foreground">
                  {days.length} of 6 nights recorded for early patterns
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Progress value={(days.length / 6) * 100} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{days.length} {days.length === 1 ? "night" : "nights"} logged</span>
                <span>6 nights needed for early signals</span>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">
              Meaningful comparisons need at least a few nights with different habits (for example, days with caffeine versus without) so the app can compare them honestly. Keep logging your sleep each morning.
            </p>

            <div className="pt-2">
              <Button asChild size="sm">
                <Link to="/check-in">Log today's check-in</Link>
              </Button>
            </div>
          </div>

          <SectionCard
            title="What Nightly looks for"
            icon={Info}
            hint="As your history grows past 6 nights, observations like these will appear automatically:"
          >
            <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Caffeine timing and nighttime sleep length
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Screens and phone use before sleep
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Daytime naps and subsequent bedtime
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Weekend vs weekday sleep schedule drift
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Stress levels and next-day energy or mood
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Recurring reasons for being awake
              </li>
            </ul>
          </SectionCard>
        </div>
      ) : patterns.length === 0 ? (
        <div className="space-y-4">
          <div className="card-soft fade-rise space-y-4 p-6 text-center sm:p-7">
            <EmptyState
              icon={Sparkles}
              title="No clear patterns yet"
              description={`Based on your ${days.length} recorded nights, your sleep and habits appear fairly steady. There were no noticeable differences between days with varying habits (like caffeine or evening screens) that met our confidence threshold.`}
            >
              <p className="mt-2 text-xs text-muted-foreground">
                That is good news — steadiness is great for rest. As you continue to check in, any subtle patterns will appear here.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/check-in">Log today's check-in</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/history">View your sleep history</Link>
                </Button>
              </div>
            </EmptyState>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card-soft fade-rise flex flex-wrap items-center justify-between gap-3 bg-secondary/30 p-4 sm:p-5">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                {patterns.length} {patterns.length === 1 ? "pattern" : "patterns"} observed
              </p>
              <p className="text-xs text-muted-foreground">
                Drawn from {days.length} recorded nights. Confidence is based on sample size and effect size.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/check-in">Log check-in</Link>
            </Button>
          </div>

          <div className="grid gap-4">
            {patterns.map((pattern) => (
              <PatternCard key={pattern.id} pattern={pattern} timezone={timezone} />
            ))}
          </div>

          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              <strong>About these observations:</strong> These patterns describe mathematical associations in your logs over time. Because everyday life has many factors, they are gentle cues rather than medical causes. If you have persistent sleep concerns, please speak with a healthcare provider.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

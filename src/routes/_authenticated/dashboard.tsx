import { createFileRoute } from "@tanstack/react-router";
import { Activity, CalendarClock, Heart, Lock, Moon, Sunrise } from "lucide-react";

import { PageHeader } from "@/components/app/app-shell";
import { EmptyState } from "@/components/app/empty-state";
import { RoleGate } from "@/components/app/role-gate";
import { PlaceholderRow, SectionCard } from "@/components/app/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type SharedRecoveryStatus,
  type SharedResetPlan,
  useLinkedUserId,
  useSharedRecoveryStatus,
  useSharedResetPlan,
} from "@/hooks/use-shared";
import { formatTimeLabel } from "@/lib/reset";
import { formatDateLabel, formatDuration } from "@/lib/sleep";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Her sleep — Nightly" },
      { name: "description", content: "See only what she has chosen to share with you — nothing more, nothing by default." },
      { property: "og:title", content: "Her sleep — Nightly" },
      { property: "og:description", content: "See only what she has chosen to share with you." },
    ],
  }),
  component: () => (
    <RoleGate role="partner">
      <PartnerDashboard />
    </RoleGate>
  ),
});

function PartnerDashboard() {
  const { data: linkedUserId, isLoading: relationshipLoading, error: relationshipError } = useLinkedUserId();
  const resetPlan = useSharedResetPlan(linkedUserId);
  const recovery = useSharedRecoveryStatus(linkedUserId);

  return (
    <div className="space-y-4">
      <PageHeader
        title={<><span>Her Sleep</span> <Heart className="inline size-6 text-primary" aria-hidden="true" /></>}
        subtitle="A quiet way to support her — with only the details she decides to share."
      />

      {relationshipLoading ? <Skeleton className="h-40 w-full rounded-2xl" /> : null}
      {relationshipError ? <div className="card-soft p-5 text-sm text-destructive">{relationshipError.message || "We couldn't check your connection right now. Please try again."}</div> : null}
      {!relationshipLoading && !relationshipError && !linkedUserId ? (
        <div className="card-soft fade-rise">
          <EmptyState icon={Lock} title="No active connection" description="This space stays private until there is an active connection and she chooses something to share." />
        </div>
      ) : null}
      {linkedUserId ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <ResetPlanCard data={resetPlan.data} isLoading={resetPlan.isLoading} error={resetPlan.error} />
          <RecoveryStatusCard data={recovery.data} isLoading={recovery.isLoading} error={recovery.error} />
        </div>
      ) : null}

      <SectionCard title="How sharing works" icon={Lock}>
        <PlaceholderRow label="Default" note="Nothing is shared" />
        <PlaceholderRow label="She chooses" note="Each detail, one by one" />
        <PlaceholderRow label="Any time" note="She can turn sharing off" />
      </SectionCard>
    </div>
  );
}

function ResetPlanCard({ data, isLoading, error }: { data: SharedResetPlan | undefined; isLoading: boolean; error: Error | null }) {
  if (isLoading) return <Skeleton className="h-56 w-full rounded-2xl" />;
  if (error) return <SectionCard title="Reset plan" icon={CalendarClock} hint={error.message || "We couldn't load the shared reset plan."} />;
  if (!data?.shared) return <SectionCard title="Reset plan" icon={Lock} hint="She hasn't shared her reset plan right now." />;
  if (!data.has_plan) return <SectionCard title="Reset plan" icon={CalendarClock} hint="A reset plan is shared, but there isn't an active plan at the moment." />;

  return (
    <SectionCard title="Reset plan" icon={CalendarClock} hint="These are the schedule details she chose to share.">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <Metric label="Sleep goal" value={formatDuration(data.desired_sleep_minutes)} />
        <Metric label="Pace" value={data.adjustment_pace ?? "—"} />
        <Metric label="Target bedtime" value={formatTimeLabel(data.target_bedtime)} />
        <Metric label="Target wake time" value={formatTimeLabel(data.target_wake_time)} />
        <Metric label="Started" value={data.started_on ? formatDateLabel(data.started_on, "UTC") : "—"} />
        <Metric label="Schedule steps" value={data.stages?.length ? `${data.stages.length} steps` : "—"} />
      </div>
    </SectionCard>
  );
}

function RecoveryStatusCard({ data, isLoading, error }: { data: SharedRecoveryStatus | undefined; isLoading: boolean; error: Error | null }) {
  if (isLoading) return <Skeleton className="h-56 w-full rounded-2xl" />;
  if (error) return <SectionCard title="Recovery status" icon={Activity} hint={error.message || "We couldn't load the shared recovery status."} />;
  if (!data?.shared) return <SectionCard title="Recovery status" icon={Lock} hint="Recovery status isn't shared right now." />;
  if (data.status === "unknown" || !data.status) return <SectionCard title="Recovery status" icon={Sunrise} hint="She has shared this status, but there isn't enough information to show it yet." />;

  const isRough = data.status === "rough";
  return (
    <SectionCard title={isRough ? "A rough night" : "Recovery status"} icon={isRough ? Moon : Sunrise} hint={isRough ? "She may be taking a gentler day today." : "Her current recovery status looks okay."}>
      {data.as_of ? <p className="text-xs text-muted-foreground">Status for {formatDateLabel(data.as_of, "UTC")}</p> : null}
    </SectionCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium text-foreground">{value}</p></div>;
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/app-shell";
import { EmptyState } from "@/components/app/empty-state";
import { RoleGate } from "@/components/app/role-gate";
import { DayForm } from "@/components/sleep/day-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import { useDayLog, useDeleteDayLog, useSaveDayLog } from "@/hooks/use-sleep";
import { formatDateLabel, safeTimezone } from "@/lib/sleep";

export const Route = createFileRoute("/_authenticated/day/$date")({
  head: () => ({
    meta: [
      { title: "A night in detail — Nightly" },
      { name: "description", content: "Look back at one night and change anything you'd like." },
      { property: "og:title", content: "A night in detail — Nightly" },
      { property: "og:description", content: "Look back at one night and change anything you'd like." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGate role="user">
      <DayPage />
    </RoleGate>
  ),
});

function DayPage() {
  const { date } = Route.useParams();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const timezone = safeTimezone(profile?.timezone);
  const { data: log, isLoading } = useDayLog(date);
  const save = useSaveDayLog();
  const remove = useDeleteDayLog();
  const [open, setOpen] = useState(false);

  const hasAnything = Boolean(log?.sleep || log?.checkin || (log?.naps?.length ?? 0) > 0);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/history">
          <ArrowLeft className="size-4" aria-hidden="true" />
          All nights
        </Link>
      </Button>

      <PageHeader
        title={formatDateLabel(date, timezone)}
        subtitle="Change anything here — it saves over the same day."
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {!hasAnything ? (
            <div className="card-soft">
              <EmptyState
                title="Nothing saved for this day yet"
                description="You can fill it in below whenever you like."
              />
            </div>
          ) : null}

          <DayForm
            date={date}
            timezone={timezone}
            log={log}
            saving={save.isPending}
            submitLabel="Save changes"
            onSubmit={(input) =>
              save.mutate(input, {
                onSuccess: () => toast.success("Saved."),
                onError: (error) =>
                  toast.error(error instanceof Error ? error.message : "We couldn't save that."),
              })
            }
          />

          {hasAnything ? (
            <AlertDialog open={open} onOpenChange={setOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full text-destructive hover:text-destructive">
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete this day
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this day?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Everything saved for {formatDateLabel(date, timezone)} will be removed. This can't be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      remove.mutate(date, {
                        onSuccess: () => {
                          toast.success("Deleted.");
                          navigate({ to: "/history" });
                        },
                        onError: (error) =>
                          toast.error(
                            error instanceof Error ? error.message : "We couldn't delete that.",
                          ),
                      })
                    }
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </>
      )}
    </div>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import type { AppRole } from "@/types/db";
import { AppShell } from "./app-shell";
import { homeFor } from "./nav-config";

/**
 * Renders the app shell only for the expected account role.
 * Sends un-onboarded accounts to onboarding, and the other role to its own home.
 */
export function RoleGate({ role, children }: { role?: AppRole; children: ReactNode }) {
  const { data: profile, isLoading, error } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || !profile) return;
    if (!profile.onboarded_at) {
      navigate({ to: "/onboarding", replace: true });
      return;
    }
    if (role && profile.role !== role) {
      navigate({ to: homeFor(profile.role), replace: true });
    }
  }, [isLoading, profile, role, navigate]);

  if (isLoading || (!profile && !error)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="font-display text-2xl">We couldn't load your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong reaching your profile. Please refresh and try again.
        </p>
      </div>
    );
  }

  if (role && profile && profile.role !== role) return null;
  if (profile && !profile.onboarded_at) return null;

  return <AppShell>{children}</AppShell>;
}

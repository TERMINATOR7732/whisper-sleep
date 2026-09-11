import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Heart, Moon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { homeFor } from "@/components/app/nav-config";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { TIMEZONES, detectTimezone } from "@/lib/timezones";
import type { AppRole } from "@/types/db";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set up your space — Nightly" },
      {
        name: "description",
        content: "Tell us what to call you, your timezone, and whether you're tracking or supporting.",
      },
      { property: "og:title", content: "Set up your space — Nightly" },
      { property: "og:description", content: "A few gentle questions to set up your Nightly space." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();

  const [displayName, setDisplayName] = useState("");
  const [nickname, setNickname] = useState("");
  const [timezone, setTimezone] = useState(detectTimezone());
  const [role, setRole] = useState<AppRole>("user");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!profile) return;
    if (profile.onboarded_at) {
      navigate({ to: homeFor(profile.role), replace: true });
      return;
    }
    setDisplayName((v) => v || profile.display_name || "");
    setNickname((v) => v || profile.nickname || "");
    setTimezone((v) => profile.timezone || v);
    setRole(profile.role ?? "user");
  }, [profile, navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const saved = await update.mutateAsync({
        display_name: displayName.trim(),
        nickname: nickname.trim() || null,
        timezone,
        role,
        onboarded_at: new Date().toISOString(),
      });
      navigate({ to: homeFor(saved.role), replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't save that. Please try again.");
    }
  }

  if (loading || isLoading) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <form onSubmit={onSubmit} className="card-soft fade-rise w-full max-w-md space-y-5 p-6 sm:p-7">
        <div>
          <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
            <Moon className="size-4" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-2xl">Let's set up your space</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Just a few details. Nothing here is shared with anyone unless you choose to.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display-name">What should we call you?</Label>
          <Input
            id="display-name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nickname">A nickname you like (optional)</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Something warmer"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Your timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone">
              <SelectValue placeholder="Choose a timezone" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Which one are you?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <RoleOption
              active={role === "user"}
              onClick={() => setRole("user")}
              icon={Moon}
              title="I track my sleep"
              body="Your nights stay private by default."
            />
            <RoleOption
              active={role === "partner"}
              onClick={() => setRole("partner")}
              icon={Heart}
              title="I'm the partner"
              body="You'll see only what's shared with you."
            />
          </div>
        </fieldset>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Continue"}
        </Button>
      </form>
    </div>
  );
}

function RoleOption({
  active,
  onClick,
  icon: Icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Moon;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border p-4 text-left transition-colors ${
        active ? "border-primary bg-secondary" : "border-border hover:bg-secondary/60"
      }`}
    >
      <Icon className="size-4 text-primary" aria-hidden="true" />
      <span className="mt-2 block text-sm font-medium">{title}</span>
      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{body}</span>
    </button>
  );
}

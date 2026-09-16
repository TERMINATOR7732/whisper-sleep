import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Download, LogOut, Palette, Shield, Target, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/app-shell";
import { RoleGate } from "@/components/app/role-gate";
import { PartnerConnectionSection } from "@/components/app/partner-connection-section";
import { PartnerSharingSection } from "@/components/app/partner-sharing-section";
import { NotificationPreferencesCard } from "@/components/app/notification-preferences-card";
import { PlaceholderRow, SectionCard } from "@/components/app/section-card";
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
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { signOutCleanly } from "@/lib/sign-out";
import { TIMEZONES } from "@/lib/timezones";
import { ROLE_LABELS } from "@/types/db";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Nightly" },
      { name: "description", content: "Your name, nickname, timezone and account role." },
      { property: "og:title", content: "Profile — Nightly" },
      { property: "og:description", content: "Your name, nickname, timezone and account role." },
    ],
  }),
  component: () => (
    <RoleGate>
      <ProfilePage />
    </RoleGate>
  ),
});

function ProfilePage() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [nickname, setNickname] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setNickname(profile.nickname ?? "");
    setTimezone(profile.timezone ?? "UTC");
  }, [profile]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        display_name: displayName.trim(),
        nickname: nickname.trim() || null,
        timezone,
      });
      toast.success("Profile saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't save that. Please try again.");
    }
  }

  async function onSignOut() {
    await signOutCleanly(queryClient);
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Profile" subtitle="How Nightly refers to you, and where your days begin." />

      <form onSubmit={onSave} className="card-soft fade-rise space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="p-display">Display name</Label>
          <Input id="p-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-nickname">Nickname</Label>
          <Input id="p-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-timezone">Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="p-timezone">
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
        <div className="space-y-1">
          <Label>Account role</Label>
          <p className="text-sm text-muted-foreground">
            {profile ? ROLE_LABELS[profile.role] : "—"} — this stays fixed for now.
          </p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="ghost" onClick={onSignOut}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </form>

      {profile?.role ? <PartnerConnectionSection role={profile.role} /> : null}

      {profile?.role === "user" ? <PartnerSharingSection role={profile.role} /> : null}

      <NotificationPreferencesCard />

      <SectionCard title="Coming later" icon={Shield} hint="These settings are planned for the next stages.">
        <PlaceholderRow label="Sleep goals" note="Coming soon" />
        <PlaceholderRow label="Privacy" note="Coming soon" />
        <PlaceholderRow label="Appearance" note="Coming soon" />
        <PlaceholderRow label="Data export" note="Coming soon" />
        <PlaceholderRow label="Delete my data" note="Coming soon" />
      </SectionCard>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Target className="size-3.5" aria-hidden="true" /> Goals
        </span>
        <span className="flex items-center gap-1.5">
          <Bell className="size-3.5" aria-hidden="true" /> Reminders
        </span>
        <span className="flex items-center gap-1.5">
          <Palette className="size-3.5" aria-hidden="true" /> Appearance
        </span>
        <span className="flex items-center gap-1.5">
          <Download className="size-3.5" aria-hidden="true" /> Export
        </span>
        <span className="flex items-center gap-1.5">
          <Trash2 className="size-3.5" aria-hidden="true" /> Deletion
        </span>
      </div>
    </div>
  );
}

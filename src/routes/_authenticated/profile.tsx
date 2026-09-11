import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Download, LogOut, Palette, Shield, Target, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/app-shell";
import { RoleGate } from "@/components/app/role-gate";
import { PlaceholderRow, SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useActivePartnerId, useSaveSharingPermissions, useSharingPermissions } from "@/hooks/use-shared";
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
  const { data: activePartnerId, isLoading: relationshipLoading, error: relationshipError } = useActivePartnerId();
  const { data: sharingPermissions, isLoading: sharingLoading, error: sharingError } = useSharingPermissions(activePartnerId);
  const update = useUpdateProfile();
  const saveSharing = useSaveSharingPermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [nickname, setNickname] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState<string | null>(null);
  const [sharingSaveError, setSharingSaveError] = useState<string | null>(null);

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

  async function updateSharing(field: "share_reset_plan" | "share_recovery_status", value: boolean) {
    if (!activePartnerId) return;
    setSharingSaveError(null);
    try {
      const values = field === "share_reset_plan" ? { share_reset_plan: value } : { share_recovery_status: value };
      await saveSharing.mutateAsync({ partnerId: activePartnerId, values });
      toast.success(value ? "Sharing preference updated" : "Sharing turned off");
    } catch (e) {
      setSharingSaveError(e instanceof Error ? e.message : "We couldn't update sharing. Please try again.");
    }
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

      {profile?.role === "user" ? (
        <SectionCard
          title="Sharing with your partner"
          icon={Shield}
          hint="You decide what is shared. These details stay private unless you turn them on."
        >
          {relationshipLoading || sharingLoading ? (
            <p className="text-sm text-muted-foreground">Checking your sharing settings…</p>
          ) : relationshipError || sharingError ? (
            <p className="text-sm text-destructive">
              {relationshipError?.message ?? sharingError?.message ?? "We couldn't load sharing settings. Please try again."}
            </p>
          ) : !activePartnerId ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              There is no active partner connection right now, so nothing from this section can be shared.
            </p>
          ) : (
            <div className="space-y-3">
              <SharingToggle
                label="Share my reset plan"
                description={sharingPermissions?.share_everything ? "This is currently included because your existing share-everything preference is on." : "OFF: your partner cannot see it. ON: they can see the limited schedule details in your plan."}
                checked={sharingPermissions?.share_everything || sharingPermissions?.share_reset_plan || false}
                disabled={saveSharing.isPending || Boolean(sharingPermissions?.share_everything)}
                onCheckedChange={(checked) => void updateSharing("share_reset_plan", checked)}
              />
              <SharingToggle
                label="Share my recovery status"
                description={sharingPermissions?.share_everything ? "This is currently included because your existing share-everything preference is on." : "OFF: your partner cannot see it. ON: they can see only a simple recovery status, not your sleep details."}
                checked={sharingPermissions?.share_everything || sharingPermissions?.share_recovery_status || false}
                disabled={saveSharing.isPending || Boolean(sharingPermissions?.share_everything)}
                onCheckedChange={(checked) => void updateSharing("share_recovery_status", checked)}
              />
              {sharingPermissions?.share_everything ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your existing “share everything” preference is on, so these two items are included by the privacy rules.
                </p>
              ) : null}
              {sharingSaveError ? <p className="text-sm text-destructive">{sharingSaveError}</p> : null}
            </div>
          )}
        </SectionCard>
      ) : null}

      <SectionCard title="Coming later" icon={Shield} hint="These settings are planned for the next stages.">
        <PlaceholderRow label="Sleep goals" note="Coming soon" />
        <PlaceholderRow label="Notifications" note="Coming soon" />
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

function SharingToggle({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

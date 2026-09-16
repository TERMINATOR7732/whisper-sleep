import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarClock,
  Clock,
  Coffee,
  EyeOff,
  FileText,
  Heart,
  HelpCircle,
  Lightbulb,
  Lock,
  Moon,
  Shield,
  Smartphone,
  Sparkles,
  Sun,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app/section-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  type SharingPermissionKey,
  type SharingPermissionUpdates,
  useActivePartnerId,
  useSaveSharingPermissions,
  useSharingPermissions,
} from "@/hooks/use-shared";
import type { AppRole } from "@/types/db";

interface PartnerSharingSectionProps {
  role?: AppRole;
}

interface SharingOption {
  key: SharingPermissionKey;
  label: string;
  description: string;
  icon: typeof Moon;
  sensitive?: boolean;
}

const SHARING_GROUPS: {
  id: string;
  title: string;
  icon: typeof Moon;
  options: SharingOption[];
}[] = [
  {
    id: "group-plans",
    title: "Existing plans",
    icon: CalendarClock,
    options: [
      {
        key: "share_reset_plan",
        label: "Sleep reset plan",
        description: "Target bedtime, wake time, and phased schedule milestones.",
        icon: CalendarClock,
      },
      {
        key: "share_recovery_status",
        label: "Recovery status",
        description: "Gentle 'rough night' or 'okay' status indicator without exact sleep numbers.",
        icon: Activity,
      },
    ],
  },
  {
    id: "group-summary",
    title: "Sleep summary",
    icon: Moon,
    options: [
      {
        key: "share_sleep_duration",
        label: "Sleep duration",
        description: "Total hours and minutes slept each night.",
        icon: Clock,
      },
      {
        key: "share_sleep_quality",
        label: "Sleep quality rating",
        description: "Your subjective 1–5 sleep quality rating.",
        icon: Sparkles,
      },
      {
        key: "share_exact_bedtime",
        label: "Exact bedtime",
        description: "The specific time you got into bed.",
        icon: Moon,
      },
      {
        key: "share_exact_waketime",
        label: "Exact wake-up time",
        description: "The specific time you woke up in the morning.",
        icon: Sun,
      },
    ],
  },
  {
    id: "group-habits",
    title: "Daily habits",
    icon: Zap,
    options: [
      {
        key: "share_mood",
        label: "Morning mood",
        description: "Your morning mood rating from daily check-ins.",
        icon: Heart,
      },
      {
        key: "share_energy",
        label: "Energy & rested level",
        description: "Morning energy level and rested scores.",
        icon: Zap,
      },
      {
        key: "share_caffeine",
        label: "Caffeine intake",
        description: "Whether caffeine was logged during the day.",
        icon: Coffee,
      },
      {
        key: "share_phone_usage",
        label: "Phone & screen usage",
        description: "Late evening screen time and phone usage in bed.",
        icon: Smartphone,
      },
      {
        key: "share_naps",
        label: "Daytime naps",
        description: "Nap durations and counts during the day.",
        icon: Clock,
      },
    ],
  },
  {
    id: "group-factors",
    title: "Sleep factors",
    icon: Lightbulb,
    options: [
      {
        key: "share_reasons",
        label: "Logged reasons & tags",
        description: "Factors logged with your sleep (e.g. stress, noise, late meal).",
        icon: HelpCircle,
      },
      {
        key: "share_insights",
        label: "Sleep insights",
        description: "Gentle observations and pattern tips generated for you.",
        icon: Lightbulb,
      },
      {
        key: "share_patterns",
        label: "Rhythm patterns",
        description: "Weekly trends in your schedule and sleep consistency.",
        icon: TrendingUp,
      },
    ],
  },
  {
    id: "group-personal",
    title: "Personal content",
    icon: BookOpen,
    options: [
      {
        key: "share_notes",
        label: "Sleep entry notes",
        description: "Private notes written alongside your sleep logs.",
        icon: FileText,
        sensitive: true,
      },
      {
        key: "share_journal",
        label: "Reflective journal",
        description: "Reflective thoughts and entries recorded during check-ins.",
        icon: BookOpen,
        sensitive: true,
      },
    ],
  },
];

const ALL_SHARING_KEYS: SharingPermissionKey[] = [
  "share_sleep_duration",
  "share_sleep_quality",
  "share_exact_bedtime",
  "share_exact_waketime",
  "share_mood",
  "share_energy",
  "share_caffeine",
  "share_phone_usage",
  "share_naps",
  "share_reasons",
  "share_notes",
  "share_insights",
  "share_patterns",
  "share_journal",
  "share_reset_plan",
  "share_recovery_status",
];

export function PartnerSharingSection({ role }: PartnerSharingSectionProps) {
  const { data: activePartnerId, isLoading: relationshipLoading, error: relationshipError } = useActivePartnerId();
  const { data: sharingPermissions, isLoading: sharingLoading, error: sharingError } = useSharingPermissions(activePartnerId);
  const saveSharing = useSaveSharingPermissions();

  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Strictly enforce role-based access control: Only primary users ("user") can view or edit sharing controls.
  if (role !== "user") {
    return null;
  }

  const isMasterOverride = Boolean(sharingPermissions?.share_everything);

  // Calculate count of currently active permissions
  const activeCount = ALL_SHARING_KEYS.filter((key) => Boolean(sharingPermissions?.[key])).length;

  async function handleToggle(key: SharingPermissionKey, checked: boolean, label: string) {
    if (!activePartnerId) return;
    setSavingKey(key);
    try {
      await saveSharing.mutateAsync({
        partnerId: activePartnerId,
        values: { [key]: checked },
      });
      toast.success(checked ? `${label} shared` : `${label} sharing turned off`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to update ${label.toLowerCase()}.`);
    } finally {
      setSavingKey(null);
    }
  }

  async function handleTurnOffAll() {
    if (!activePartnerId) return;
    setSavingKey("all");
    try {
      const allOff: SharingPermissionUpdates = {
        share_everything: false,
      };
      for (const k of ALL_SHARING_KEYS) {
        allOff[k] = false;
      }
      await saveSharing.mutateAsync({
        partnerId: activePartnerId,
        values: allOff,
      });
      toast.info("All sharing turned off");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to turn off all sharing.");
    } finally {
      setSavingKey("all");
    }
  }

  return (
    <SectionCard
      title="Sharing with your partner"
      icon={Shield}
      hint="You decide what is shared. Everything is private by default. Your partner only sees the items you explicitly share."
    >
      {relationshipLoading || sharingLoading ? (
        <p className="text-sm text-muted-foreground">Checking your sharing settings…</p>
      ) : relationshipError || sharingError ? (
        <p className="text-sm text-destructive">
          {relationshipError?.message ?? sharingError?.message ?? "We couldn't load sharing settings. Please try again."}
        </p>
      ) : !activePartnerId ? (
        <div className="rounded-xl border border-dashed border-border/70 p-4 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            There is no active partner connection right now. When you connect with a partner, you can choose exactly what to share here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Informational Callout if share_everything is on in database */}
          {isMasterOverride ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs leading-relaxed text-foreground">
                <p className="font-semibold text-amber-700 dark:text-amber-300">
                  Global sharing is currently active
                </p>
                <p className="text-muted-foreground">
                  Your account previously enabled global sharing, so all categories are currently visible to your partner. You can revoke all sharing below at any time.
                </p>
              </div>
            </div>
          ) : null}

          {/* Header Summary & Turn Off All Action */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="text-xs text-muted-foreground">
              {isMasterOverride ? (
                <span className="font-medium text-amber-600 dark:text-amber-400">All items currently shared</span>
              ) : (
                <span>
                  <strong className="font-semibold text-foreground">{activeCount}</strong> of {ALL_SHARING_KEYS.length} items shared
                </span>
              )}
            </div>

            {(activeCount > 0 || isMasterOverride) ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    id="btn-turn-off-all-sharing"
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saveSharing.isPending}
                    className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
                  >
                    <EyeOff className="size-3.5" />
                    Turn off all sharing
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Turn off all sharing?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your partner will immediately stop seeing any shared sleep information, plans, and recovery status. Your partner pairing remains connected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      id="btn-confirm-turn-off-all"
                      onClick={handleTurnOffAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, turn off all sharing
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>

          {/* Grouped Accordion Sections */}
          <Accordion
            type="multiple"
            defaultValue={["group-plans", "group-summary", "group-habits", "group-factors", "group-personal"]}
            className="w-full space-y-2.5"
          >
            {SHARING_GROUPS.map((group) => {
              const GroupIcon = group.icon;
              const groupActiveCount = group.options.filter(
                (opt) => isMasterOverride || Boolean(sharingPermissions?.[opt.key])
              ).length;

              return (
                <AccordionItem
                  key={group.id}
                  value={group.id}
                  className="rounded-xl border border-border/70 bg-card px-4 py-1"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2.5 text-left">
                      <GroupIcon className="size-4 text-primary" aria-hidden="true" />
                      <span className="font-medium text-sm text-foreground">{group.title}</span>
                      {groupActiveCount > 0 ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                          {groupActiveCount} shared
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground font-normal">Private</span>
                      )}
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pt-2 pb-3 space-y-2.5">
                    {group.options.map((opt) => {
                      const isChecked = isMasterOverride || Boolean(sharingPermissions?.[opt.key]);
                      const isBusy = saveSharing.isPending && savingKey === opt.key;
                      const isDisabled = saveSharing.isPending || isMasterOverride;

                      return (
                        <div
                          key={opt.key}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/60 p-3"
                        >
                          <div className="space-y-0.5 pr-2">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">{opt.label}</p>
                              {opt.sensitive ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400 font-normal flex items-center gap-1"
                                >
                                  <Lock className="size-2.5" />
                                  Sensitive
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {opt.description}
                            </p>
                          </div>

                          <Switch
                            id={`toggle-${opt.key}`}
                            checked={isChecked}
                            disabled={isDisabled}
                            onCheckedChange={(checked) => handleToggle(opt.key, checked, opt.label)}
                            aria-label={opt.label}
                            className="shrink-0"
                          />
                        </div>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}
    </SectionCard>
  );
}

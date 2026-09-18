import { Bell, BellOff, CheckCircle2, AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePushSubscription } from "@/hooks/use-push-subscription";

export function BrowserNotificationsCard() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    isSubscribing,
    isUnsubscribing,
    error,
    subscribe,
    unsubscribe,
  } = usePushSubscription();

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      toast.success("Browser notifications enabled for this device");
    } else if (permission === "denied") {
      toast.error("Notifications blocked by browser settings");
    }
  };

  const handleDisable = async () => {
    const success = await unsubscribe();
    if (success) {
      toast.success("Browser notifications disabled for this device");
    } else {
      toast.error("Failed to disable browser notifications");
    }
  };

  return (
    <SectionCard
      title="Browser Notifications"
      icon={Bell}
      hint="Allow Nightly to send reminders directly to this browser when you choose."
    >
      <div className="space-y-4 pt-1">
        {/* State 1: Unsupported */}
        {!isSupported && !isLoading ? (
          <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Not supported on this browser</p>
            <p className="mt-1 text-xs">
              Web Push notifications are not supported by this browser or operating system mode.
            </p>
          </div>
        ) : null}

        {/* State 2: Permission Denied */}
        {isSupported && permission === "denied" ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <span>Notifications blocked</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Browser notifications were previously denied for Nightly. To enable reminders, click the lock or settings icon in your browser address bar and set Notifications to "Allow".
            </p>
          </div>
        ) : null}

        {/* State 3: Supported & Loading */}
        {isLoading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Checking notification status…</span>
          </div>
        ) : null}

        {/* State 4: Supported & Permission Not Denied */}
        {isSupported && !isLoading && permission !== "denied" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Status</span>
                  {isSubscribed ? (
                    <Badge variant="secondary" className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-3" />
                      Subscribed on this browser
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Not enabled
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isSubscribed
                    ? "This device is registered to receive check-in and wind-down reminders."
                    : "Enable notifications to receive gentle prompts even when Nightly is closed."}
                </p>
              </div>

              <div>
                {isSubscribed ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUnsubscribing}
                    onClick={handleDisable}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                  >
                    {isUnsubscribing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <BellOff className="size-3.5" />
                    )}
                    {isUnsubscribing ? "Disabling…" : "Disable on this browser"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSubscribing}
                    onClick={handleEnable}
                    className="gap-1.5 text-xs"
                  >
                    {isSubscribing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Bell className="size-3.5" />
                    )}
                    {isSubscribing ? "Enabling…" : "Enable on this browser"}
                  </Button>
                )}
              </div>
            </div>

            {isSubscribed ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>Encrypted end-to-end with Web Push VAPID</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
      </div>
    </SectionCard>
  );
}

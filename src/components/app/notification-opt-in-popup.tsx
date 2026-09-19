import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Moon, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";

const DISMISS_KEY_LOCAL = "nightly_notif_prompt_dismissed_at";
const DISMISS_KEY_SESSION = "nightly_notif_prompt_dismissed";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function NotificationOptInPopup() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    isSubscribing,
    subscribe,
  } = usePushSubscription();

  const [isOpen, setIsOpen] = useState(false);
  const [viewState, setViewState] = useState<"prompt" | "success" | "denied">("prompt");
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Wait until browser environment and push status check complete
    if (typeof window === "undefined" || isLoading) return;

    // Show only for supported, authenticated, onboarded primary users
    if (!isSupported || !user || !profile?.onboarded_at || profile?.role !== "user") {
      setIsOpen(false);
      return;
    }

    // Do not show if permission is already granted or device is already subscribed
    if (isSubscribed || permission === "granted") {
      setIsOpen(false);
      return;
    }

    // Do not repeatedly prompt if browser permission was already denied
    if (permission === "denied") {
      setIsOpen(false);
      return;
    }

    // Check session dismissal
    try {
      const sessionDismissed = sessionStorage.getItem(DISMISS_KEY_SESSION);
      if (sessionDismissed === "true") {
        setIsOpen(false);
        return;
      }

      // Check persistent dismissal cooldown
      const localDismissedAt = localStorage.getItem(DISMISS_KEY_LOCAL);
      if (localDismissedAt) {
        const timePassed = Date.now() - Number(localDismissedAt);
        if (timePassed < DISMISS_COOLDOWN_MS) {
          setIsOpen(false);
          return;
        }
      }
    } catch {
      // Storage unavailable or restricted
    }

    // Eligible fresh user: Open prompt with a calm delay for smooth initial page render
    const timer = setTimeout(() => {
      setIsOpen(true);
      setViewState("prompt");
    }, 700);

    return () => clearTimeout(timer);
  }, [isLoading, isSupported, user, profile?.onboarded_at, profile?.role, isSubscribed, permission]);

  const handleDismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY_SESSION, "true");
      localStorage.setItem(DISMISS_KEY_LOCAL, Date.now().toString());
    } catch {
      // Ignore storage write errors
    }
    setIsOpen(false);
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }, []);

  const handleTurnOn = useCallback(async () => {
    const success = await subscribe();
    if (success) {
      setViewState("success");
      autoCloseTimerRef.current = setTimeout(() => {
        handleDismiss();
      }, 2500);
    } else {
      if (
        typeof window !== "undefined" &&
        window.Notification &&
        window.Notification.permission === "denied"
      ) {
        setViewState("denied");
      }
    }
  }, [subscribe, handleDismiss]);

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleDismiss();
      }}
    >
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-border/80 bg-card p-6 shadow-2xl sm:max-w-md sm:p-7"
        onEscapeKeyDown={handleDismiss}
        onPointerDownOutside={handleDismiss}
      >
        {viewState === "prompt" && (
          <div className="space-y-5">
            <DialogHeader className="items-center text-center space-y-3">
              <div
                className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary shadow-sm"
                aria-hidden="true"
              >
                <Moon className="size-7" />
              </div>
              <DialogTitle className="font-display text-2xl font-normal tracking-tight text-foreground sm:text-[1.65rem]">
                Stay on track with Nightly
              </DialogTitle>
              <DialogDescription className="text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
                Get gentle reminders for your sleep check-in and wind-down routine.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 pt-2">
              <Button
                type="button"
                onClick={handleTurnOn}
                disabled={isSubscribing}
                className="h-11 w-full rounded-xl text-sm font-medium transition-all"
              >
                {isSubscribing ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                    <span>Enabling…</span>
                  </>
                ) : (
                  "Turn on notifications"
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleDismiss}
                disabled={isSubscribing}
                className="h-10 w-full rounded-xl text-sm text-muted-foreground hover:text-foreground"
              >
                Maybe later
              </Button>
            </div>
          </div>
        )}

        {viewState === "success" && (
          <div className="space-y-5 py-2">
            <DialogHeader className="items-center text-center space-y-3">
              <div
                className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 shadow-sm dark:text-emerald-400"
                aria-hidden="true"
              >
                <CheckCircle2 className="size-7" />
              </div>
              <DialogTitle className="font-display text-2xl font-normal tracking-tight text-foreground sm:text-[1.65rem]">
                Notifications are on
              </DialogTitle>
              <DialogDescription className="text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
                You'll receive your Nightly reminders.
              </DialogDescription>
            </DialogHeader>

            <div className="pt-2">
              <Button
                type="button"
                onClick={handleDismiss}
                className="h-11 w-full rounded-xl text-sm font-medium"
              >
                Got it
              </Button>
            </div>
          </div>
        )}

        {viewState === "denied" && (
          <div className="space-y-5">
            <DialogHeader className="items-center text-center space-y-3">
              <div
                className="flex size-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive shadow-sm"
                aria-hidden="true"
              >
                <AlertTriangle className="size-7" />
              </div>
              <DialogTitle className="font-display text-2xl font-normal tracking-tight text-foreground sm:text-[1.65rem]">
                Notifications are blocked
              </DialogTitle>
              <DialogDescription className="text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
                Browser notifications were denied in your browser settings. To enable reminders,
                allow notifications in your browser's site settings, or visit Profile → Browser
                Notifications.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 pt-2">
              <Button
                asChild
                variant="outline"
                className="h-11 w-full rounded-xl text-sm font-medium"
                onClick={handleDismiss}
              >
                <Link to="/profile">Go to Profile</Link>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleDismiss}
                className="h-10 w-full rounded-xl text-sm text-muted-foreground hover:text-foreground"
              >
                Maybe later
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

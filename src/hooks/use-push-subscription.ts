import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

/**
 * Converts a URL-safe Base64 string to a Uint8Array.
 * Required for passing applicationServerKey to PushManager.subscribe().
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Helper to convert an ArrayBuffer to a Base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }
  return window.btoa(binary);
}

/**
 * Extracts p256dh and auth keys from a PushSubscription.
 */
export function extractSubscriptionKeys(sub: PushSubscription): { p256dh: string; auth: string } {
  const json = sub.toJSON();
  const keys = json.keys as Record<string, string | undefined> | undefined;
  if (keys && keys["p256dh"] && keys["auth"]) {
    return {
      p256dh: keys["p256dh"],
      auth: keys["auth"],
    };
  }
  return {
    p256dh: arrayBufferToBase64(sub.getKey("p256dh")),
    auth: arrayBufferToBase64(sub.getKey("auth")),
  };
}

/**
 * Checks if Web Push notifications are supported in the current browser environment.
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export interface UsePushSubscriptionReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  isSubscribing: boolean;
  isUnsubscribing: boolean;
  error: string | null;
  subscription: PushSubscription | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const { user } = useAuth();
  const [isSupported] = useState<boolean>(() => isPushNotificationSupported());
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window === "undefined" || !isPushNotificationSupported()) return false;
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  });
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check support and existing subscription on mount / auth change
  useEffect(() => {
    let isCancelled = false;

    async function checkSubscription() {
      if (!isPushNotificationSupported()) {
        if (!isCancelled) setIsLoading(false);
        return;
      }

      const currentPermission = Notification.permission;
      if (!isCancelled) setPermission(currentPermission);

      if (currentPermission !== "granted") {
        if (!isCancelled) {
          setIsSubscribed(false);
          setSubscription(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        if (isCancelled) return;

        const existingSub = await reg.pushManager.getSubscription();
        if (isCancelled) return;

        if (existingSub) {
          if (!isCancelled) {
            setSubscription(existingSub);
          }

          // Check if this specific authenticated user has registered this subscription
          if (user?.id) {
            const { data: userSub, error: checkError } = await supabase
              .from("push_subscriptions")
              .select("id")
              .eq("user_id", user.id)
              .eq("endpoint", existingSub.endpoint)
              .maybeSingle();

            if (!isCancelled) {
              if (checkError) {
                console.warn("Error verifying user push subscription record:", checkError);
                setIsSubscribed(false);
              } else if (userSub) {
                // User has an active subscription record in Supabase
                setIsSubscribed(true);
              } else {
                // Device has a browser subscription, but current user has not enabled it
                setIsSubscribed(false);
              }
            }
          } else {
            if (!isCancelled) {
              setIsSubscribed(false);
            }
          }
        } else {
          if (!isCancelled) {
            setSubscription(null);
            setIsSubscribed(false);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn("Failed to check push subscription:", err);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    checkSubscription();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  /**
   * Subscribes the user to browser Web Push notifications.
   * Prompts for permission ONLY when explicitly invoked by user action.
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    setError(null);

    if (!user) {
      setError("You must be signed in to enable browser notifications.");
      return false;
    }

    if (!isPushNotificationSupported()) {
      setError("Web Push notifications are not supported in this browser.");
      return false;
    }

    const vapidPublicKey = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;
    if (!vapidPublicKey) {
      setError("VAPID public key is missing from the application environment.");
      return false;
    }

    setIsSubscribing(true);

    try {
      // Step 1: Request browser Notification permission
      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);

      if (requestedPermission !== "granted") {
        setIsSubscribed(false);
        if (requestedPermission === "denied") {
          setError("Notification permission was denied. You can enable it in your browser site settings.");
        }
        return false;
      }

      // Step 2: Ensure service worker is ready
      const reg = await navigator.serviceWorker.ready;

      // Step 3: Get existing subscription or create a new one with VAPID key
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as unknown as BufferSource,
        });
      }

      // Step 4: Extract keys and persist to Supabase
      const keys = extractSubscriptionKeys(sub);
      if (!keys.p256dh || !keys.auth) {
        throw new Error("Unable to extract encryption keys from push subscription.");
      }

      const { error: dbError } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          expiration_time: sub.expirationTime
            ? new Date(sub.expirationTime).toISOString()
            : null,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (dbError) {
        console.error("Supabase push_subscriptions upsert error:", dbError);
        throw new Error(dbError.message || "Failed to save push subscription to database.");
      }

      setSubscription(sub);
      setIsSubscribed(true);
      setError(null);
      return true;
    } catch (err: any) {
      const msg = err?.message || "Failed to subscribe to browser notifications.";
      console.error("Push subscribe error:", err);
      setError(msg);
      return false;
    } finally {
      setIsSubscribing(false);
    }
  }, [user]);

  /**
   * Unsubscribes from browser Web Push and removes subscription from Supabase.
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setError(null);
    setIsUnsubscribing(true);

    try {
      let reg: ServiceWorkerRegistration | null = null;
      let sub: PushSubscription | null = null;

      if (isPushNotificationSupported()) {
        reg = await navigator.serviceWorker.ready;
        sub = await reg.pushManager.getSubscription();
      }

      const targetEndpoint = sub?.endpoint || subscription?.endpoint;

      // 1. Delete from Supabase scoped strictly to authenticated user and target endpoint
      if (user?.id && targetEndpoint) {
        const { error: dbError } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", targetEndpoint);

        if (dbError) {
          console.error("Failed to delete push subscription from database:", dbError);
          const msg = dbError.message || "Failed to remove subscription from database.";
          setError(msg);
          return false;
        }
      }

      // 2. Unsubscribe browser PushSubscription if present
      if (sub) {
        try {
          await sub.unsubscribe();
        } catch (pushErr: any) {
          console.warn("Browser PushManager unsubscribe error:", pushErr);
        }
      }

      setSubscription(null);
      setIsSubscribed(false);
      setError(null);
      return true;
    } catch (err: any) {
      const msg = err?.message || "Failed to disable browser notifications.";
      console.error("Push unsubscribe error:", err);
      setError(msg);
      return false;
    } finally {
      setIsUnsubscribing(false);
    }
  }, [user, subscription]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    isSubscribing,
    isUnsubscribing,
    error,
    subscription,
    subscribe,
    unsubscribe,
  };
}

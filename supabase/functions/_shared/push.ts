import {
  buildPushPayload,
  type PushMessage,
  type PushSubscription,
  type VapidKeys,
} from "npm:@block65/webcrypto-web-push@2.0.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

export interface PushNotificationPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

export interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

export interface PushDeliveryResult {
  ok: boolean;
  sent: number;
  removed: number;
  totalSubscriptions: number;
}

/**
 * Delivers Web Push notification to all subscriptions registered for a given user.
 * Cleans up invalid/expired subscriptions on HTTP 404/410.
 * Preserves subscriptions on transient network or server errors.
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushNotificationPayload,
  vapid: VapidConfig
): Promise<PushDeliveryResult> {
  const { data: subscriptions, error: dbError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, expiration_time")
    .eq("user_id", userId);

  if (dbError) {
    throw new Error(`Failed to query push subscriptions: ${dbError.message}`);
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { ok: true, sent: 0, removed: 0, totalSubscriptions: 0 };
  }

  const notificationData = {
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    icon: payload.icon || "/icon.svg",
    badge: payload.badge || "/favicon.ico",
  };

  const vapidKeys: VapidKeys = {
    subject: vapid.subject,
    publicKey: vapid.publicKey,
    privateKey: vapid.privateKey,
  };

  const message: PushMessage = {
    data: JSON.stringify(notificationData),
    options: {
      ttl: 86400,
      urgency: "high",
    },
  };

  let sentCount = 0;
  let removedCount = 0;

  for (const sub of subscriptions) {
    try {
      const pushSub: PushSubscription = {
        endpoint: sub.endpoint,
        expirationTime: sub.expiration_time ? new Date(sub.expiration_time).getTime() : null,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      const pushPayload = await buildPushPayload(message, pushSub, vapidKeys);

      const pushRes = await fetch(sub.endpoint, {
        method: pushPayload.method,
        headers: pushPayload.headers,
        body: pushPayload.body,
      });

      if (pushRes.status === 200 || pushRes.status === 201 || pushRes.status === 202) {
        sentCount++;
      } else if (pushRes.status === 404 || pushRes.status === 410) {
        // Permanent failure: subscription expired or revoked
        const { error: delError } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("id", sub.id)
          .eq("user_id", userId);

        if (!delError) {
          removedCount++;
        }
      } else {
        console.warn(`Push delivery returned status ${pushRes.status} for subscription`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown push delivery error";
      console.error("Push delivery error for subscription:", errMsg);
    }
  }

  return {
    ok: true,
    sent: sentCount,
    removed: removedCount,
    totalSubscriptions: subscriptions.length,
  };
}

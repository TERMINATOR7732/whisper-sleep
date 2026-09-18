/// <reference lib="webworker" />

/**
 * Whisper Sleep / Nightly — Service Worker (Web Push & PWA Foundation)
 *
 * SAFETY & PRIVACY GUARANTEES:
 * - Does NOT intercept `fetch` requests (no fetch event listener).
 * - Does NOT use CacheStorage or cache dynamic routes/auth tokens.
 * - Does NOT expose or log VAPID keys, tokens, or private sleep data.
 * - Strictly isolates notification click navigation to the application origin.
 * - Leaves TanStack Start SSR routing and Supabase session handling untouched.
 */

// Lifecycle: Immediately take control without waiting for existing tabs to close
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Safely resolves a target URL against the current application origin.
 * Enforces strict same-origin policy to prevent open redirects.
 *
 * @param {string | undefined} rawUrl
 * @returns {string} Safe absolute URL within self.location.origin
 */
function getSafeTargetUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl || "/", self.location.origin);
    if (parsed.origin === self.location.origin) {
      return parsed.href;
    }
  } catch {
    // Fall back to origin root on invalid URL
  }
  return new URL("/", self.location.origin).href;
}

/**
 * Web Push Event Listener
 *
 * Receives Web Push events, safely parses payloads, applies safe defaults,
 * and displays notifications via self.registration.showNotification.
 */
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};

      if (event.data) {
        try {
          payload = event.data.json();
        } catch {
          try {
            payload = { body: event.data.text() };
          } catch {
            payload = {};
          }
        }
      }

      // Safe defaults for notification content
      const title =
        typeof payload.title === "string" && payload.title.trim()
          ? payload.title.trim()
          : "Nightly";

      const body = typeof payload.body === "string" ? payload.body : "";
      const icon = typeof payload.icon === "string" ? payload.icon : "/icon.svg";
      const badge = typeof payload.badge === "string" ? payload.badge : "/favicon.ico";
      const tag = typeof payload.tag === "string" ? payload.tag : undefined;
      const targetUrl = getSafeTargetUrl(payload.url || payload.data?.url);

      const notificationOptions = {
        body,
        icon,
        badge,
        tag,
        renotify: Boolean(payload.renotify && tag),
        data: {
          url: targetUrl,
          timestamp: Date.now(),
          ...(typeof payload.data === "object" && payload.data !== null ? payload.data : {}),
        },
      };

      await self.registration.showNotification(title, notificationOptions);
    })()
  );
});

/**
 * Notification Click Event Listener
 *
 * Closes the clicked notification, sanitizes the destination URL to the Nightly origin,
 * focuses an existing open Nightly window/tab if available, or opens a new window.
 */
self.addEventListener("notificationclick", (event) => {
  event.waitUntil(
    (async () => {
      event.notification.close();

      const rawUrl = event.notification.data?.url;
      const targetUrl = getSafeTargetUrl(rawUrl);

      // Query all open window clients under this origin
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // 1. Look for an existing client that is already on the target URL
      for (const client of windowClients) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      // 2. Look for any existing client on the same origin and navigate it
      for (const client of windowClients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin && "focus" in client) {
            if ("navigate" in client) {
              await client.navigate(targetUrl);
            }
            return client.focus();
          }
        } catch {
          // Ignore URL parsing errors for existing clients
        }
      }

      // 3. If no window client exists, open a new window to the target URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

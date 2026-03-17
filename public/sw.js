// ============================================================
// GYMTRACKER — Service Worker for Push Notifications
// ============================================================

self.addEventListener("push", (event) => {
  let data = { title: "gAIns", body: "You have a new notification" };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    // If JSON parsing fails, try text
    if (event.data) {
      data = { title: "gAIns", body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/badge-72.png",
    tag: data.tag || "gains-notification",
    data: data.data || {},
    vibrate: [100, 50, 100],
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

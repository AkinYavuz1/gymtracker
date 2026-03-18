// ============================================================
// Push Notification helpers — native (Capacitor) + web fallback
// ============================================================

import { supabase, getSession } from "./supabase";
import { Capacitor } from "@capacitor/core";

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const isNative = Capacitor.isNativePlatform();

// Lazy-load native plugin only on native platforms
let PushNotifications = null;
async function getNativePush() {
  if (!PushNotifications) {
    const mod = await import("@capacitor/push-notifications");
    PushNotifications = mod.PushNotifications;
  }
  return PushNotifications;
}

// ─── Service Worker Registration (web only) ─────────────────

let swRegistration = null;

export async function registerServiceWorker() {
  if (isNative) return null; // not needed on native
  if (!("serviceWorker" in navigator)) return null;
  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js");
    return swRegistration;
  } catch (e) {
    console.error("SW registration failed:", e);
    return null;
  }
}

export function getSwRegistration() {
  return swRegistration;
}

// ─── Permission & Subscription ───────────────────────────────

export function getNotificationPermission() {
  if (isNative) {
    // On native, we return "default" initially; actual check is async
    return "default";
  }
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function checkNativePermission() {
  if (!isNative) {
    if (!("Notification" in window)) return "default"; // treat as promptable, not unsupported
    return Notification.permission; // "default" | "granted" | "denied"
  }
  try {
    const Push = await getNativePush();
    const result = await Push.checkPermissions();
    if (result.receive === "granted") return "granted";
    if (result.receive === "denied") return "denied";
    return "default";
  } catch (e) {
    console.error("Check native permission failed:", e);
    return "default";
  }
}

export async function requestNotificationPermission() {
  if (isNative) {
    try {
      const Push = await getNativePush();
      const result = await Push.requestPermissions();
      return result.receive === "granted" ? "granted" : "denied";
    } catch (e) {
      console.error("Native permission request failed:", e);
      return "denied";
    }
  }
  if (!("Notification" in window)) return "granted"; // no browser prompt needed, just enable
  try {
    return await Notification.requestPermission();
  } catch (e) {
    console.error("Notification permission request failed:", e);
    return "denied";
  }
}

export async function subscribeToPush() {
  if (isNative) {
    return await subscribeNative();
  }
  const result = await subscribeWeb();
  // Even if web push subscription fails (no VAPID key, no SW), return true
  // so the UI reflects that the user has enabled notifications at the preference level
  return result || true;
}

export async function unsubscribeFromPush() {
  if (isNative) {
    return await unsubscribeNative();
  }
  return await unsubscribeWeb();
}

export async function getCurrentSubscription() {
  try {
    if (isNative) {
      const session = await getSession();
      if (!session?.user) return null;
      const { data } = await supabase
        .from("push_subscriptions")
        .select("endpoint")
        .eq("user_id", session.user.id)
        .like("endpoint", "fcm://%")
        .limit(1);
      return data && data.length > 0 ? data[0] : null;
    }
    // Web — check notification preferences in DB as fallback
    if (!swRegistration) {
      swRegistration = await registerServiceWorker();
    }
    if (swRegistration) {
      const sub = await swRegistration.pushManager.getSubscription();
      if (sub) return sub;
    }
    // No push subscription but user may have enabled at pref level — check DB
    const session = await getSession();
    if (!session?.user) return null;
    const { data } = await supabase
      .from("push_subscriptions")
      .select("endpoint")
      .eq("user_id", session.user.id)
      .limit(1);
    return data && data.length > 0 ? data[0] : null;
  } catch (e) {
    console.error("getCurrentSubscription error:", e);
    return null;
  }
}

// ─── Native (Capacitor) Push ─────────────────────────────────

let nativeListenersRegistered = false;

async function subscribeNative() {
  try {
    const Push = await getNativePush();

    // Register listeners only once
    if (!nativeListenersRegistered) {
      nativeListenersRegistered = true;

      await Push.addListener("registration", async (token) => {
        console.log("FCM token:", token.value);
        await saveNativeToken(token.value);
      });

      await Push.addListener("registrationError", (err) => {
        console.error("FCM registration error:", err);
      });

      await Push.addListener("pushNotificationReceived", (notification) => {
        console.log("Push received (foreground):", notification);
        // Show an in-app notification or handle silently
      });

      await Push.addListener("pushNotificationActionPerformed", (action) => {
        console.log("Push action:", action);
        // Handle notification tap — could navigate to a screen
      });
    }

    await Push.register();
    return true;
  } catch (e) {
    console.error("Native push subscribe failed:", e);
    return null;
  }
}

async function unsubscribeNative() {
  try {
    const session = await getSession();
    if (!session?.user) return;
    // Remove all FCM subscriptions for this user
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", session.user.id)
      .like("endpoint", "fcm://%");
  } catch (e) {
    console.error("Native push unsubscribe failed:", e);
  }
}

async function saveNativeToken(token) {
  const session = await getSession();
  if (!session?.user) return;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: session.user.id,
      endpoint: `fcm://${token}`,
      p256dh: "",
      auth: "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) console.error("Save FCM token error:", error);
}

// ─── Web Push ────────────────────────────────────────────────

async function subscribeWeb() {
  if (!swRegistration) {
    swRegistration = await registerServiceWorker();
  }
  if (!swRegistration || !VAPID_KEY) return null;

  try {
    let subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) return subscription;

    subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
    });

    await saveWebSubscription(subscription);
    return subscription;
  } catch (e) {
    console.error("Web push subscription failed:", e);
    return null;
  }
}

async function unsubscribeWeb() {
  if (!swRegistration) return;
  try {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await deleteSubscription(endpoint);
    }
  } catch (e) {
    console.error("Web push unsubscribe failed:", e);
  }
}

// ─── Supabase: Push Subscriptions ────────────────────────────

async function saveWebSubscription(subscription) {
  const session = await getSession();
  if (!session?.user) return;

  const sub = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: session.user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) console.error("Save push subscription error:", error);
}

async function deleteSubscription(endpoint) {
  const session = await getSession();
  if (!session?.user) return;

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", session.user.id)
    .eq("endpoint", endpoint);
  if (error) console.error("Delete push subscription error:", error);
}

// ─── Supabase: Notification Preferences ──────────────────────

const DEFAULT_PREFS = {
  workout_reminders: true,
  rest_day_alerts: true,
  pr_celebrations: true,
  weekly_summary: true,
  ai_coach_tips: true,
  streak_alerts: true,
};

export async function getNotificationPreferences() {
  const session = await getSession();
  if (!session?.user) return DEFAULT_PREFS;

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", session.user.id)
    .single();

  if (error || !data) return DEFAULT_PREFS;
  return {
    workout_reminders: data.workout_reminders,
    rest_day_alerts: data.rest_day_alerts,
    pr_celebrations: data.pr_celebrations,
    weekly_summary: data.weekly_summary,
    ai_coach_tips: data.ai_coach_tips,
    streak_alerts: data.streak_alerts,
  };
}

export async function updateNotificationPreferences(prefs) {
  const session = await getSession();
  if (!session?.user) return;

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: session.user.id,
      ...prefs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) console.error("Update notification prefs error:", error);
}

// ─── Utility ─────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

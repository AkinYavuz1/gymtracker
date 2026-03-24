// ============================================================
// Push Notification helpers — native (Capacitor) + web fallback
// ============================================================

import { supabase, getSession } from "./supabase";
import { Capacitor } from "@capacitor/core";

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const isNative = Capacitor.isNativePlatform();

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Lazy-load native plugin only on native platforms
let PushNotifications = null;
let pushPluginFailed = false;

// Start loading eagerly on native so it's ready by the time user taps
if (isNative) {
  withTimeout(import("@capacitor/push-notifications"), 5000, null).then(mod => {
    if (mod) {
      PushNotifications = mod.PushNotifications;
    } else {
      console.warn("PushNotifications plugin load timed out on eager load");
      pushPluginFailed = true;
    }
  }).catch(() => { pushPluginFailed = true; });
}

function getNativePushSync() {
  return PushNotifications; // returns null if not loaded yet
}

async function getNativePush() {
  if (PushNotifications) return PushNotifications;
  if (pushPluginFailed) return null;
  try {
    const mod = await withTimeout(
      import("@capacitor/push-notifications"),
      4000,
      null
    );
    if (!mod) {
      pushPluginFailed = true;
      return null;
    }
    PushNotifications = mod.PushNotifications;
    return PushNotifications;
  } catch (e) {
    pushPluginFailed = true;
    return null;
  }
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
    if (!("Notification" in window)) return "default";
    return Notification.permission;
  }
  // Try sync first — if plugin loaded already, use it; if failed, bail fast
  const syncPush = getNativePushSync();
  if (pushPluginFailed) return "prompt";
  if (!syncPush) {
    // Plugin still loading — wait for it with timeout
    const Push = await getNativePush();
    if (!Push) return "prompt";
    try {
      const result = await withTimeout(Push.checkPermissions(), 3000, null);
      if (!result) return "prompt";
      if (result.receive === "granted") return "granted";
      if (result.receive === "denied") return "denied";
      return "default";
    } catch (e) {
      return "prompt";
    }
  }
  try {
    const result = await withTimeout(syncPush.checkPermissions(), 3000, null);
    if (!result) return "prompt";
    if (result.receive === "granted") return "granted";
    if (result.receive === "denied") return "denied";
    return "default";
  } catch (e) {
    return "prompt";
  }
}

export async function requestNotificationPermission() {
  if (isNative) {
    try {
      if (pushPluginFailed) return "timeout";
      const Push = getNativePushSync() || await getNativePush();
      if (!Push) return "timeout";
      const result = await withTimeout(Push.requestPermissions(), 5000, null);
      if (!result) {
        console.warn("requestPermissions timed out — re-checking actual state");
        return "timeout";
      }
      if (result.receive === "granted") return "granted";
      if (result.receive === "denied") return "denied";
      return "default";
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
let _fcmToken = null;
let _fcmError = null;
let _tokenCallbacks = [];

export function onFcmToken(cb) {
  if (_fcmToken) { cb(_fcmToken, null); return; }
  if (_fcmError) { cb(null, _fcmError); return; }
  _tokenCallbacks.push(cb);
}

async function subscribeNative() {
  try {
    // Use sync reference first — avoid re-entering async getNativePush()
    const Push = getNativePushSync();
    if (!Push) {
      console.warn("subscribeNative: plugin not loaded, saving preference only");
      return true;
    }

    // Register listeners and call register() entirely in background
    setTimeout(() => {
      try {
        if (!nativeListenersRegistered) {
          nativeListenersRegistered = true;
          Push.addListener("registration", async (token) => {
            console.log("FCM token:", token.value);
            _fcmToken = token.value;
            _tokenCallbacks.forEach(cb => cb(token.value, null));
            _tokenCallbacks = [];
            await saveNativeToken(token.value);
          });
          Push.addListener("registrationError", (err) => {
            console.error("FCM registration error:", err);
            _fcmError = err;
            _tokenCallbacks.forEach(cb => cb(null, err));
            _tokenCallbacks = [];
          });
          Push.addListener("pushNotificationReceived", (notification) => {
            console.log("Push received (foreground):", notification);
          });
          Push.addListener("pushNotificationActionPerformed", (action) => {
            console.log("Push action:", action);
          });
        }
        Push.register().catch(e => console.error("Push.register() failed:", e));
      } catch (e) {
        console.error("Background push setup failed:", e);
      }
    }, 0);

    return true;
  } catch (e) {
    console.error("Native push subscribe failed:", e);
    return true;
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

// ─── Sending Push Notifications ───────────────────────────────

export async function sendPushNotification(title, body, tag, data = {}, userId = null) {
  try {
    const session = await getSession();
    if (!session?.user) return;
    const uid = userId || session.user.id;
    await supabase.functions.invoke('send-notification', {
      body: { user_id: uid, title, body, tag, data },
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
  } catch (e) {
    console.error('sendPushNotification error:', e);
  }
}

export function setNotificationActionHandler(callback) {
  if (!Capacitor.isNativePlatform()) return;
  // PushNotifications is already imported at top (lazy-loaded)
  if (!PushNotifications) return;
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data || {};
    callback(data);
  });
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

// ============================================================
// Push Notification helpers — subscribe, unsubscribe, preferences
// ============================================================

import { supabase, getSession } from "./supabase";

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// ─── Service Worker Registration ─────────────────────────────

let swRegistration = null;

export async function registerServiceWorker() {
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
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  const result = await Notification.requestPermission();
  return result;
}

export async function subscribeToPush() {
  if (!swRegistration) {
    swRegistration = await registerServiceWorker();
  }
  if (!swRegistration || !VAPID_KEY) return null;

  try {
    // Check existing subscription
    let subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) return subscription;

    // Create new subscription
    subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
    });

    // Save to Supabase
    await savePushSubscription(subscription);
    return subscription;
  } catch (e) {
    console.error("Push subscription failed:", e);
    return null;
  }
}

export async function unsubscribeFromPush() {
  if (!swRegistration) return;
  try {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await deletePushSubscription(endpoint);
    }
  } catch (e) {
    console.error("Push unsubscribe failed:", e);
  }
}

export async function getCurrentSubscription() {
  if (!swRegistration) {
    swRegistration = await registerServiceWorker();
  }
  if (!swRegistration) return null;
  return await swRegistration.pushManager.getSubscription();
}

// ─── Supabase: Push Subscriptions ────────────────────────────

async function savePushSubscription(subscription) {
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

async function deletePushSubscription(endpoint) {
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

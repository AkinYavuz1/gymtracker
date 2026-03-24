// ============================================================
// GYMTRACKER — Schedule-based Push Notifications
// ============================================================
//
// Runs hourly. Sends 4 types of notifications based on time:
// - Workout reminders: 9am UTC (for today's scheduled workouts)
// - Weekly summary: Sunday 19:00 UTC
// - AI coach tips: Wednesday 12:00 UTC
// - Streak alerts: Friday 18:00 UTC
//
// DEPLOY:
//   supabase functions deploy schedule-notifications
//
// CONFIG (in config.toml):
//   [functions.schedule-notifications]
//   verify_jwt = false
//   schedule = "0 * * * *"
//
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const now = new Date();
    const hour = now.getUTCHours();
    const dow = now.getUTCDay(); // 0=Sun, 1=Mon, 3=Wed, 5=Fri

    // Dispatch notifications based on time
    if (hour === 9) await sendWorkoutReminders();
    if (dow === 0 && hour === 19) await sendWeeklySummaries();
    if (dow === 3 && hour === 12) await sendAICoachTips();
    if (dow === 5 && hour === 18) await sendStreakAlerts();

    return new Response(
      JSON.stringify({ success: true, hour, dow }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("schedule-notifications error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// ─── Notification Senders ───────────────────────────────────

async function sendWorkoutReminders() {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const today = new Date().toISOString().split("T")[0];

    // Query for today's scheduled workouts
    const { data: workouts, error } = await supabaseAdmin
      .from("scheduled_workouts")
      .select(
        `
        user_id,
        program_days (
          day_name
        )
      `
      )
      .eq("scheduled_date", today)
      .eq("status", "scheduled");

    if (error || !workouts) {
      console.error("Failed to fetch scheduled workouts:", error);
      return;
    }

    // Group by user and send one notification per user
    const userIds = [...new Set(workouts.map((w) => w.user_id))];

    for (const userId of userIds) {
      await invokeNotificationFunction(userId, {
        title: "Time to train! 💪",
        body: "Your scheduled workout is waiting for you. Let's go!",
        tag: "workout-reminder",
        data: { screen: "home" },
      });
    }

    console.log(`Sent ${userIds.length} workout reminders`);
  } catch (e) {
    console.error("sendWorkoutReminders error:", e);
  }
}

async function sendWeeklySummaries() {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get all users with active push subscriptions
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("user_id")
      .not("user_id", "is", null);

    if (error || !subs) {
      console.error("Failed to fetch push subscriptions:", error);
      return;
    }

    const userIds = [...new Set(subs.map((s) => s.user_id))];

    for (const userId of userIds) {
      await invokeNotificationFunction(userId, {
        title: "Your Weekly Recap is Ready 📊",
        body: "Tap to see your stats for this week",
        tag: "weekly-summary",
        data: { screen: "weekDetail" },
      });
    }

    console.log(`Sent ${userIds.length} weekly summaries`);
  } catch (e) {
    console.error("sendWeeklySummaries error:", e);
  }
}

async function sendAICoachTips() {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const tips = [
      {
        title: "Recovery is Key 💤",
        body: "Your muscles grow during rest. Get 7-9 hours of sleep tonight.",
      },
      {
        title: "Form Over Weight 🎯",
        body: "Slow, controlled reps beat heavy sloppy ones. Quality > Ego.",
      },
      {
        title: "Track Your Progress 📈",
        body: "Use the AI Coach to analyze your trends and optimize your training.",
      },
      {
        title: "Nutrition Matters 🍗",
        body: "Hitting your protein goal daily will accelerate your gains.",
      },
    ];

    const weekOfYear = Math.floor(
      (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        (7 * 24 * 60 * 60 * 1000)
    );
    const tip = tips[weekOfYear % tips.length];

    // Get all users with active push subscriptions
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("user_id")
      .not("user_id", "is", null);

    if (error || !subs) {
      console.error("Failed to fetch push subscriptions:", error);
      return;
    }

    const userIds = [...new Set(subs.map((s) => s.user_id))];

    for (const userId of userIds) {
      await invokeNotificationFunction(userId, {
        title: tip.title,
        body: tip.body,
        tag: "ai-tip",
        data: { screen: "coach" },
      });
    }

    console.log(`Sent ${userIds.length} AI coach tips`);
  } catch (e) {
    console.error("sendAICoachTips error:", e);
  }
}

async function sendStreakAlerts() {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get Monday of this week
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setUTCDate(monday.getUTCDate() - daysToMonday);
    monday.setUTCHours(0, 0, 0, 0);
    const mondayStr = monday.toISOString().split("T")[0];

    // Query workouts from Monday onwards (this week)
    const { data: workouts, error } = await supabaseAdmin
      .from("workouts")
      .select("user_id")
      .gte("created_at", mondayStr);

    if (error || !workouts) {
      console.error("Failed to fetch workouts:", error);
      return;
    }

    // Count workouts per user this week
    const workoutsByUser: Record<string, number> = {};
    for (const w of workouts) {
      workoutsByUser[w.user_id] = (workoutsByUser[w.user_id] || 0) + 1;
    }

    const userIds = Object.keys(workoutsByUser);

    for (const userId of userIds) {
      const count = workoutsByUser[userId];
      if (count > 0) {
        await invokeNotificationFunction(userId, {
          title: "Weekly Streak 🔥",
          body: `You've done ${count} workout${count > 1 ? "s" : ""} this week — keep the momentum going!`,
          tag: "streak",
          data: { screen: "home" },
        });
      }
    }

    console.log(`Sent ${userIds.length} streak alerts`);
  } catch (e) {
    console.error("sendStreakAlerts error:", e);
  }
}

// ─── Helper ──────────────────────────────────────────────────

async function invokeNotificationFunction(
  userId: string,
  payload: { title: string; body: string; tag: string; data?: any }
) {
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          user_id: userId,
          title: payload.title,
          body: payload.body,
          tag: payload.tag,
          data: payload.data || {},
        }),
      }
    );

    if (!response.ok) {
      console.error(`Failed to send notification to ${userId}:`, response.status);
    }
  } catch (e) {
    console.error(`Error invoking send-notification for ${userId}:`, e);
  }
}

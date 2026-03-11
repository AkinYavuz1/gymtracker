// ============================================================
// GYMTRACKER — AI Coach Edge Function
// ============================================================
// 
// DEPLOY:
//   1. Install Supabase CLI: npm i -g supabase
//   2. Login: supabase login
//   3. Link project: supabase link --project-ref YOUR_PROJECT_REF
//   4. Set secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   5. Deploy: supabase functions deploy coach
//
// This file goes in: supabase/functions/coach/index.ts
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Plan limits
const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  pro: 30,
  unlimited: 9999,
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse request
    const { prompt, label, conversationId } = await req.json();
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Missing prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check AI quota (uses the DB function we created)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: quota } = await supabaseAdmin.rpc("check_ai_quota", {
      p_user_id: user.id,
    });

    if (!quota.allowed) {
      return new Response(
        JSON.stringify({
          error: "Daily limit reached",
          plan: quota.plan,
          used: quota.used,
          limit: quota.limit,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Build user context from their real data
    const { data: userContext } = await supabaseAdmin.rpc("build_ai_context", {
      p_user_id: user.id,
    });

    // 5. Load conversation history if continuing
    let history: Array<{ role: string; content: string }> = [];
    if (conversationId) {
      const { data: messages } = await supabaseAdmin
        .from("ai_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(20);  // Keep context manageable
      history = messages || [];
    }

    // 6. Call Anthropic API (Haiku for cost efficiency)
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const systemPrompt = `You are a concise elite AI strength coach inside a gym app. You have the user's real training data below. Be direct, specific, actionable. Use numbers when possible. Under 150 words. Short paragraphs only, no markdown, no bullet points, no headers.

USER DATA:
${userContext || "New user — no workout data yet. Give general advice and encourage them to start tracking."}`;

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: [
          {
            type: "text",
            text: systemPrompt,
            // Enable prompt caching — saves ~90% on input for repeated system prompts
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.text();
      console.error("Anthropic API error:", errBody);
      throw new Error(`Anthropic API returned ${anthropicResponse.status}`);
    }

    const aiData = await anthropicResponse.json();
    const aiText = aiData.content
      ?.filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("") || "Sorry, I couldn't generate a response.";

    // 7. Calculate cost
    const usage = aiData.usage || {};
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    const newInput = inputTokens - cacheRead;

    const cost =
      (newInput / 1_000_000) * 1.0 +     // New input: $1/MTok
      (cacheRead / 1_000_000) * 0.1 +     // Cache hits: $0.10/MTok (90% off!)
      (outputTokens / 1_000_000) * 5.0;   // Output: $5/MTok

    // 8. Save conversation & messages
    let convId = conversationId;
    if (!convId) {
      const { data: newConv } = await supabaseAdmin
        .from("ai_conversations")
        .insert({ user_id: user.id })
        .select("id")
        .single();
      convId = newConv?.id;
    }

    if (convId) {
      await supabaseAdmin.from("ai_messages").insert([
        {
          conversation_id: convId,
          role: "user",
          content: prompt,
          label: label || null,
        },
        {
          conversation_id: convId,
          role: "assistant",
          content: aiText,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: cost,
        },
      ]);
    }

    // 9. Increment daily counter
    await supabaseAdmin.rpc("increment_ai_queries", { p_user_id: user.id });

    // 10. Return response
    return new Response(
      JSON.stringify({
        text: aiText,
        conversationId: convId,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_tokens: cacheRead,
          cost_usd: Math.round(cost * 1_000_000) / 1_000_000,
        },
        remaining: quota.remaining - 1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Coach function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================
// GAINS — Stripe Create Checkout Edge Function
// Uses direct Stripe REST API calls (no SDK) for Deno compatibility
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_API = "https://api.stripe.com/v1";

function stripeHeaders() {
  return {
    "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function toFormData(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function stripePost(path: string, params: Record<string, string>) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: stripeHeaders(),
    body: toFormData(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Stripe error");
  return data;
}

async function stripeGet(path: string) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: stripeHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Stripe error");
  return data;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { priceId } = await req.json();
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Missing priceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email, name")
      .eq("id", user.id)
      .single();

    let customerId: string;

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id;
    } else {
      const customer = await stripePost("/customers", {
        email: profile?.email || user.email || "",
        ...(profile?.name ? { name: profile.name } : {}),
        "metadata[supabase_user_id]": user.id,
      });
      customerId = customer.id;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Create Checkout Session
    const session = await stripePost("/checkout/sessions", {
      customer: customerId,
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: "https://gains.app/success",
      cancel_url: "https://gains.app/cancel",
      allow_promotion_codes: "true",
      "metadata[supabase_user_id]": user.id,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

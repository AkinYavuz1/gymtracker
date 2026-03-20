// ============================================================
// GYMTRACKER — Stripe Webhook Edge Function
// Uses Web Crypto API for signature verification (no Stripe SDK)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TCpHiJHPSNkKOzLHufP1Ovs": "pro",
  "price_1TCpHwJHPSNkKOzLiczWUIUp": "unlimited",
};

// Verify Stripe webhook signature using Web Crypto API
async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const parts = signature.split(",").reduce((acc, part) => {
      const [key, val] = part.split("=");
      acc[key] = val;
      return acc;
    }, {} as Record<string, string>);

    const timestamp = parts["t"];
    const sig = parts["v1"];
    if (!timestamp || !sig) return false;

    const payload = `${timestamp}.${body}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0")).join("");

    return expectedSig === sig;
  } catch {
    return false;
  }
}

function getPlanFromSubscription(subscription: Record<string, unknown>): string {
  const items = subscription.items as { data: Array<{ price: { id: string } }> };
  const priceId = items?.data?.[0]?.price?.id;
  return PRICE_TO_PLAN[priceId] || "free";
}

Deno.serve(async (req: Request) => {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    const valid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!valid) {
      console.error("Invalid webhook signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);
    console.log(`Processing webhook: ${event.type}`);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const plan = getPlanFromSubscription(subscription);
        const expiresAt = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        const { error } = await supabase
          .from("profiles")
          .update({ plan, stripe_sub_id: subscription.id, plan_expires_at: expiresAt })
          .eq("stripe_customer_id", customerId);

        if (error) console.error("Failed to update profile:", error);
        else console.log(`Updated ${customerId} to plan: ${plan}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { error } = await supabase
          .from("profiles")
          .update({ plan: "free", stripe_sub_id: null, plan_expires_at: null })
          .eq("stripe_customer_id", customerId);

        if (error) console.error("Failed to downgrade:", error);
        else console.log(`Downgraded ${customerId} to free`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.log(`Payment failed for ${invoice.customer}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal error", { status: 500 });
  }
});

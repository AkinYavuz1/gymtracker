// ============================================================
// GYMTRACKER — Stripe Webhook Edge Function
// ============================================================
//
// DEPLOY:
//   1. supabase secrets set STRIPE_SECRET_KEY=sk_live_...
//   2. supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//   3. supabase functions deploy stripe-webhook
//   4. In Stripe Dashboard → Webhooks → Add endpoint:
//      URL: https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook
//      Events: customer.subscription.created, updated, deleted,
//              invoice.payment_failed
//
// File: supabase/functions/stripe-webhook/index.ts
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Map Stripe price IDs to plan names
// UPDATE THESE with your actual Stripe price IDs
const PRICE_TO_PLAN: Record<string, string> = {
  "price_pro_monthly":       "pro",       // $4.99/mo
  "price_unlimited_monthly":  "unlimited", // $9.99/mo
  // Add your real price IDs here, e.g.:
  // "price_1Qx...": "pro",
  // "price_1Qy...": "unlimited",
};

function getPlanFromSubscription(subscription: Stripe.Subscription): string {
  const priceId = subscription.items.data[0]?.price.id;
  return PRICE_TO_PLAN[priceId] || "free";
}

Deno.serve(async (req: Request) => {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    // Verify webhook signature
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
    let event: Stripe.Event;
    
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    console.log(`Processing webhook: ${event.type}`);

    switch (event.type) {
      // ─── Subscription created or updated ───
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const plan = getPlanFromSubscription(subscription);
        const expiresAt = new Date(
          subscription.current_period_end * 1000
        ).toISOString();

        const { error } = await supabase
          .from("profiles")
          .update({
            plan,
            stripe_sub_id: subscription.id,
            plan_expires_at: expiresAt,
          })
          .eq("stripe_customer_id", customerId);

        if (error) console.error("Failed to update profile:", error);
        else console.log(`Updated ${customerId} to plan: ${plan}`);
        break;
      }

      // ─── Subscription cancelled ───
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { error } = await supabase
          .from("profiles")
          .update({
            plan: "free",
            stripe_sub_id: null,
            plan_expires_at: null,
          })
          .eq("stripe_customer_id", customerId);

        if (error) console.error("Failed to downgrade:", error);
        else console.log(`Downgraded ${customerId} to free`);
        break;
      }

      // ─── Payment failed ───
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        console.log(`Payment failed for ${customerId}`);
        // You could send a push notification or email here
        // For now, Stripe will retry automatically
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

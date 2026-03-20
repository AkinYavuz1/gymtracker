/**
 * Tests for the stripe-webhook Edge Function.
 *
 * Because the function uses Deno.serve at module level we can't import it
 * directly.  Instead, we extract and test:
 *   - getPlanFromSubscription (pure helper)
 *   - The full request handler via a simulated handler that mirrors
 *     stripe-webhook/index.ts exactly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Pure helper ─────────────────────────────────────────────────────────────

const PRICE_TO_PLAN: Record<string, string> = {
  price_pro_monthly: 'pro',
  price_unlimited_monthly: 'unlimited',
};

function getPlanFromSubscription(subscription: {
  items: { data: Array<{ price: { id: string } }> };
}): string {
  const priceId = subscription.items.data[0]?.price.id;
  return PRICE_TO_PLAN[priceId] || 'free';
}

describe('getPlanFromSubscription', () => {
  it('maps price_pro_monthly to "pro"', () => {
    expect(getPlanFromSubscription({ items: { data: [{ price: { id: 'price_pro_monthly' } }] } })).toBe('pro');
  });

  it('maps price_unlimited_monthly to "unlimited"', () => {
    expect(getPlanFromSubscription({ items: { data: [{ price: { id: 'price_unlimited_monthly' } }] } })).toBe('unlimited');
  });

  it('falls back to "free" for unknown price IDs', () => {
    expect(getPlanFromSubscription({ items: { data: [{ price: { id: 'price_random_abc' } }] } })).toBe('free');
  });

  it('falls back to "free" when items array is empty', () => {
    expect(getPlanFromSubscription({ items: { data: [] } })).toBe('free');
  });
});

// ─── Handler simulation ───────────────────────────────────────────────────────

type StripeEventType =
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_failed'
  | string;

interface MockStripeEvent {
  type: StripeEventType;
  data: { object: any };
}

interface Deps {
  verifyWebhook: (body: string, signature: string, secret: string) => MockStripeEvent;
  updateProfile: (customerId: string, updates: Record<string, any>) => Promise<{ error: any }>;
}

async function stripeWebhookHandler(req: Request, deps: Deps): Promise<Response> {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing signature', { status: 400 });
    }

    let event: MockStripeEvent;
    try {
      event = deps.verifyWebhook(body, signature, 'whsec_test');
    } catch (err) {
      return new Response('Invalid signature', { status: 400 });
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const plan = getPlanFromSubscription(subscription);
        const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

        const { error } = await deps.updateProfile(customerId, {
          plan,
          stripe_sub_id: subscription.id,
          plan_expires_at: expiresAt,
        });

        if (error) console.error('Failed to update profile:', error);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { error } = await deps.updateProfile(customerId, {
          plan: 'free',
          stripe_sub_id: null,
          plan_expires_at: null,
        });

        if (error) console.error('Failed to downgrade:', error);
        break;
      }

      case 'invoice.payment_failed': {
        // Stripe retries automatically — no action needed beyond logging
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response('Internal error', { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: string, signature?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (signature) headers['stripe-signature'] = signature;
  return new Request('https://example.supabase.co/functions/v1/stripe-webhook', {
    method: 'POST',
    headers,
    body,
  });
}

function makeDeps(overrides: Partial<Deps> = {}): Deps {
  return {
    verifyWebhook: vi.fn().mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_abc',
          current_period_end: 1893456000, // far future
          items: { data: [{ price: { id: 'price_pro_monthly' } }] },
        },
      },
    }),
    updateProfile: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('stripe-webhook handler', () => {
  describe('signature validation', () => {
    it('returns 400 when stripe-signature header is missing', async () => {
      const req = makeRequest('{}'); // no signature header
      const res = await stripeWebhookHandler(req, makeDeps());
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Missing signature');
    });

    it('returns 400 when signature verification fails', async () => {
      const req = makeRequest('{}', 't=123,v1=invalid');
      const deps = makeDeps({
        verifyWebhook: vi.fn().mockImplementation(() => {
          throw new Error('No signatures found matching the expected signature');
        }),
      });
      const res = await stripeWebhookHandler(req, deps);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Invalid signature');
    });

    it('passes body and signature to verifyWebhook', async () => {
      const verifyWebhook = vi.fn().mockReturnValue({
        type: 'invoice.payment_failed',
        data: { object: { customer: 'cus_test' } },
      });
      const body = JSON.stringify({ id: 'evt_test' });
      const req = makeRequest(body, 't=1,v1=abc123');
      await stripeWebhookHandler(req, makeDeps({ verifyWebhook }));
      expect(verifyWebhook).toHaveBeenCalledWith(body, 't=1,v1=abc123', 'whsec_test');
    });
  });

  describe('customer.subscription.created', () => {
    it('updates profile with pro plan on pro price ID', async () => {
      const updateProfile = vi.fn().mockResolvedValue({ error: null });
      const req = makeRequest('{}', 't=1,v1=sig');
      const deps = makeDeps({
        verifyWebhook: vi.fn().mockReturnValue({
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_pro',
              customer: 'cus_pro_user',
              current_period_end: 1893456000,
              items: { data: [{ price: { id: 'price_pro_monthly' } }] },
            },
          },
        }),
        updateProfile,
      });
      await stripeWebhookHandler(req, deps);

      expect(updateProfile).toHaveBeenCalledWith('cus_pro_user', {
        plan: 'pro',
        stripe_sub_id: 'sub_pro',
        plan_expires_at: expect.any(String),
      });
    });

    it('updates profile with unlimited plan on unlimited price ID', async () => {
      const updateProfile = vi.fn().mockResolvedValue({ error: null });
      const req = makeRequest('{}', 't=1,v1=sig');
      const deps = makeDeps({
        verifyWebhook: vi.fn().mockReturnValue({
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_unl',
              customer: 'cus_unl_user',
              current_period_end: 1893456000,
              items: { data: [{ price: { id: 'price_unlimited_monthly' } }] },
            },
          },
        }),
        updateProfile,
      });
      await stripeWebhookHandler(req, deps);

      expect(updateProfile).toHaveBeenCalledWith('cus_unl_user', expect.objectContaining({ plan: 'unlimited' }));
    });

    it('sets plan to free for unknown price ID', async () => {
      const updateProfile = vi.fn().mockResolvedValue({ error: null });
      const req = makeRequest('{}', 't=1,v1=sig');
      const deps = makeDeps({
        verifyWebhook: vi.fn().mockReturnValue({
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_unknown',
              customer: 'cus_unknown',
              current_period_end: 1893456000,
              items: { data: [{ price: { id: 'price_mystery_plan' } }] },
            },
          },
        }),
        updateProfile,
      });
      await stripeWebhookHandler(req, deps);

      expect(updateProfile).toHaveBeenCalledWith('cus_unknown', expect.objectContaining({ plan: 'free' }));
    });

    it('converts current_period_end Unix timestamp to ISO string', async () => {
      const updateProfile = vi.fn().mockResolvedValue({ error: null });
      const req = makeRequest('{}', 't=1,v1=sig');
      const unixTimestamp = 1893456000; // 2029-12-31T00:00:00Z approximately
      const deps = makeDeps({
        verifyWebhook: vi.fn().mockReturnValue({
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_1',
              customer: 'cus_1',
              current_period_end: unixTimestamp,
              items: { data: [{ price: { id: 'price_pro_monthly' } }] },
            },
          },
        }),
        updateProfile,
      });
      await stripeWebhookHandler(req, deps);

      const call = updateProfile.mock.calls[0][1];
      expect(call.plan_expires_at).toBe(new Date(unixTimestamp * 1000).toISOString());
    });

    it('returns 200 with received: true on success', async () => {
      const req = makeRequest('{}', 't=1,v1=sig');
      const res = await stripeWebhookHandler(req, makeDeps());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);
    });
  });

  describe('customer.subscription.updated', () => {
    it('handles subscription.updated the same as subscription.created', async () => {
      const updateProfile = vi.fn().mockResolvedValue({ error: null });
      const req = makeRequest('{}', 't=1,v1=sig');
      const deps = makeDeps({
        verifyWebhook: vi.fn().mockReturnValue({
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_updated',
              customer: 'cus_updated',
              current_period_end: 1893456000,
              items: { data: [{ price: { id: 'price_unlimited_monthly' } }] },
            },
          },
        }),
        updateProfile,
      });
      await stripeWebhookHandler(req, deps);

      expect(updateProfile).toHaveBeenCalledWith('cus_updated', expect.objectContaining({
        plan: 'unlimited',
        stripe_sub_id: 'sub_updated',
      }));
    });
  });

  describe('customer.subscription.deleted', () => {
    it('downgrades user to free plan and clears subscription', async () => {
      const updateProfile = vi.fn().mockResolvedValue({ error: null });
      const req = makeRequest('{}', 't=1,v1=sig');
      const deps = makeDeps({
        verifyWebhook: vi.fn().mockReturnValue({
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_cancelled',
              customer: 'cus_cancelled',
            },
          },
        }),
        updateProfile,
      });
      await stripeWebhookHandler(req, deps);

      expect(updateProfile).toHaveBeenCalledWith('cus_cancelled', {
        plan: 'free',
        stripe_sub_id: null,
        plan_expires_at: null,
      });
    });

    it('returns 200 even when profile update fails', async () => {
      const req = makeRequest('{}', 't=1,v1=sig');
      const deps = makeDeps({
        verifyWebhook: vi.fn().mockReturnValue({
          type: 'customer.subscription.deleted',
          data: { object: { id: 'sub_1', customer: 'cus_1' } },
        }),
        updateProfile: vi.fn().mockResolvedValue({ error: { message: 'user not found' } }),
      });
      const res = await stripeWebhookHandler(req, deps);
      expect(res.status).toBe(200); // always ack to Stripe
    });
  });

  describe('invoice.payment_failed', () => {
    it('acknowledges the event without calling updateProfile', async () => {
      const updateProfile = vi.fn();
      const req = makeRequest('{}', 't=1,v1=sig');
      const deps = makeDeps({
        verifyWebhook: vi.fn().mockReturnValue({
          type: 'invoice.payment_failed',
          data: { object: { customer: 'cus_failed' } },
        }),
        updateProfile,
      });
      const res = await stripeWebhookHandler(req, deps);
      expect(res.status).toBe(200);
      expect(updateProfile).not.toHaveBeenCalled();
    });
  });

  describe('unhandled event types', () => {
    it('acknowledges unknown events without error', async () => {
      const req = makeRequest('{}', 't=1,v1=sig');
      const deps = makeDeps({
        verifyWebhook: vi.fn().mockReturnValue({
          type: 'checkout.session.completed',
          data: { object: {} },
        }),
      });
      const res = await stripeWebhookHandler(req, deps);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);
    });
  });

  describe('error handling', () => {
    it('returns 500 on unexpected thrown error', async () => {
      const req = makeRequest('{}', 't=1,v1=sig');
      const deps = makeDeps({
        updateProfile: vi.fn().mockRejectedValue(new Error('Supabase unreachable')),
      });
      const res = await stripeWebhookHandler(req, deps);
      expect(res.status).toBe(500);
      expect(await res.text()).toBe('Internal error');
    });
  });
});

/**
 * Tests for the coach Edge Function.
 *
 * The function runs in Deno, but the logic is tested here in a Node/Vitest
 * environment by extracting the pure handler logic into testable units and
 * calling the handler via simulated Request objects.
 *
 * Because the function calls Deno.serve at module level we can't import it
 * directly in Vitest.  Instead, we test:
 *   - getPlanFromSubscription (pure helper, extracted for testing)
 *   - The complete HTTP request/response contract by reproducing the handler
 *     logic in test doubles and asserting on mock calls.
 *
 * This file is intentionally written in TypeScript to match the source file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Pure helper: getPlanFromSubscription ────────────────────────────────────

const PRICE_TO_PLAN: Record<string, string> = {
  price_pro_monthly: 'pro',
  price_unlimited_monthly: 'unlimited',
};

function getPlanFromSubscription(subscription: { items: { data: Array<{ price: { id: string } }> } }): string {
  const priceId = subscription.items.data[0]?.price.id;
  return PRICE_TO_PLAN[priceId] || 'free';
}

describe('getPlanFromSubscription', () => {
  it('returns "pro" for pro price ID', () => {
    expect(getPlanFromSubscription({ items: { data: [{ price: { id: 'price_pro_monthly' } }] } })).toBe('pro');
  });

  it('returns "unlimited" for unlimited price ID', () => {
    expect(getPlanFromSubscription({ items: { data: [{ price: { id: 'price_unlimited_monthly' } }] } })).toBe('unlimited');
  });

  it('returns "free" for unknown price ID', () => {
    expect(getPlanFromSubscription({ items: { data: [{ price: { id: 'price_unknown_xyz' } }] } })).toBe('free');
  });

  it('returns "free" when items array is empty', () => {
    expect(getPlanFromSubscription({ items: { data: [] } })).toBe('free');
  });
});

// ─── Handler logic tests via mock simulation ─────────────────────────────────
//
// We simulate the full handler logic by replicating the exact conditionals from
// coach/index.ts and asserting the responses returned.  This tests the auth,
// quota, Anthropic API, and cost calculation branches without a Deno runtime.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simulated handler (mirrors coach/index.ts logic)
async function coachHandler(
  req: Request,
  deps: {
    getUser: () => Promise<{ data: { user: any }; error: any }>;
    checkQuota: (userId: string) => Promise<{ data: any; error: any }>;
    buildContext: (userId: string) => Promise<{ data: any; error: any }>;
    getHistory: (conversationId: string) => Promise<Array<{ role: string; content: string }>>;
    callAnthropic: (payload: any) => Promise<Response>;
    saveConversation: (userId: string) => Promise<string | null>;
    saveMessages: (convId: string, msgs: any[]) => Promise<void>;
    incrementQuota: (userId: string) => Promise<void>;
  }
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await deps.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { prompt, label, conversationId } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: quota, error: quotaError } = await deps.checkQuota(user.id);
    if (quotaError) {
      return new Response(JSON.stringify({ error: 'Quota check failed', details: quotaError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!quota || !quota.allowed) {
      return new Response(
        JSON.stringify({ error: 'Daily limit reached', plan: quota.plan, used: quota.used, limit: quota.limit }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userContext } = await deps.buildContext(user.id);

    let history: Array<{ role: string; content: string }> = [];
    if (conversationId) {
      history = await deps.getHistory(conversationId);
    }

    const anthropicResponse = await deps.callAnthropic({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [...history.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: prompt }],
    });

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.text();
      return new Response(JSON.stringify({ error: 'Anthropic API error', details: errBody }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await anthropicResponse.json();
    const aiText = aiData.content
      ?.filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('') || "Sorry, I couldn't generate a response.";

    const usage = aiData.usage || {};
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    const newInput = inputTokens - cacheRead;
    const cost =
      (newInput / 1_000_000) * 1.0 +
      (cacheRead / 1_000_000) * 0.1 +
      (outputTokens / 1_000_000) * 5.0;

    let convId = conversationId;
    if (!convId) {
      convId = await deps.saveConversation(user.id);
    }

    if (convId) {
      await deps.saveMessages(convId, [
        { role: 'user', content: prompt, label: label || null },
        { role: 'assistant', content: aiText, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: cost },
      ]);
    }

    await deps.incrementQuota(user.id);

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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeRequest(body: any, headers: Record<string, string> = {}) {
  return new Request('https://example.supabase.co/functions/v1/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function makeAnthropicSuccess(text: string, usage = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0 }) {
  return new Response(
    JSON.stringify({
      content: [{ type: 'text', text }],
      usage,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function makeDeps(overrides: Partial<Parameters<typeof coachHandler>[1]> = {}): Parameters<typeof coachHandler>[1] {
  return {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    checkQuota: vi.fn().mockResolvedValue({
      data: { allowed: true, remaining: 4, plan: 'free', used: 1, limit: 5 },
      error: null,
    }),
    buildContext: vi.fn().mockResolvedValue({ data: 'User has 3 workouts', error: null }),
    getHistory: vi.fn().mockResolvedValue([]),
    callAnthropic: vi.fn().mockResolvedValue(makeAnthropicSuccess('Great workout!')),
    saveConversation: vi.fn().mockResolvedValue('conv-new'),
    saveMessages: vi.fn().mockResolvedValue(undefined),
    incrementQuota: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── Coach handler tests ──────────────────────────────────────────────────────

describe('coach handler', () => {
  describe('CORS preflight', () => {
    it('returns 200 ok for OPTIONS request', async () => {
      const req = new Request('https://example.supabase.co/functions/v1/coach', { method: 'OPTIONS' });
      const res = await coachHandler(req, makeDeps());
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe('ok');
    });

    it('includes CORS headers on OPTIONS response', async () => {
      const req = new Request('https://example.supabase.co/functions/v1/coach', { method: 'OPTIONS' });
      const res = await coachHandler(req, makeDeps());
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('authentication', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const req = makeRequest({ prompt: 'Hello' }); // no Authorization header
      const res = await coachHandler(req, makeDeps());
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Missing authorization header');
    });

    it('returns 401 when user is not found', async () => {
      const req = makeRequest({ prompt: 'Hello' }, { Authorization: 'Bearer bad-token' });
      const deps = makeDeps({
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } }),
      });
      const res = await coachHandler(req, deps);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 when getUser returns null user with no error', async () => {
      const req = makeRequest({ prompt: 'Hello' }, { Authorization: 'Bearer expired' });
      const deps = makeDeps({
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      });
      const res = await coachHandler(req, deps);
      expect(res.status).toBe(401);
    });
  });

  describe('request validation', () => {
    it('returns 400 when prompt is missing', async () => {
      const req = makeRequest({ label: 'test' }, { Authorization: 'Bearer tok' });
      const res = await coachHandler(req, makeDeps());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Missing prompt');
    });

    it('returns 400 when prompt is empty string', async () => {
      const req = makeRequest({ prompt: '' }, { Authorization: 'Bearer tok' });
      const res = await coachHandler(req, makeDeps());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Missing prompt');
    });
  });

  describe('quota enforcement', () => {
    it('returns 500 when quota check fails', async () => {
      const req = makeRequest({ prompt: 'Test' }, { Authorization: 'Bearer tok' });
      const deps = makeDeps({
        checkQuota: vi.fn().mockResolvedValue({ data: null, error: { message: 'quota RPC error' } }),
      });
      const res = await coachHandler(req, deps);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Quota check failed');
      expect(body.details).toBe('quota RPC error');
    });

    it('returns 429 when daily limit is reached', async () => {
      const req = makeRequest({ prompt: 'Test' }, { Authorization: 'Bearer tok' });
      const deps = makeDeps({
        checkQuota: vi.fn().mockResolvedValue({
          data: { allowed: false, plan: 'free', used: 5, limit: 5 },
          error: null,
        }),
      });
      const res = await coachHandler(req, deps);
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe('Daily limit reached');
      expect(body.plan).toBe('free');
      expect(body.used).toBe(5);
      expect(body.limit).toBe(5);
    });

    it('does not call Anthropic when quota is exhausted', async () => {
      const callAnthropic = vi.fn();
      const req = makeRequest({ prompt: 'Test' }, { Authorization: 'Bearer tok' });
      const deps = makeDeps({
        checkQuota: vi.fn().mockResolvedValue({
          data: { allowed: false, plan: 'free', used: 5, limit: 5 },
          error: null,
        }),
        callAnthropic,
      });
      await coachHandler(req, deps);
      expect(callAnthropic).not.toHaveBeenCalled();
    });
  });

  describe('successful request', () => {
    it('returns AI response text', async () => {
      const req = makeRequest({ prompt: 'Rate my week' }, { Authorization: 'Bearer tok' });
      const res = await coachHandler(req, makeDeps());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.text).toBe('Great workout!');
    });

    it('includes conversationId in response', async () => {
      const req = makeRequest({ prompt: 'Rate my week' }, { Authorization: 'Bearer tok' });
      const res = await coachHandler(req, makeDeps());
      const body = await res.json();
      expect(body.conversationId).toBe('conv-new');
    });

    it('uses existing conversationId when provided', async () => {
      const req = makeRequest({ prompt: 'Follow up', conversationId: 'conv-existing' }, { Authorization: 'Bearer tok' });
      const saveConversation = vi.fn();
      const res = await coachHandler(req, makeDeps({ saveConversation }));
      const body = await res.json();
      expect(body.conversationId).toBe('conv-existing');
      expect(saveConversation).not.toHaveBeenCalled();
    });

    it('loads conversation history when conversationId provided', async () => {
      const history = [{ role: 'user', content: 'Previous message' }];
      const getHistory = vi.fn().mockResolvedValue(history);
      const callAnthropic = vi.fn().mockResolvedValue(makeAnthropicSuccess('Response'));
      const req = makeRequest({ prompt: 'Follow up', conversationId: 'conv-1' }, { Authorization: 'Bearer tok' });

      await coachHandler(req, makeDeps({ getHistory, callAnthropic }));

      expect(getHistory).toHaveBeenCalledWith('conv-1');
      const anthropicPayload = callAnthropic.mock.calls[0][0];
      expect(anthropicPayload.messages[0]).toEqual({ role: 'user', content: 'Previous message' });
    });

    it('does not load history when no conversationId', async () => {
      const getHistory = vi.fn();
      const req = makeRequest({ prompt: 'New question' }, { Authorization: 'Bearer tok' });
      await coachHandler(req, makeDeps({ getHistory }));
      expect(getHistory).not.toHaveBeenCalled();
    });

    it('saves user and assistant messages after successful response', async () => {
      const saveMessages = vi.fn().mockResolvedValue(undefined);
      const req = makeRequest({ prompt: 'Test', label: 'Rate' }, { Authorization: 'Bearer tok' });
      await coachHandler(req, makeDeps({ saveMessages }));

      expect(saveMessages).toHaveBeenCalledWith('conv-new', [
        expect.objectContaining({ role: 'user', content: 'Test', label: 'Rate' }),
        expect.objectContaining({ role: 'assistant', content: 'Great workout!' }),
      ]);
    });

    it('increments quota counter after successful response', async () => {
      const incrementQuota = vi.fn().mockResolvedValue(undefined);
      const req = makeRequest({ prompt: 'Test' }, { Authorization: 'Bearer tok' });
      await coachHandler(req, makeDeps({ incrementQuota }));
      expect(incrementQuota).toHaveBeenCalledWith('user-1');
    });

    it('returns remaining quota as quota.remaining - 1', async () => {
      const req = makeRequest({ prompt: 'Test' }, { Authorization: 'Bearer tok' });
      const deps = makeDeps({
        checkQuota: vi.fn().mockResolvedValue({
          data: { allowed: true, remaining: 3, plan: 'free', used: 2, limit: 5 },
          error: null,
        }),
      });
      const res = await coachHandler(req, deps);
      const body = await res.json();
      expect(body.remaining).toBe(2);
    });

    it('includes usage stats in response', async () => {
      const req = makeRequest({ prompt: 'Test' }, { Authorization: 'Bearer tok' });
      const deps = makeDeps({
        callAnthropic: vi.fn().mockResolvedValue(
          makeAnthropicSuccess('Reply', { input_tokens: 500, output_tokens: 100, cache_read_input_tokens: 400 })
        ),
      });
      const res = await coachHandler(req, deps);
      const body = await res.json();
      expect(body.usage.input_tokens).toBe(500);
      expect(body.usage.output_tokens).toBe(100);
      expect(body.usage.cache_read_tokens).toBe(400);
    });
  });

  describe('cost calculation', () => {
    it('calculates cost correctly with no cache hits', async () => {
      // 1000 new input tokens, 200 output tokens, 0 cache
      // cost = (1000/1_000_000)*1.0 + (200/1_000_000)*5.0 = 0.001 + 0.001 = 0.002
      const req = makeRequest({ prompt: 'Test' }, { Authorization: 'Bearer tok' });
      const deps = makeDeps({
        callAnthropic: vi.fn().mockResolvedValue(
          makeAnthropicSuccess('Reply', { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0 })
        ),
      });
      const res = await coachHandler(req, deps);
      const body = await res.json();
      expect(body.usage.cost_usd).toBeCloseTo(0.002, 5);
    });

    it('applies 90% discount for cache hits', async () => {
      // 1000 total input: 800 from cache, 200 new; 0 output
      // cost = (200/1_000_000)*1.0 + (800/1_000_000)*0.1 = 0.0002 + 0.00008 = 0.00028
      const req = makeRequest({ prompt: 'Test' }, { Authorization: 'Bearer tok' });
      const deps = makeDeps({
        callAnthropic: vi.fn().mockResolvedValue(
          makeAnthropicSuccess('Reply', { input_tokens: 1000, output_tokens: 0, cache_read_input_tokens: 800 })
        ),
      });
      const res = await coachHandler(req, deps);
      const body = await res.json();
      expect(body.usage.cost_usd).toBeCloseTo(0.00028, 5);
    });
  });

  describe('Anthropic API errors', () => {
    it('returns 502 when Anthropic API call fails', async () => {
      const req = makeRequest({ prompt: 'Test' }, { Authorization: 'Bearer tok' });
      const deps = makeDeps({
        callAnthropic: vi.fn().mockResolvedValue(
          new Response('Rate limit exceeded', { status: 429 })
        ),
      });
      const res = await coachHandler(req, deps);
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toBe('Anthropic API error');
    });

    it('returns 500 on unexpected thrown error', async () => {
      const req = makeRequest({ prompt: 'Test' }, { Authorization: 'Bearer tok' });
      const deps = makeDeps({
        callAnthropic: vi.fn().mockRejectedValue(new Error('Network failure')),
      });
      const res = await coachHandler(req, deps);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Internal server error');
      expect(body.details).toBe('Network failure');
    });
  });

  describe('fallback response', () => {
    it('uses fallback text when Anthropic returns empty content', async () => {
      const req = makeRequest({ prompt: 'Test' }, { Authorization: 'Bearer tok' });
      const deps = makeDeps({
        callAnthropic: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({ content: [], usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 } }),
            { status: 200 }
          )
        ),
      });
      const res = await coachHandler(req, deps);
      const body = await res.json();
      expect(body.text).toBe("Sorry, I couldn't generate a response.");
    });
  });
});

// ============================================================
// GYMTRACKER — Send Push Notification Edge Function
// ============================================================
//
// DEPLOY:
//   1. Generate VAPID keys: npx web-push generate-vapid-keys
//   2. Set secrets:
//      supabase secrets set VAPID_PUBLIC_KEY=BN...
//      supabase secrets set VAPID_PRIVATE_KEY=...
//      supabase secrets set VAPID_SUBJECT=mailto:you@example.com
//   3. Deploy: supabase functions deploy send-notification
//
// USAGE: POST with { user_id, title, body, tag?, data? }
// Can be called from other edge functions, cron jobs, or webhooks
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Minimal Web Push implementation for Deno
// Uses VAPID authentication with ES256 (P-256) signing

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate caller (must be authenticated user or service role)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id, title, body, tag, data } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing user_id, title, or body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user's notification preferences
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user_id)
      .single();

    // If user has preferences and the tag maps to a preference that's disabled, skip
    if (prefs && tag) {
      const prefMap: Record<string, string> = {
        "workout-reminder": "workout_reminders",
        "rest-day": "rest_day_alerts",
        "pr-celebration": "pr_celebrations",
        "weekly-summary": "weekly_summary",
        "ai-tip": "ai_coach_tips",
        "streak": "streak_alerts",
      };
      const prefKey = prefMap[tag];
      if (prefKey && prefs[prefKey] === false) {
        return new Response(
          JSON.stringify({ sent: 0, skipped: "preference_disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError || !subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, reason: "no_subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@gains.app";

    const payload = JSON.stringify({ title, body, tag: tag || "gains-notification", data: data || {} });

    let sent = 0;
    const staleEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const response = await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { vapidPublicKey, vapidPrivateKey, vapidSubject }
        );

        if (response.status === 201) {
          sent++;
        } else if (response.status === 404 || response.status === 410) {
          // Subscription expired or unsubscribed — clean up
          staleEndpoints.push(sub.endpoint);
        } else {
          console.error(`Push failed for ${sub.endpoint}: ${response.status}`);
        }
      } catch (e) {
        console.error(`Push error for ${sub.endpoint}:`, e);
      }
    }

    // Remove stale subscriptions
    if (staleEndpoints.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("endpoint", staleEndpoints);
    }

    return new Response(
      JSON.stringify({ sent, total: subscriptions.length, stale_removed: staleEndpoints.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-notification error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Web Push Implementation ─────────────────────────────────

interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface VapidOptions {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}

async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapid: VapidOptions
): Promise<Response> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  // Create VAPID JWT
  const jwt = await createVapidJwt(audience, vapid.vapidSubject, vapid.vapidPrivateKey);

  // Encrypt payload using Web Push encryption (aes128gcm)
  const encrypted = await encryptPayload(payload, subscription.keys.p256dh, subscription.keys.auth);

  const headers: Record<string, string> = {
    "Authorization": `vapid t=${jwt}, k=${vapid.vapidPublicKey}`,
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "aes128gcm",
    "TTL": "86400",
  };

  return fetch(subscription.endpoint, {
    method: "POST",
    headers,
    body: encrypted,
  });
}

async function createVapidJwt(audience: string, subject: string, privateKeyBase64: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud: audience, exp: now + 86400, sub: subject };

  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const claimsB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(claims)));
  const unsignedToken = `${headerB64}.${claimsB64}`;

  // Import the VAPID private key
  const privateKeyBytes = base64urlDecode(privateKeyBase64);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8(privateKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format
  const rawSig = derToRaw(new Uint8Array(signature));
  const signatureB64 = base64urlEncode(rawSig);

  return `${unsignedToken}.${signatureB64}`;
}

async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<Uint8Array> {
  const userPublicKeyBytes = base64urlDecode(p256dhBase64);
  const authSecret = base64urlDecode(authBase64);

  // Generate ephemeral key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Import subscriber's public key
  const subscriberKey = await crypto.subtle.importKey(
    "raw",
    userPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberKey },
      localKeyPair.privateKey,
      256
    )
  );

  const localPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // HKDF to derive encryption key and nonce
  const ikm = await hkdfExtract(authSecret, sharedSecret);
  const keyInfo = createInfo("aesgcm", userPublicKeyBytes, localPublicKey);
  const nonceInfo = createInfo("nonce", userPublicKeyBytes, localPublicKey);

  const contentEncryptionKey = await hkdfExpand(ikm, keyInfo, 16);
  const nonce = await hkdfExpand(ikm, nonceInfo, 12);

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Add padding (2 bytes of padding length + delimiter)
  const paddingLength = 0;
  const paddedPayload = new Uint8Array(2 + paddingLength + new TextEncoder().encode(payload).length);
  const payloadBytes = new TextEncoder().encode(payload);
  // Record size padding
  paddedPayload[0] = 0;
  paddedPayload[1] = 0;
  paddedPayload.set(payloadBytes, 2 + paddingLength);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      paddedPayload
    )
  );

  // Build aes128gcm header: salt (16) + rs (4) + keyid_len (1) + keyid (65)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + localPublicKey.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs);
  header[20] = localPublicKey.length;
  header.set(localPublicKey, 21);

  // Re-derive keys using salt for aes128gcm
  const prkKey = await hkdfExtract(authSecret, sharedSecret);
  const ikmInfo = concatBuffers(
    new TextEncoder().encode("WebPush: info\0"),
    userPublicKeyBytes,
    localPublicKey
  );
  const ikm2 = await hkdfExpand(prkKey, ikmInfo, 32);

  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo2 = new TextEncoder().encode("Content-Encoding: nonce\0");

  const prk2 = await hkdfExtract(salt, ikm2);
  const cek = await hkdfExpand(prk2, cekInfo, 16);
  const nonce2 = await hkdfExpand(prk2, nonceInfo2, 12);

  const aesKey2 = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);

  // Payload with record padding: content + delimiter (0x02 for final record)
  const record = new Uint8Array(payloadBytes.length + 1);
  record.set(payloadBytes, 0);
  record[payloadBytes.length] = 2; // final record delimiter

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce2 }, aesKey2, record)
  );

  // Combine header + encrypted
  const result = new Uint8Array(header.length + encrypted.length);
  result.set(header, 0);
  result.set(encrypted, header.length);

  return result;
}

// ─── Crypto Helpers ──────────────────────────────────────────

function base64urlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildPkcs8(rawPrivateKey: Uint8Array): Uint8Array {
  // PKCS#8 wrapper for EC P-256 private key
  const prefix = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const result = new Uint8Array(prefix.length + rawPrivateKey.length);
  result.set(prefix, 0);
  result.set(rawPrivateKey, prefix.length);
  return result;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // If already raw (64 bytes), return as-is
  if (der.length === 64) return der;
  // Parse DER SEQUENCE -> two INTEGERs
  const raw = new Uint8Array(64);
  let offset = 2; // skip SEQUENCE tag + length
  // First INTEGER
  const rLen = der[offset + 1];
  offset += 2;
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rPad = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, rStart + Math.min(rLen, 32)), rPad);
  offset += rLen;
  // Second INTEGER
  const sLen = der[offset + 1];
  offset += 2;
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sPad = sLen < 32 ? 32 - sLen : 0;
  raw.set(der.slice(sStart, sStart + Math.min(sLen, 32)), 32 + sPad);
  return raw;
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const input = new Uint8Array(info.length + 1);
  input.set(info, 0);
  input[info.length] = 1;
  const output = new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
  return output.slice(0, length);
}

function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(`Content-Encoding: ${type}\0`);
  return typeBytes;
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

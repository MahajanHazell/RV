/**
 * Redeem Ticket Edge Function
 * 
 * Handles ticket redemption requests
 * Validates tickets and grants access to museum content
 *
 * Input:  { code: string, museum_id?: string }
 * Output: { ok: true, museum_id: string, ticket_code_id: string, valid_to: string | null }
 *
 * Notes:
 * - For your current seed data, `code_hash` values are "demo_hash_1" etc
 *   This function supports BOTH:
 *   (1) direct match of `code` to `code_hash`  ✅ works now
 *   (2) sha256(code) match to `code_hash`     ✅ works if you later store real hashes
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

type RedeemRequest = {
  code: string;
  museum_id?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

// Build SUPABASE_URL from project ref (no need to store SUPABASE_URL as a secret)
function getSupabaseUrlFromJwt(jwt: string): string {
  try {
    const payloadB64 = jwt.split(".")[1];
    const json = JSON.parse(atob(payloadB64));
    const ref = json?.ref;
    if (!ref) throw new Error("Missing ref in JWT payload");
    return `https://${ref}.supabase.co`;
  } catch {
    throw new Error("Could not derive SUPABASE_URL from SERVICE_ROLE_KEY");
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hashBuf));
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RedeemRequest;
    const rawCode = body?.code?.trim();
    const museumId = body?.museum_id;

    if (!rawCode) {
      return new Response(JSON.stringify({ error: "Missing code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (museumId && !isValidUuid(museumId)) {
      return new Response(JSON.stringify({ error: "Invalid museum_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = getSupabaseUrlFromJwt(SERVICE_ROLE_KEY);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const nowIso = new Date().toISOString();

    // 1) Try direct match first (works with your seeded demo_hash_1/2/3)
    let query = supabase
      .from("ticket_codes")
      .select("id, museum_id, code_hash, is_active, valid_from, valid_to, max_sessions")
      .eq("code_hash", rawCode)
      .eq("is_active", true)
      .lte("valid_from", nowIso)
      .gte("valid_to", nowIso)
      .limit(1);

    if (museumId) query = query.eq("museum_id", museumId);

    let { data, error } = await query;
    if (error) throw new Error(error.message);

    let ticket = (data ?? [])[0] as any;

    // 2) If no direct match, try sha256(code) match (future-proof)
    if (!ticket) {
      const hashed = await sha256Hex(rawCode);

      let query2 = supabase
        .from("ticket_codes")
        .select("id, museum_id, code_hash, is_active, valid_from, valid_to, max_sessions")
        .eq("code_hash", hashed)
        .eq("is_active", true)
        .lte("valid_from", nowIso)
        .gte("valid_to", nowIso)
        .limit(1);

      if (museumId) query2 = query2.eq("museum_id", museumId);

      const res2 = await query2;
      if (res2.error) throw new Error(res2.error.message);
      ticket = (res2.data ?? [])[0] as any;
    }

    if (!ticket) {
      return new Response(JSON.stringify({ error: "Invalid or expired ticket" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional: enforce max_sessions if you later add a "redeemed_count"/"used_sessions" column
    // This is written defensively so it won't break if the column doesn't exist
    const maxSessions = typeof ticket.max_sessions === "number" ? ticket.max_sessions : null;

    // Try to fetch a usage counter if it exists (won't error if it doesn't exist because we don't select it)
    // If you DO add one, update the select above to include it, e.g. "redeemed_count"
    // For now, we just enforce maxSessions only if you also implement tracking
    // (So this won't falsely block you during the demo)
    if (maxSessions !== null) {
      // If you later add tracking, uncomment + implement properly
      // Example:
      // const used = ticket.redeemed_count ?? 0;
      // if (used >= maxSessions) { ... }
      // await supabase.from("ticket_codes").update({ redeemed_count: used + 1 }).eq("id", ticket.id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        museum_id: ticket.museum_id,
        ticket_code_id: ticket.id,
        valid_to: ticket.valid_to ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("redeem_ticket error:", msg);
    return new Response(JSON.stringify({ error: "Internal server error", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);

/**
 * RAG Chat Edge Function
 *
 * Input:  { museum_id: string, question: string, match_count?: number }
 * Output: { answer: string, sources: Array<{id: string, source_url: string|null, similarity: number}> }
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

type RagRequest = {
  museum_id: string;
  question: string;
  match_count?: number;
};

type MatchRow = {
  id: string;
  chunk_text: string;
  similarity: number | string; // Supabase may return numeric as string
};

type MuseumRow = {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  website: string | null;
  phone: string | null;
  director: string | null;
  founded_year: number | null;
  former_name: string | null;
  mission: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

// Tune these
// CHANGE #1: loosen similarity threshold a bit (more recall)
const MIN_SIMILARITY = 0.45;
const MAX_MATCH_COUNT = 10;

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

function isTimeSensitive(question: string): boolean {
  return /\b(this week|today|right now|currently|current|now|tonight|tomorrow|yesterday)\b/i
    .test(question);
}

/**
 * Helpers to avoid substring false positives
 * Example: "admission" should NOT match "mission"
 */
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWholePhrase(q: string, phrase: string) {
  const p = escapeRegex(phrase.toLowerCase());
  return new RegExp(`(^|\\b)${p}(\\b|$)`, "i").test(q);
}

function hasAnyWholePhrase(q: string, phrases: string[]) {
  return phrases.some((p) => hasWholePhrase(q, p));
}

function makeProfileSource(museum: MuseumRow) {
  return {
    id: `museum_profile:${museum.id}`,
    source_url: museum.website ?? null,
    similarity: 1.0,
  };
}

/**
 * Answer profile-style questions directly from museums table
 * This is NOT removing RAG—this is using structured data before vector search
 */
function tryAnswerFromMuseumProfile(questionRaw: string, museum: MuseumRow | null) {
  if (!museum) return null;

  const q = questionRaw.toLowerCase();

  const locationParts = [
    museum.address,
    museum.city,
    museum.state,
    museum.postal_code,
    museum.country,
  ].filter(Boolean);
  const location = locationParts.join(", ");

  // Director / CEO / leadership
  if (
    hasAnyWholePhrase(q, ["director", "ceo", "leadership"]) ||
    q.includes("executive director") ||
    q.includes("museum director")
  ) {
    if (museum.director) {
      return {
        answer: `The museum’s director is ${museum.director}.`,
        sources: [makeProfileSource(museum)],
      };
    }
    return {
      answer:
        "That isn’t available in the provided sources right now. Please check the museum’s official website for the latest leadership details.",
      sources: [],
    };
  }

  // Mission (whole-word to avoid "admission" -> "mission" bug)
  if (hasAnyWholePhrase(q, ["mission", "purpose", "goal"])) {
    if (museum.mission) {
      return {
        answer: `Mission: ${museum.mission}`,
        sources: [makeProfileSource(museum)],
      };
    }
    return {
      answer:
        "That isn’t available in the provided sources right now. Please check the museum’s official website for the mission statement.",
      sources: [],
    };
  }

  // Founded year / when founded
  if (
    hasAnyWholePhrase(q, ["founded", "established"]) ||
    /when was.*(founded|established)/i.test(q) ||
    /when did.*open/i.test(q) ||
    hasWholePhrase(q, "built")
  ) {
    if (museum.founded_year) {
      return {
        answer: `The museum was founded in ${museum.founded_year}.`,
        sources: [makeProfileSource(museum)],
      };
    }
    return {
      answer:
        "That isn’t available in the provided sources right now. Please check the museum’s official website for its history.",
      sources: [],
    };
  }

  // Former name / renamed
  if (
    q.includes("formerly") ||
    q.includes("former name") ||
    q.includes("used to be called") ||
    q.includes("old name") ||
    q.includes("renamed") ||
    q.includes("name change")
  ) {
    if (museum.former_name) {
      return {
        answer: `It was formerly known as ${museum.former_name}.`,
        sources: [makeProfileSource(museum)],
      };
    }
    return {
      answer:
        "That isn’t available in the provided sources right now. Please check the museum’s official website for details about the name change.",
      sources: [],
    };
  }

  // Address / location
  if (
    hasAnyWholePhrase(q, ["address", "location"]) ||
    /where.*located/i.test(q) ||
    q.includes("where is it") ||
    q.includes("how do i get there")
  ) {
    if (location) {
      return {
        answer: `The museum is located at ${location}.`,
        sources: [makeProfileSource(museum)],
      };
    }
    return {
      answer:
        "That isn’t available in the provided sources right now. Please check the museum’s official website for location details.",
      sources: [],
    };
  }

  // Website
  if (hasAnyWholePhrase(q, ["website", "official site", "url"])) {
    if (museum.website) {
      return {
        answer: `The official website is ${museum.website}.`,
        sources: [makeProfileSource(museum)],
      };
    }
    return {
      answer:
        "That isn’t available in the provided sources right now. Please check the museum’s official website.",
      sources: [],
    };
  }

  // Phone
  if (hasAnyWholePhrase(q, ["phone", "telephone", "contact number"]) || hasWholePhrase(q, "call")) {
    if (museum.phone) {
      return {
        answer: `You can reach the museum at ${museum.phone}.`,
        sources: [makeProfileSource(museum)],
      };
    }
    return {
      answer:
        "That isn’t available in the provided sources right now. Please check the museum’s official website.",
      sources: [],
    };
  }

  // Museum name (keep this narrow so “name” doesn’t hijack other questions)
  if (
    hasAnyWholePhrase(q, ["name of the museum", "full name"]) ||
    /what.*name/i.test(q)
  ) {
    if (museum.name) {
      return {
        answer: `The museum is called ${museum.name}.`,
        sources: [makeProfileSource(museum)],
      };
    }
    return {
      answer:
        "That isn’t available in the provided sources right now. Please check the museum’s official website.",
      sources: [],
    };
  }

  return null;
}

// CHANGE #2: robust numeric conversion (handles strings / weird values)
function toNumber(x: number | string): number | null {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : null;
}

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? `Embeddings failed: ${res.status}`;
    throw new Error(msg);
  }
  return body.data?.[0]?.embedding as number[];
}

async function chatCompletion(prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You are a museum assistant.",
            "Use ONLY the provided Context to answer.",
            'If the answer is not explicitly supported, say: "That isn’t available in the provided sources right now."',
            "Do NOT guess names, dates, prices, or current exhibits.",
            "If the user asks time-sensitive questions (e.g., current exhibits), recommend checking the official website.",
            "Be concise (1–4 sentences).",
          ].join(" "),
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? `Chat failed: ${res.status}`;
    throw new Error(msg);
  }
  return body.choices?.[0]?.message?.content ?? "";
}

async function tryGetMuseumRow(
  supabase: ReturnType<typeof createClient>,
  museumId: string,
): Promise<MuseumRow | null> {
  try {
    const { data, error } = await supabase
      .from("museums")
      .select(
        "id,name,address,city,state,postal_code,country,website,phone,director,founded_year,former_name,mission",
      )
      .eq("id", museumId)
      .single();

    if (error || !data) return null;
    return data as MuseumRow;
  } catch {
    return null;
  }
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
    if (!SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RagRequest;
    const museumId = body?.museum_id;
    const question = body?.question?.trim() ?? "";

    // CHANGE #3: request a few extra matches (better chance of having >= MIN_SIMILARITY)
    const requestedMatchCount =
      typeof body?.match_count === "number" && body.match_count > 0
        ? Math.min(body.match_count, MAX_MATCH_COUNT)
        : 5;
    const rpcMatchCount = Math.min(Math.max(requestedMatchCount, 5) + 5, MAX_MATCH_COUNT);

    if (!museumId || !isValidUuid(museumId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing museum_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!question) {
      return new Response(JSON.stringify({ error: "Missing question" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = getSupabaseUrlFromJwt(SERVICE_ROLE_KEY);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 0) Museum profile (structured data)
    const museumRow = await tryGetMuseumRow(supabase, museumId);

    // 0a) If it's a profile question, answer immediately
    const profileAnswer = tryAnswerFromMuseumProfile(question, museumRow);
    if (profileAnswer) {
      return new Response(JSON.stringify(profileAnswer), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Embed question
    const qEmbedding = await getEmbedding(question);

    // 2) Vector search
    const { data: matches, error: matchErr } = await supabase.rpc(
      "match_content_chunks",
      {
        query_embedding: qEmbedding,
        match_count: rpcMatchCount,
        museum_id: museumId,
      },
    );

    if (matchErr) throw new Error(`match_content_chunks failed: ${matchErr.message}`);

    const rows = (matches ?? []) as MatchRow[];

    // ✅ Similarity gating (normalize similarity FIRST)
    const normalized = rows
      .map((r) => ({
        ...r,
        similarity: toNumber(r.similarity),
      }))
      .filter(
        (r): r is { id: string; chunk_text: string; similarity: number } =>
          typeof r.similarity === "number",
      );

    // CHANGE #4: apply gating after we normalize + then limit to requested count
    const strong = normalized
      .filter((r) => r.similarity >= MIN_SIMILARITY)
      .slice(0, requestedMatchCount);

    // Time-sensitive questions: refuse unless we have strong context
    if (isTimeSensitive(question) && strong.length === 0) {
      return new Response(
        JSON.stringify({
          answer:
            "That changes frequently and isn’t available in the provided sources right now. Please check the museum’s official website for the latest details.",
          sources: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // No strong context: refuse
    if (strong.length === 0) {
      return new Response(
        JSON.stringify({
          answer:
            "That isn’t available in the provided sources right now. Please check the museum’s official website.",
          sources: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build context from strong matches only
    const context = strong.map((r, i) => `(${i + 1}) ${r.chunk_text}`).join("\n\n");

    // Fetch source_url for citations
    const ids = strong.map((r) => r.id);
    const { data: sources } = await supabase
      .from("content_chunks")
      .select("id, source_url")
      .in("id", ids);

    const srcMap = new Map((sources ?? []).map((s) => [s.id, s.source_url]));

    const prompt = [
      `Context:\n${context}`,
      `\nQuestion: ${question}`,
      "\nAnswer:",
    ].join("\n");

    const answer = await chatCompletion(prompt);

    return new Response(
      JSON.stringify({
        answer,
        sources: strong.map((r) => ({
          id: r.id,
          source_url: srcMap.get(r.id) ?? null,
          similarity: r.similarity,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("rag_chat error:", msg);
    return new Response(JSON.stringify({ error: "Internal server error", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);

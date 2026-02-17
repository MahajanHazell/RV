/**
 * Ingest Seed Data Edge Function (FULL INGEST + EMBED)
 *
 * Modes:
 * 1) If request includes `urls`, it will:
 *    - fetch HTML from each URL
 *    - extract text
 *    - chunk it
 *    - embed chunks
 *    - insert into `content_chunks` with museum_id + source_url
 *
 * 2) If request does NOT include `urls`, it will:
 *    - backfill embeddings for existing rows where embedding is null (your old behavior)
 *
 * Input:
 *  - { museum_id: string, urls?: string[], replace_existing?: boolean, chunk_size?: number, chunk_overlap?: number }
 *  - OR { museum_id: string, limit?: number }  (backfill mode)
 *
 * Output:
 *  - { inserted?: number, embedded?: number, updated?: number, pages?: number, errors?: Array<{url:string,error:string}> }
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

type IngestRequest =
  | {
      museum_id: string;
      urls?: string[];
      replace_existing?: boolean;
      chunk_size?: number; // characters (roughly)
      chunk_overlap?: number; // characters
    }
  | {
      museum_id: string;
      limit?: number;
    };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL_ENV = Deno.env.get("SUPABASE_URL") ?? "";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

// Build SUPABASE_URL from project ref if SUPABASE_URL env isn't set
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

function getSupabaseUrl(): string {
  if (SUPABASE_URL_ENV) return SUPABASE_URL_ENV;
  if (!SERVICE_ROLE_KEY) throw new Error("Missing SERVICE_ROLE_KEY");
  return getSupabaseUrlFromJwt(SERVICE_ROLE_KEY);
}

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Very lightweight HTML -> text
 * (Good enough for ingestion; we don't need perfect parsing)
 */
function htmlToText(html: string): string {
  // remove scripts/styles
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // convert some block tags to newlines
  out = out
    .replace(/<\/(p|div|section|article|header|footer|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");

  // strip remaining tags
  out = out.replace(/<[^>]+>/g, " ");

  // basic entity decode (minimal)
  out = out
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  return normalizeWhitespace(out);
}

/**
 * Chunk by characters with overlap
 * (Simple + predictable. You can swap to token chunking later)
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const t = text.trim();
  if (!t) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < t.length) {
    const end = Math.min(start + chunkSize, t.length);
    const piece = t.slice(start, end).trim();
    if (piece.length >= 200) chunks.push(piece); // ignore tiny fragments
    if (end >= t.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

async function getEmbeddings(inputs: string[]): Promise<number[][]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: inputs,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `OpenAI embeddings failed: ${response.status} ${response.statusText} :: ${errText}`,
    );
  }

  const json = await response.json();
  if (!Array.isArray(json.data)) throw new Error("OpenAI embeddings response missing data array");

  return json.data.map((item: { embedding: number[] }) => item.embedding);
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Backfill mode: embed existing chunks where embedding is null
 */
async function getChunksWithoutEmbedding(
  supabase: ReturnType<typeof createClient>,
  museumId: string,
  limit: number,
) {
  const { data, error } = await supabase
    .from("content_chunks")
    .select("id, chunk_text")
    .eq("museum_id", museumId)
    .is("embedding", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function updateChunkEmbedding(
  supabase: ReturnType<typeof createClient>,
  id: string,
  embedding: number[],
): Promise<void> {
  const { error } = await supabase
    .from("content_chunks")
    .update({ embedding: toVectorLiteral(embedding) })
    .eq("id", id);

  if (error) throw new Error(error.message);
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

    const supabase = createClient(getSupabaseUrl(), SERVICE_ROLE_KEY);

    const body = (await req.json()) as IngestRequest;
    const museumId = (body as any)?.museum_id as string;

    if (!museumId || !isValidUuid(museumId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing museum_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const urls = (body as any)?.urls as string[] | undefined;

    // -----------------------
    // MODE 1: FULL INGEST
    // -----------------------
    if (Array.isArray(urls) && urls.length > 0) {
      const replaceExisting = Boolean((body as any)?.replace_existing);
      const chunkSize = typeof (body as any)?.chunk_size === "number" ? (body as any).chunk_size : 1200;
      const chunkOverlap =
        typeof (body as any)?.chunk_overlap === "number" ? (body as any).chunk_overlap : 200;

      if (replaceExisting) {
        // Clear old chunks for that museum so we don’t bloat retrieval with stale duplicates
        const { error } = await supabase.from("content_chunks").delete().eq("museum_id", museumId);
        if (error) throw new Error(`Failed to delete old chunks: ${error.message}`);
      }

      let inserted = 0;
      let embedded = 0;
      const errors: Array<{ url: string; error: string }> = [];

      for (const url of urls) {
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent": "MuseumGuideBot/1.0 (+ingestion)",
            },
          });

          if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

          const html = await res.text();
          const text = htmlToText(html);

          // Add URL as a header in the chunk text for better grounding
          const docText = `Source: ${url}\n\n${text}`;

          const chunks = chunkText(docText, chunkSize, chunkOverlap);
          if (chunks.length === 0) continue;

          // Embed in batches (avoid very large payloads)
          const BATCH = 50;
          for (let i = 0; i < chunks.length; i += BATCH) {
            const batch = chunks.slice(i, i + BATCH);
            const vecs = await getEmbeddings(batch);

            // Insert rows
            const rows = batch.map((chunk_text, idx) => ({
              museum_id: museumId,
              source_url: url,
              chunk_text,
              embedding: toVectorLiteral(vecs[idx]),
            }));

            const { error: insErr } = await supabase.from("content_chunks").insert(rows);
            if (insErr) throw new Error(`Insert failed: ${insErr.message}`);

            inserted += rows.length;
            embedded += rows.length;
          }
        } catch (e) {
          errors.push({ url, error: e instanceof Error ? e.message : String(e) });
        }
      }

      return new Response(
        JSON.stringify({
          pages: urls.length,
          inserted,
          embedded,
          errors,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -----------------------
    // MODE 2: BACKFILL EMBEDDINGS (old behavior)
    // -----------------------
    const limit =
      typeof (body as any)?.limit === "number" && (body as any).limit > 0
        ? Math.min((body as any).limit, 200)
        : 50;

    const chunks = await getChunksWithoutEmbedding(supabase, museumId, limit);
    if (chunks.length === 0) {
      return new Response(JSON.stringify({ updated: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const texts = chunks.map((c: any) => c.chunk_text as string);
    const embeddings = await getEmbeddings(texts);

    if (embeddings.length !== chunks.length) {
      return new Response(JSON.stringify({ error: "Embedding count mismatch" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updatedCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      await updateChunkEmbedding(supabase, chunks[i].id as string, embeddings[i]);
      updatedCount += 1;
    }

    return new Response(JSON.stringify({ updated: updatedCount }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ingest_seed error:", msg);
    return new Response(JSON.stringify({ error: "Internal server error", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);

/**
 * Chat Edge Function
 * 
 * Processes chat messages and generates responses using RAG
 * Handles vector similarity search and context retrieval
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

type ChatRequest = {
  museum_id: string;
  question: string;
  top_k?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error("Required environment variables are missing.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `OpenAI embeddings failed: ${response.status} ${response.statusText} :: ${errText}`,
    );
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function matchChunks(
  museumId: string,
  queryEmbedding: number[],
  matchCount: number,
): Promise<Array<{ id: string; chunk_text: string; similarity: number }>> {
  // Pass vector as string literal for pgvector compatibility
  const { data, error } = await supabase.rpc("match_chunks", {
    p_museum_id: museumId,
    p_query_embedding: `[${queryEmbedding.join(",")}]`,
    p_match_count: matchCount,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    chunk_text: string;
    similarity: number;
  }>;
}

async function generateChatCompletion(
  context: string,
  question: string,
): Promise<string> {
  const systemPrompt = "You are a helpful museum guide.";
  const userPrompt = `Context:\n${context}\n\nQuestion: ${question}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `OpenAI chat completion failed: ${response.status} ${response.statusText} :: ${errText}`,
    );
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ChatRequest = await req.json();
    const { museum_id, question, top_k = 5 } = body;

    if (!museum_id || !isValidUuid(museum_id)) {
      return new Response(JSON.stringify({ error: "Invalid or missing museum_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Invalid or missing question" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (top_k !== undefined && (typeof top_k !== "number" || top_k < 1 || top_k > 20)) {
      return new Response(JSON.stringify({ error: "top_k must be between 1 and 20" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate embedding for the question
    let queryEmbedding: number[];
    try {
      queryEmbedding = await generateEmbedding(question);
    } catch (err) {
      console.error("Embedding generation error", err instanceof Error ? err.message : String(err));
      return new Response(
        JSON.stringify({
          error: "Failed to generate embedding",
          detail: err instanceof Error ? err.message : String(err),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Match chunks using RPC function
    let matchedChunks: Array<{ id: string; chunk_text: string; similarity: number }>;
    try {
      matchedChunks = await matchChunks(museum_id, queryEmbedding, top_k);
    } catch (err) {
      console.error("Chunk matching error", err instanceof Error ? err.message : String(err));
      return new Response(
        JSON.stringify({
          error: "Failed to match chunks",
          detail: err instanceof Error ? err.message : String(err),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (matchedChunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No relevant content found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Concatenate chunk texts into context
    const context = matchedChunks.map((chunk) => chunk.chunk_text).join("\n\n");

    // Generate chat completion
    let answer: string;
    try {
      answer = await generateChatCompletion(context, question);
    } catch (err) {
      console.error("Chat completion error", err instanceof Error ? err.message : String(err));
      return new Response(
        JSON.stringify({
          error: "Failed to generate answer",
          detail: err instanceof Error ? err.message : String(err),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Format sources
    const sources = matchedChunks.map((chunk) => ({
      id: chunk.id,
      similarity: chunk.similarity,
    }));

    return new Response(
      JSON.stringify({ answer, sources }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Unhandled error in chat", err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);

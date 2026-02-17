/**
 * API Client
 *
 * Centralized API functions for communicating with Supabase Edge Functions
 */

import { supabase } from "./supabase";

export type RedeemTicketResponse =
  | { ok: true; museum_id: string; ticket_code_id: string; valid_to: string | null }
  | { ok?: false; error?: string; detail?: string };

export type RagChatSource = { id: string; source_url: string | null; similarity: number };

export type RagChatResponse =
  | { answer: string; sources: RagChatSource[] }
  | { error?: string; detail?: string };

export async function redeemTicket(code: string, museumId?: string) {
  const { data, error } = await supabase.functions.invoke("redeem_ticket", {
    body: museumId ? { code, museum_id: museumId } : { code },
  });

  if (error) throw new Error(error.message || "Failed to redeem ticket");
  return data as RedeemTicketResponse;
}

export async function ragChat(params: { museum_id: string; question: string; match_count?: number }) {
  const { data, error } = await supabase.functions.invoke("rag_chat", {
    body: {
      museum_id: params.museum_id,
      question: params.question,
      match_count: params.match_count ?? 5,
    },
  });

  if (error) throw new Error(error.message || "Failed to call rag_chat");
  return data as RagChatResponse;
}

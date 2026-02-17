-- Match Chunks Function
-- 
-- Creates database functions for vector similarity search
-- Implements pgvector-based matching for RAG functionality

-- Vector similarity search using cosine distance
-- Filters by museum_id at the DB level to prevent cross-tenant leakage
CREATE OR REPLACE FUNCTION public.match_chunks(
  p_museum_id uuid,
  p_query_embedding vector(1536),
  p_match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  chunk_text text,
  source_url text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.chunk_text,
    c.source_url,
    c.metadata,
    (1 - (c.embedding <-> p_query_embedding))::float AS similarity
  FROM public.content_chunks c
  WHERE c.museum_id = p_museum_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <-> p_query_embedding
  LIMIT p_match_count;
$$;

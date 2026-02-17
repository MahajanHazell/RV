-- Initial Database Schema
-- 
-- Creates the base database tables and pgvector extension
-- Sets up core data structures for museums, tickets, and vector storage

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Museums table
-- Stores museum information including location details
CREATE TABLE museums (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    city text,
    state text,
    created_at timestamptz DEFAULT now()
);

-- Ticket codes table
-- Stores hashed ticket codes with validity periods and usage limits
CREATE TABLE ticket_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    museum_id uuid NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
    code_hash text NOT NULL,
    is_active boolean DEFAULT true,
    valid_from timestamptz,
    valid_to timestamptz,
    max_sessions int DEFAULT 50,
    created_at timestamptz DEFAULT now()
);

-- Sessions table
-- Tracks user sessions for museum access with expiration
CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    museum_id uuid NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
    ticket_code_id uuid REFERENCES ticket_codes(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz
);

-- Content chunks table
-- Stores document chunks with vector embeddings for RAG functionality
CREATE TABLE content_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    museum_id uuid NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
    chunk_text text NOT NULL,
    source_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    embedding vector(1536)
);

-- LLM calls table
-- Logs all LLM API calls for monitoring and analytics
CREATE TABLE llm_calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
    museum_id uuid REFERENCES museums(id) ON DELETE SET NULL,
    model text,
    latency_ms int,
    prompt_tokens int,
    completion_tokens int,
    total_tokens int,
    status text,
    error text,
    created_at timestamptz DEFAULT now()
);

-- Indexes for performance optimization

-- B-tree index on content_chunks.museum_id for fast museum-based queries
CREATE INDEX idx_content_chunks_museum_id ON content_chunks(museum_id);

-- IVFFlat index on content_chunks.embedding for vector similarity search
-- Note: IVFFlat requires data to exist, so this may need to be created after initial data load
-- Using lists parameter of 100 (default) for balanced performance
CREATE INDEX idx_content_chunks_embedding ON content_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- B-tree index on sessions.expires_at for efficient session expiration queries
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

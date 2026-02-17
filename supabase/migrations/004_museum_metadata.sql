-- 004_museum_metadata.sql
-- Adds structured "museum facts" so RAG can answer basic questions reliably.

alter table public.museums
  add column if not exists name text,
  add column if not exists former_name text,
  add column if not exists founded_year int,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country text,
  add column if not exists website text,
  add column if not exists mission text,
  add column if not exists director text,
  add column if not exists phone text;

create index if not exists museums_id_idx on public.museums (id);

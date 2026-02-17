# Full-Stack Demo Application

A demo-ready full-stack application showcasing React frontend with Supabase backend.

## Project Structure

### Frontend (`/frontend`)
- React application built with Vite and TypeScript
- Component-based architecture with clear separation of concerns

### Backend (`/supabase`)
- Supabase Edge Functions for serverless API endpoints
- Database migrations for schema and seed data
- pgvector integration for RAG functionality

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase Edge Functions (TypeScript)
- **Database**: Supabase Postgres with pgvector extension
- **No local database**: All data stored in Supabase cloud

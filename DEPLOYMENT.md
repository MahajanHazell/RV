# Deployment Guide

## Prerequisites
- Supabase CLI installed 
- Supabase project URL: `https://njcwzwgjfqfirfnsuvhu.supabase.co`
- Supabase project reference: `njcwzwgjfqfirfnsuvhu`

## Step 1: Link Supabase Project (2 minutes)

```bash
cd /Users/hazelmahajan/RV
supabase link --project-ref njcwzwgjfqfirfnsuvhu
```

You'll need your Supabase access token (get it from https://supabase.com/dashboard/account/tokens)

## Step 2: Deploy Database Migrations (5-10 minutes)

```bash
cd /Users/hazelmahajan/RV
supabase db push
```

This will apply all migrations:
- `001_init.sql` - Creates tables and extensions
- `002_seed.sql` - Seeds museum and ticket data
- `003_match_chunks.sql` - Creates vector search function
- `004_museum_metadata.sql` - Adds museum metadata columns (if exists)

**Note:** If migrations fail, you may need to run them manually in Supabase Dashboard → SQL Editor

## Step 3: Deploy Edge Functions (10-15 minutes)

Deploy each function:

```bash
cd /Users/hazelmahajan/RV

# Deploy redeem_ticket function
supabase functions deploy redeem_ticket

# Deploy rag_chat function
supabase functions deploy rag_chat

# Deploy ingest_seed function
supabase functions deploy ingest_seed

# Deploy chat function (if needed)
supabase functions deploy chat
```

**Set environment variables for each function:**

```bash
# For redeem_ticket
supabase secrets set SERVICE_ROLE_KEY=your_service_role_key --project-ref njcwzwgjfqfirfnsuvhu

# For rag_chat
supabase secrets set SERVICE_ROLE_KEY=your_service_role_key --project-ref njcwzwgjfqfirfnsuvhu
supabase secrets set OPENAI_API_KEY=your_openai_key --project-ref njcwzwgjfqfirfnsuvhu

# For ingest_seed
supabase secrets set SERVICE_ROLE_KEY=your_service_role_key --project-ref njcwzwgjfqfirfnsuvhu
supabase secrets set OPENAI_API_KEY=your_openai_key --project-ref njcwzwgjfqfirfnsuvhu
```

**Get your keys:**
- `SERVICE_ROLE_KEY`: Supabase Dashboard → Settings → API → service_role key
- `OPENAI_API_KEY`: https://platform.openai.com/api-keys

## Step 4: Generate Embeddings (5 minutes)

After deploying, generate embeddings for your seed data:

```bash
# Call ingest_seed function to generate embeddings
curl -X POST https://njcwzwgjfqfirfnsuvhu.supabase.co/functions/v1/ingest_seed \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"museum_id": "YOUR_MUSEUM_UUID", "limit": 50}'
```

Or use Supabase Dashboard → Edge Functions → ingest_seed → Invoke

## Step 5: Deploy Frontend (5-10 minutes)

### Option A: Deploy to Vercel (Recommended - Free)

```bash
cd /Users/hazelmahajan/RV/frontend

# Install Vercel CLI if not installed
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel Dashboard:
# VITE_SUPABASE_URL=https://njcwzwgjfqfirfnsuvhu.supabase.co
# VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Option B: Deploy to Netlify (Free)

```bash
cd /Users/hazelmahajan/RV/frontend

# Install Netlify CLI if not installed
npm i -g netlify-cli

# Deploy
netlify deploy --prod

# Set environment variables in Netlify Dashboard
```

### Option C: Build and Deploy Manually

```bash
cd /Users/hazelmahajan/RV/frontend

# Build for production
npm run build

# The dist/ folder contains your production build
# Upload dist/ to any static hosting service
```

## Quick Deployment Script

Save this as `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

echo "📦 Step 1: Linking Supabase project..."
supabase link --project-ref njcwzwgjfqfirfnsuvhu

echo "🗄️ Step 2: Deploying database migrations..."
supabase db push

echo "⚡ Step 3: Deploying Edge Functions..."
supabase functions deploy redeem_ticket
supabase functions deploy rag_chat
supabase functions deploy ingest_seed

echo "✅ Deployment complete!"
echo "📝 Next steps:"
echo "   1. Set environment variables for Edge Functions"
echo "   2. Generate embeddings using ingest_seed function"
echo "   3. Deploy frontend to Vercel/Netlify"
```

Make it executable: `chmod +x deploy.sh`

## Troubleshooting

### Migration errors
- Check Supabase Dashboard → Database → Migrations
- Run migrations manually in SQL Editor if needed

### Function deployment errors
- Verify environment variables are set
- Check function logs: `supabase functions logs <function-name>`

### Frontend build errors
- Ensure `.env.local` exists with correct values
- Check `npm run build` works locally first

## Time Estimates

- **Database Migrations**: 5-10 minutes
- **Edge Functions**: 10-15 minutes  
- **Frontend**: 5-10 minutes
- **Total**: ~20-35 minutes

## Post-Deployment Checklist

- [ ] Database migrations applied successfully
- [ ] All Edge Functions deployed and accessible
- [ ] Environment variables set for Edge Functions
- [ ] Embeddings generated for content chunks
- [ ] Frontend deployed and accessible
- [ ] Test ticket redemption flow
- [ ] Test chat functionality
- [ ] Verify citations are working

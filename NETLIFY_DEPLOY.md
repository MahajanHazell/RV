# Deploy to Netlify - Quick Guide

## ✅ Your frontend is built and ready!

## Option 1: Deploy via Netlify UI (Easiest - 3 minutes)

### Step 1: Go to Netlify
1. Visit: https://app.netlify.com
2. Sign up/Login (use GitHub, GitLab, or email)

### Step 2: Deploy Site
1. Click **"Add new site"** → **"Deploy manually"**
2. Drag and drop the `frontend/dist` folder (or the `frontend-dist.zip` file)
3. Wait for upload to complete

### Step 3: Add Environment Variables
1. Go to **Site settings** → **Environment variables**
2. Click **"Add a variable"**
3. Add these two:
   - **Key**: `VITE_SUPABASE_URL`
     **Value**: `https://njcwzwgjfqfirfnsuvhu.supabase.co`
   
   - **Key**: `VITE_SUPABASE_ANON_KEY`
     **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qY3d6d2dqZnFmaXJmbnN1dmh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2OTA5NzgsImV4cCI6MjA4NjI2Njk3OH0.LSsEn7PsVEsRxk9JvXMGTSLn1hm_Gz3b05N7qItLYFE`

### Step 4: Redeploy
1. Go back to **Deploys** tab
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Wait ~1 minute

### Step 5: Done! 🎉
You'll get a URL like: `https://random-name-12345.netlify.app`

---

## Option 2: Deploy via Netlify CLI

### Step 1: Login
```bash
cd /Users/hazelmahajan/RV/frontend
netlify login
```
(This will open a browser for authentication)

### Step 2: Initialize Site
```bash
netlify init
```
- Create & configure a new site? → Yes
- Team: Your account
- Site name: museum-guide (or any name)
- Build command: `npm run build`
- Directory to deploy: `dist`
- Netlify functions folder: (leave empty, press Enter)

### Step 3: Add Environment Variables
```bash
netlify env:set VITE_SUPABASE_URL "https://njcwzwgjfqfirfnsuvhu.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qY3d6d2dqZnFmaXJmbnN1dmh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2OTA5NzgsImV4cCI6MjA4NjI2Njk3OH0.LSsEn7PsVEsRxk9JvXMGTSLn1hm_Gz3b05N7qItLYFE"
```

### Step 4: Deploy
```bash
netlify deploy --prod
```

---

## Option 3: Connect GitHub Repo (Best for Updates)

1. Push your code to GitHub first
2. In Netlify: **"Add new site"** → **"Import an existing project"**
3. Connect to GitHub
4. Select your repository
5. Configure:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
6. Add environment variables (same as above)
7. Deploy!

---

## 🎯 Quick Summary

**Backend Status:** ✅ Deployed to Supabase
- Edge Functions: `redeem_ticket`, `rag_chat`, `ingest_seed`, `chat`
- Database: Migrations applied, data seeded
- Environment variables: Set

**Frontend Status:** ✅ Built, ready to deploy
- Build folder: `frontend/dist/`
- Zip file: `frontend-dist.zip` (ready to upload)

**Next:** Deploy frontend to Netlify using one of the options above!

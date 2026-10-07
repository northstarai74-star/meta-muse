# Deployment Guide - Vercel + Supabase

## 🚀 Quick Setup (5 minutes)

### 1. Get Supabase Connection String

**In Supabase Dashboard:**
1. Go to Settings → Database
2. Under "Connection string", select "Connection pooling"
3. Copy the full connection string
4. Replace `[PASSWORD]` with your actual Supabase password

**Example:**
```
postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### 2. Add Environment Variables to Vercel

**In Vercel Project Settings:**
1. Settings → Environment Variables
2. Add these for **all environments** (Production, Preview, Development):

```
DATABASE_URL=postgresql://postgres.xxxxx:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
SESSION_SECRET=82b322eec91b3705bed20c7712fc732a31f33abeb13dac3d9b32be461731879d
ENCRYPTION_KEY=b63cf22a3753ec0ce5d56dc74cc5b27a8c59457b9956cd89b7ff036f226a3698
ADMIN_EMAIL=admin@vanita.local
ADMIN_PASSWORD=ChangeMe123!
OPENROUTER_API_KEY=sk-or-...
```

### 3. Redeploy

1. Go to Deployments
2. Click "Redeploy" on latest failed build
3. Wait for green checkmark ✅

---

## 🔍 Troubleshooting

### Error: "Database isn't ready"
- DATABASE_URL not set on Vercel
- **Fix:** Add DATABASE_URL to Environment Variables

### Error: "Connection refused"
- Supabase connection string wrong
- Password not updated in connection string
- **Fix:** Use "Connection pooling" URL, not direct connection

### Error: "Migration failed"
- Database schema mismatch
- **Fix:** Run locally first: `npx prisma migrate deploy`

### Build takes too long
- First build with Prisma generates Client
- Normal - first deploy takes ~2-3 minutes
- Subsequent deploys are faster

---

## 📊 What Happens During Deploy

```bash
npm run vercel-build
  ↓
# This runs:
prisma migrate deploy  # Apply pending migrations to Supabase
  ↓
next build             # Compile TypeScript & build Next.js app
  ↓
✅ Deploy to Vercel
```

---

## 🔐 Environment Variables Reference

| Variable | Purpose | Required | Example |
|----------|---------|----------|---------|
| DATABASE_URL | Supabase connection | ✅ | postgresql://... |
| SESSION_SECRET | JWT signing | ✅ | 82b322ee... |
| ENCRYPTION_KEY | API key encryption | ✅ | b63cf22a... |
| ADMIN_EMAIL | First admin user | ✅ | admin@vanita.local |
| ADMIN_PASSWORD | First admin password | ✅ | ChangeMe123! |
| OPENROUTER_API_KEY | Jarvis AI brain | ❌ | sk-or-... |
| META_APP_ID | Instagram integration | ❌ | ... |
| META_APP_SECRET | Instagram integration | ❌ | ... |
| BREVO_API_KEY | Email/SMS | ❌ | ... |

---

## 📈 After Successful Deploy

1. **Test the app**
   - Visit your Vercel URL
   - Login with credentials from .env
   - Check dashboard loads

2. **Configure integrations** (optional)
   - Settings → Integrations
   - Add OpenRouter API key for Jarvis
   - Add Meta credentials for Instagram

3. **Enable webhooks** (optional)
   - Integrations page shows webhook URL
   - Set up Meta webhook in Meta app
   - Test with "Simulate incoming event"

---

## 🔄 Redeploying Changes

```bash
# After code changes:
git push origin main

# Vercel auto-deploys on push
# OR manually redeploy:
# Vercel Dashboard → Deployments → Redeploy
```

---

## ⚡ Performance Tips

- First deploy: ~2-3 min (Prisma Client generation)
- Subsequent deploys: ~30-60 sec
- Use "Connection pooling" for best performance
- Keep SESSION_SECRET and ENCRYPTION_KEY safe

---

## 🆘 Need Help?

1. Check build logs in Vercel Deployments tab
2. Verify all Environment Variables are set
3. Ensure DATABASE_URL includes password
4. Test database connection locally first
5. Check Supabase is accessible (no firewall blocks)

---

## ✅ Deployment Checklist

- [ ] DATABASE_URL added to Vercel
- [ ] SESSION_SECRET added to Vercel
- [ ] ENCRYPTION_KEY added to Vercel
- [ ] ADMIN_EMAIL added to Vercel
- [ ] ADMIN_PASSWORD added to Vercel
- [ ] Redeploy triggered
- [ ] Build succeeds (green checkmark)
- [ ] App loads at Vercel URL
- [ ] Can login with admin credentials

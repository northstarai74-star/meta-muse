# Vanita CRM - Quick Start Guide

## 📋 Prerequisites Checklist

- [x] Node.js & npm installed
- [x] PostgreSQL running locally (user: `vanita`, password: `vanita`, db: `vanita`)
- [x] Supabase configured
- [x] Brevo email API configured
- [ ] OpenRouter API key (for Jarvis brain)
- [ ] Meta app credentials (optional, for Instagram integration)

## 🚀 Quick Start (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database

**Option A: Use Local PostgreSQL**
```bash
# Create database and user
psql -U postgres
CREATE DATABASE vanita;
CREATE USER vanita WITH PASSWORD 'vanita';
GRANT ALL PRIVILEGES ON DATABASE vanita TO vanita;
\q
```

**Option B: Use Supabase (Already Configured)**
- Skip to step 3 - your Supabase connection is already in `.env.local`

### 3. Run Migrations
```bash
npx prisma migrate deploy
```

### 4. Seed Demo Data (Optional)
```bash
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```

Visit: http://localhost:3000

**Login:**
- Email: `admin@vanita.local` (optional)
- Password: `ChangeMe123!`

## 🧠 Enable Jarvis AI Brain

### Get OpenRouter API Key
1. Visit https://openrouter.ai
2. Sign up and create API key
3. Add to `.env.local`:
```bash
OPENROUTER_API_KEY="sk-or-..."
```

### Configure Jarvis
1. Start the app: `npm run dev`
2. Go to **Settings**
3. Under "AI Brain" select OpenRouter model
4. Paste your API key
5. Click "Test Connection"

✅ Jarvis is now the brain powering your AI agent!

## 🔗 Enable Meta Integration (Instagram/DMs)

1. Create Meta Business App: https://developers.facebook.com
2. Add Instagram & Webhooks products
3. Fill in `.env.local`:
```bash
META_APP_ID="..."
META_APP_SECRET="..."
META_PAGE_ID="..."
META_PAGE_ACCESS_TOKEN="..."
INSTAGRAM_BUSINESS_ID="..."
```
4. In app Settings → Integrations → paste your credentials
5. Set webhook URL (from Integrations page)
6. Enable webhook subscriptions: `messages`, `comments`, `leadgen`

## 📊 Dashboard Features

**Available Now:**
- ✅ Lead analytics & funnel
- ✅ Team performance metrics
- ✅ Lead source effectiveness
- ✅ Revenue tracking
- ✅ AI agent auto-replies (with Jarvis)
- ✅ Integration management

**New This Session:**
- ✅ Dashboard widgets for team & source analytics
- ✅ Jarvis AI brain powered by OpenRouter
- ✅ Slack, Email, & Webhook integrations
- ✅ Support for 20+ LLM models

## 🛠️ Useful Commands

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run typecheck        # Check TypeScript
npm run lint             # Lint code
npm run db:seed          # Reset & seed demo data
npm run db:reset         # Drop all tables & migrate fresh
```

## 📚 Architecture

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API routes (auth, leads, agents, etc)
│   └── (app)/          # Protected pages (dashboard, leads, etc)
├── lib/
│   ├── agent.ts        # AI agent logic (uses Jarvis)
│   ├── jarvis.ts       # Jarvis brain (OpenRouter interface)
│   ├── integrations/   # Slack, Email, Webhook, OpenRouter
│   ├── ai/classify.ts  # Lead classification
│   └── stats.ts        # Analytics & metrics
└── components/         # React components & UI

prisma/
├── schema.prisma       # Database schema
└── migrations/         # SQL migrations
```

## 🐛 Troubleshooting

**"Database isn't ready"**
- Run: `npx prisma migrate deploy`

**"OpenRouter connection failed"**
- Check API key is correct
- Verify account has credits
- Try different model

**"Meta webhook not working"**
- Ensure APP_URL is publicly accessible (ngrok tunnel)
- Verify X-Hub-Signature-256 validation passes

**Tests failing**
- Run: `npm run db:reset` to reset test DB

## 📞 Support

- Docs: `/README.md`
- Schema: `/prisma/schema.prisma`
- API: Check `/src/app/api/` for endpoints

## 🎯 Next: Wire Up Services

1. **Email Marketing**: Configure Brevo templates
2. **Lead Generation**: Connect Meta Lead Ads
3. **Voice Calls**: Add Vapi/Retell for voice agent
4. **Analytics**: Export to dashboard
5. **Automation**: Set up assignment rules

Happy building! 🚀

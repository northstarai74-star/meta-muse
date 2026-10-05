# Vanita Business OS

A personal CRM / operating system for three business lines: **AI Voice Receptionist**, **Web Development** and **Dropshipping**.
It captures Instagram DMs, comments and Meta Lead Ads, classifies each lead with Claude, assigns it to an AI agent or team member, and tracks leads → converted customers → revenue.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 6 + PostgreSQL · Recharts.

## Run it

```bash
cp .env.example .env     # set DATABASE_URL (Postgres), SESSION_SECRET, ENCRYPTION_KEY, ADMIN_PASSWORD
npm install
npx prisma migrate deploy
npm run db:seed          # optional: demo data + the admin user (see .env)
npm run dev         # http://localhost:3000
```

Login: just `ADMIN_PASSWORD` from `.env` (defaults in `.env.example`) — the email field is optional. Entering an email (`ADMIN_EMAIL`) still works and is the unambiguous way to sign in once team members have their own passwords; without an email, the password is matched against all accounts (admins first), so keep passwords unique. Change the password and both secrets in `.env` before using real data.
`npm run db:seed` **wipes leads/contacts/team** and recreates demo data — don't run it once you have real data.

## What's inside

| Page | What it does |
|---|---|
| Dashboard | Total / Dropshipping / AI Voice / Web Dev leads, converted customers, revenue, conversion rate, charts, funnel, activity |
| Leads | Table + drag-and-drop kanban, filters, bulk assign to a service / AI agent / team member, lead drawer with timeline, convert-to-customer (records revenue) |
| Inbox | Instagram DMs: threads, reply, "Suggest" (Claude draft), create lead from thread |
| Comments & Enquiries | Triage IG comments and lead-ad forms; reply, convert to lead |
| Contacts | CRM: name, contact info, services, assigned team, lifetime value, edit |
| Follow-ups | Reminders per lead (added in the lead drawer), overdue / today / upcoming, sidebar badge, dashboard card |
| Reports | Win rate and revenue by source, service and owner; why leads are lost; days to win; revenue trend |
| Dropshipping store | Products, orders (stock updates automatically, refunds restock), profit & margin, low-stock alerts |
| Marketing | Campaigns with spend and cost-per-lead by channel, plus a content calendar |
| Active clients | Retainers: MRR / ARR, renewals due, paused and churned clients |
| Finance & reserves | *(admins only)* Income vs expenses across deals, the store, campaigns and manual entries; per-business-line P&L; reserve funds (Tax, Emergency, …) with targets, deposits/withdrawals and runway |
| Assistant | Chat / voice assistant on every page (see below) |
| Team | Members, workload, auto-assignment rules per service (AI agent or person) |
| Integrations | Meta connection + webhook details, **multi-key vault** for Meta / Claude / Higgsfield |
| Settings | Demo mode, auto-assign, Claude model |

## Deploy (Vercel + Supabase/Postgres)

1. Set these environment variables in Vercel (Production and Preview): `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY` (64 hex chars), `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `APP_URL`.
   On Supabase use the **Session pooler** connection string (port 5432, IPv4-compatible) as `DATABASE_URL`.
2. Deploy. The `vercel-build` script runs `prisma migrate deploy` before `next build`, so the tables are created automatically.
3. Open the site and sign in with `ADMIN_PASSWORD` (email optional). On an empty database the first sign-in creates the admin, so the seed script isn't needed.

If sign-in shows an error, it now says what's wrong (missing `SESSION_SECRET`, database not migrated, …).

## Demo mode vs live

Demo mode (default) uses built-in keyword classification, never calls Claude and never sends anything through Meta.
Integrations → "Simulate incoming Meta events" pushes fake DMs/comments/lead ads through the same pipeline the real webhook uses.

To go live:

1. Create a Meta app (Business type) with the Instagram and Webhooks products; connect your Instagram professional account to a Facebook Page.
2. Expose the app over HTTPS (e.g. `ngrok http 3000` or a Cloudflare tunnel) and set `APP_URL` in `.env`.
3. In **Integrations**: save App ID, App secret (used to verify Meta's `X-Hub-Signature-256`), Page ID, Instagram business ID and a long-lived Page access token.
4. In Meta's webhook settings use the callback URL and verify token shown in Integrations; subscribe to `messages`, `comments` and `leadgen`.
   Permissions needed: `instagram_manage_messages`, `instagram_manage_comments`, `pages_messaging`, `pages_manage_metadata`, `leads_retrieval`, `pages_show_list`.
   Messaging/lead access requires Meta App Review for anyone other than app roles/testers.
5. Add at least one Claude key, then turn off **Demo mode** in Settings.

## Assistant (OpenRouter chat + ElevenLabs voice)

The round button at the bottom-right of every page opens the assistant. You can type to it, or tap the mic and speak (voice input uses the browser's speech recognition: Chrome, Edge or Safari). It answers from live business data and can act when you tell it to — add a follow-up, add a note to a lead, and (admins) log an income/expense.

1. **Integrations → OpenRouter → Add key** turns the chat on. **Integrations → ElevenLabs → Add key** gives it a spoken voice (without one it falls back to the browser's built-in voice). Use **Test** to verify each key.
2. **Settings → Assistant** sets the OpenRouter model (default `openrouter/auto`; pick one that supports tool calling), the ElevenLabs voice ID, whether replies are spoken, and the **instructions** — how it should behave. Blank uses sensible built-in instructions.

Safety: the assistant cannot message customers, delete data, change prices or move reserve money, and it is told to treat anything written inside leads/messages as untrusted. Finance numbers and the finance tool are admin-only. Chat is limited to 20 requests/minute per user and voice to 30, to protect your credits. Your keys stay on the server (encrypted at rest) and are never sent to the browser.

## API keys

Keys are encrypted at rest (AES-256-GCM, `ENCRYPTION_KEY`) and never returned by the API — only the last 4 characters.
You can add several keys per provider. `withKey()` in `src/lib/keys.ts` uses them round-robin by priority; a `429` marks a key *rate limited* (retried after 5 min) and a `401/403` disables it, then the next key is tried automatically.

OpenRouter and ElevenLabs keys can be verified with **Test**. Higgsfield keys are stored but nothing calls Higgsfield yet, and its **Test** button does not verify the key.

## Layout

```
prisma/schema.prisma      data model       prisma/seed.ts   demo data
src/proxy.ts              login gate       src/lib/session.ts   JWT cookie session
src/lib/ingest.ts         lead capture + auto-assignment
src/lib/ai/classify.ts    Claude classification / reply drafts (+ offline fallback)
src/lib/meta.ts           Graph API client, signature check
src/app/api/meta/webhook  public Meta webhook
src/app/(app)/*           pages          src/components/*   UI
```

## Checks

`npm run lint`, `npm run typecheck`, `npm test` and `npm run build` run on every push/PR via `.github/workflows/ci.yml`.

## Notes

- Built for personal/local use. Before exposing it publicly: set strong secrets and serve over HTTPS. Login is rate-limited (10 failed attempts / 15 min per IP, in-memory — use a shared store if you run multiple instances).
- Data lives in PostgreSQL (`DATABASE_URL`). CI applies the migrations to a real Postgres on every push.

# Vanita Business OS

A personal CRM / operating system for three business lines: **AI Voice Receptionist**, **Web Development** and **Dropshipping**.
It captures Instagram DMs, comments and Meta Lead Ads, classifies each lead with an LLM via OpenRouter, assigns it to an AI agent or team member, and tracks leads → converted customers → revenue.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 6 + Postgres · Recharts.

## Run it

```bash
npm install
npx prisma migrate deploy   # create tables (needs a Postgres DATABASE_URL in .env)
npm run db:seed     # creates demo data + the admin user (see .env)
npm run dev         # http://localhost:3000
```

Login: `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (defaults in `.env.example`). Change the password and both secrets in `.env` before using real data.
`npm run db:seed` **wipes leads/contacts/team** and recreates demo data — don't run it once you have real data.

## What's inside

| Page | What it does |
|---|---|
| Dashboard | Total / Dropshipping / AI Voice / Web Dev leads, converted customers, revenue, conversion rate, charts, funnel, activity |
| Leads | Table + drag-and-drop kanban, filters, bulk assign to a service / AI agent / team member, lead drawer with timeline, convert-to-customer (records revenue) |
| Inbox | Instagram DMs: threads, reply, "Suggest" (AI draft), create lead from thread |
| Comments & Enquiries | Triage IG comments and lead-ad forms; reply, convert to lead |
| Contacts | CRM: name, contact info, services, assigned team, lifetime value, edit |
| Team | Members, workload, auto-assignment rules per service (AI agent or person) |
| Integrations | Meta connection + webhook details, **multi-key vault** for Meta / OpenRouter / Higgsfield |
| Settings | Demo mode, auto-assign, AI model |

## Deploy to Vercel

1. Create a Postgres database (Vercel Storage → Neon, or Supabase) and copy its connection string.
2. Import the repo in Vercel. In **Settings → Environment Variables** set `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY` (64 hex chars), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `APP_URL` (your Vercel URL).
3. Deploy. `vercel-build` runs `prisma migrate deploy` before `next build`, so tables are created automatically.
4. Seed the first admin + demo data once, from your machine: `DATABASE_URL="<prod url>" npm run db:seed` (this wipes leads/contacts/team — run it only on an empty database).

Every push to a branch gets its own preview URL; point previews at a separate database if you don't want them sharing prod data.

## Demo mode vs live

Demo mode (default) uses built-in keyword classification, never calls the AI model and never sends anything through Meta.
Integrations → "Simulate incoming Meta events" pushes fake DMs/comments/lead ads through the same pipeline the real webhook uses.

To go live:

1. Create a Meta app (Business type) with the Instagram and Webhooks products; connect your Instagram professional account to a Facebook Page.
2. Expose the app over HTTPS (e.g. `ngrok http 3000` or a Cloudflare tunnel) and set `APP_URL` in `.env`.
3. In **Integrations**: save App ID, App secret (used to verify Meta's `X-Hub-Signature-256`), Page ID, Instagram business ID and a long-lived Page access token.
4. In Meta's webhook settings use the callback URL and verify token shown in Integrations; subscribe to `messages`, `comments` and `leadgen`.
   Permissions needed: `instagram_manage_messages`, `instagram_manage_comments`, `pages_messaging`, `pages_manage_metadata`, `leads_retrieval`, `pages_show_list`.
   Messaging/lead access requires Meta App Review for anyone other than app roles/testers.
5. Add at least one OpenRouter key, then turn off **Demo mode** in Settings.

## API keys

Keys are encrypted at rest (AES-256-GCM, `ENCRYPTION_KEY`) and never returned by the API — only the last 4 characters.
You can add several keys per provider. `withKey()` in `src/lib/keys.ts` uses them round-robin by priority; a `429` marks a key *rate limited* (retried after 5 min) and a `401/403` disables it, then the next key is tried automatically.

Higgsfield keys are stored but nothing calls Higgsfield yet, and its **Test** button does not verify the key.

## Layout

```
prisma/schema.prisma      data model       prisma/seed.ts   demo data
src/proxy.ts              login gate       src/lib/session.ts   JWT cookie session
src/lib/ingest.ts         lead capture + auto-assignment
src/lib/ai/classify.ts    OpenRouter classification / reply drafts (+ offline fallback)
src/lib/meta.ts           Graph API client, signature check
src/app/api/meta/webhook  public Meta webhook
src/app/(app)/*           pages          src/components/*   UI
```

## Notes

- Built for personal/local use. Before exposing it publicly: set strong secrets, serve over HTTPS, and add login rate-limiting.
- Data lives in Postgres (`DATABASE_URL`). Locally, any Postgres works; on Vercel use Neon / Supabase / Vercel Postgres.

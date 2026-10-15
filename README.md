# Vanita Business OS

A personal CRM / operating system for three business lines: **AI Voice Receptionist**, **Web Development** and **Dropshipping**.
It captures Instagram DMs, comments and Meta Lead Ads, classifies each lead with Claude, assigns it to an AI agent or team member, and tracks leads → converted customers → revenue.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 6 + PostgreSQL · Recharts.

## Run locally on Windows

1. Install **Node 22 LTS** (`winget install OpenJS.NodeJS.LTS`), **Git** (`winget install Git.Git`) and **PostgreSQL 16** (`winget install PostgreSQL.PostgreSQL.16`). Keep port 5432 and remember the `postgres` password.
2. In `psql` (or pgAdmin) create the database user and database:
   ```sql
   CREATE USER muse WITH PASSWORD 'muse';
   CREATE DATABASE muse OWNER muse;
   ```
   (Or, with Docker Desktop installed instead: `docker compose up -d` uses `docker-compose.yml`.)
3. In PowerShell, from the project folder:
   ```powershell
   copy .env.example .env
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # paste the output as ENCRYPTION_KEY
   ```
   Edit `.env`: set `DATABASE_URL="postgresql://muse:muse@localhost:5432/muse"`, a long `SESSION_SECRET` and `CRON_SECRET`, an `ADMIN_PASSWORD` of 8+ characters, and the `ENCRYPTION_KEY` you generated.
4. Check the file, then install and set up the database:
   ```powershell
   npm run env:check
   npm install
   npx prisma migrate deploy
   ```
5. Start it with `npm run dev` and open http://localhost:3000. `npm run dev` runs the env check first and stops with a clear message if something is missing. Sign in with `ADMIN_PASSWORD` (the email box can stay empty).

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
| Team | Members (add, edit, reset password, remove), workload, auto-assignment rules per service (AI agent or person) |
| Creative Studio | Generate post / reel / ad images with Higgsfield |
| Integrations | Meta connection + webhook details, **multi-key vault** for Meta / Claude / Higgsfield |
| Settings | Demo mode, auto-assign, AI agent auto-replies, Claude model, change your password |

## AI agent

Leads routed to the **AI agent** (Team → auto-assignment rules) get an automatic Instagram reply as soon as their DM arrives.
Claude writes the reply and decides whether a person should take over (they ask for a human or a call, want a quote, are upset, or it's unsure).
On hand-off the lead moves to the rule's owner (or the least-busy member) with the reason in its timeline; the agent also stops after 4 replies, and whenever someone replies by hand from the Inbox.
In demo mode a built-in agent answers instead and replies are recorded but not sent. Turn it off with Settings → **AI agent auto-replies**.

## Deploy (Vercel + Supabase/Postgres)

1. Set these environment variables in Vercel (Production and Preview): `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY` (64 hex chars), `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `APP_URL`, `CRON_SECRET`.
   On Supabase use the **Session pooler** connection string (port 5432, IPv4-compatible) as `DATABASE_URL`.
2. Deploy. The `vercel-build` script runs `prisma migrate deploy` before `next build`, so the tables are created automatically.
3. Open the site and sign in with `ADMIN_PASSWORD` (email optional). On an empty database the first sign-in creates the admin, so the seed script isn't needed.

If sign-in shows an error, it now says what's wrong (missing `SESSION_SECRET`, database not migrated, …).

**Locked out?** Signing in with exactly `ADMIN_EMAIL` + `ADMIN_PASSWORD` from the environment always works: it resets that account's password to `ADMIN_PASSWORD` and makes it an admin, or creates it if the email changed.
Set both in Vercel, redeploy, sign in (the email box can be left empty). This only works when `ADMIN_PASSWORD` is at least 8 characters and isn't the example `ChangeMe123!`.
Because these variables act as a master key, keep them secret, or remove `ADMIN_PASSWORD` once you're back in and have set a password in Settings.

**Scheduled sync.** `vercel.json` runs `GET /api/meta/sync` once a day (Vercel sends `Authorization: Bearer $CRON_SECRET`), which backfills recent DM threads in case a webhook delivery was lost.
Daily is the most the Hobby plan allows; on Pro change the schedule to e.g. `*/15 * * * *`, or call the endpoint more often from any external scheduler with the same header.

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

## API keys

Keys are encrypted at rest (AES-256-GCM, `ENCRYPTION_KEY`) and never returned by the API — only the last 4 characters.
You can add several keys per provider. `withKey()` in `src/lib/keys.ts` uses them round-robin by priority; a `429` marks a key *rate limited* (retried after 5 min) and a `401/403` disables it, then the next key is tried automatically.

Higgsfield keys are entered as `KEY_ID:KEY_SECRET` and power **Creative Studio** (`flux-pro/kontext/max/text-to-image`). **Test** checks the credentials without spending credits.
A job is polled with the key that started it, so don't delete a key while its images are still generating.

## Connections, finance, email, website and assistant

- **Integrations** now also store keys for **WhatsApp Business** (`PHONE_NUMBER_ID:ACCESS_TOKEN`, webhook `/api/whatsapp/webhook`, verify token in `WHATSAPP_VERIFY_TOKEN`), **LinkedIn** (OAuth access token), **YouTube** (Data API key) and **Brevo** (v3 API key). Each key has a **Test** button; keys rotate and are encrypted like the others.
- **WhatsApp agent**: inbound WhatsApp texts are stored as conversations (Inbox) and answered by the AI agent unless it hands off to a person.
- **Email** (Brevo): send email to up to 50 recipients, set the verified sender, and push CRM contacts with an email into Brevo.
- **Finance**: income and expenses with monthly and all-time totals.
- **Website**: edit the public site content; `GET /api/public/site` returns it only while **Published** is on.
- **AI Assistant**: chat with Claude about leads, conversations and finances (uses the Claude key vault).

LinkedIn and YouTube are connected and tested here; posting or reading their content is not built yet.

## Layout

```
prisma/schema.prisma      data model       prisma/seed.ts   demo data
src/proxy.ts              login gate       src/lib/session.ts   JWT cookie session
src/lib/ingest.ts         lead capture + auto-assignment
src/lib/agent.ts          AI agent auto-replies + hand-off       src/lib/outbox.ts   sending DMs
src/lib/higgsfield.ts     Higgsfield image jobs                  src/lib/sync.ts     Meta backfill (manual + cron)
src/lib/ai/classify.ts    Claude classification / reply drafts (+ offline fallback)
src/lib/meta.ts           Graph API client, signature check
src/app/api/meta/webhook  public Meta webhook
src/app/(app)/*           pages          src/components/*   UI
```

## Checks

`npm run lint`, `npm run typecheck`, `npm test` and `npm run build` run on every push/PR via `.github/workflows/ci.yml`.

## Notes

- Built for personal/local use. Before exposing it publicly: set strong secrets and serve over HTTPS. Login is rate-limited (10 failed attempts / 15 min per IP), stored in Postgres so every serverless instance shares the count.
- Messages you send from the Instagram app itself arrive as webhook "echoes" and appear in the Inbox too.
- Data lives in PostgreSQL (`DATABASE_URL`). CI applies the migrations to a real Postgres on every push.

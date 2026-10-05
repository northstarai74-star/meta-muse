# Vanita Business OS

A personal CRM / operating system for three business lines: **AI Voice Receptionist**, **Web Development** and **Dropshipping**.
It captures Instagram DMs, comments and Meta Lead Ads, classifies each lead with Claude, assigns it to an AI agent or team member, and tracks leads → converted customers → revenue.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 6 + SQLite · Recharts.

## Run it

```bash
npm install
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
| Inbox | Instagram DMs: threads, reply, "Suggest" (Claude draft), create lead from thread |
| Comments & Enquiries | Triage IG comments and lead-ad forms; reply, convert to lead |
| Contacts | CRM: name, contact info, services, assigned team, lifetime value, edit |
| Team | Members, workload, auto-assignment rules per service (AI agent or person) |
| AI Agent | Approval queue, audit log, autonomy controls and background-job health |
| Integrations | Meta connection + webhook details, **multi-key vault** for Meta / Claude / Higgsfield |
| Settings | Demo mode, auto-assign, Claude model |

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

Higgsfield keys are stored but nothing calls Higgsfield yet, and its **Test** button does not verify the key.

## AI agent & background jobs

The agent works leads assigned to **AI agent** (set per service on the Team page). It is **off by default** — switch it on at *AI Agent → Controls*.

```
Meta webhook / sync / simulate ──► ingest ──► job queue ──► agent run ──► policy gate ──► execute | approval queue
```

- **Job queue** (`src/lib/jobs.ts`): durable DB-backed jobs with atomic claiming, retries with backoff, stuck-job recovery and self-rescheduling recurring jobs (stale-lead scan, DM sync, Meta token check, cleanup). The webhook only verifies the signature and enqueues, so Meta always gets a fast 200 and failed events are retried. Failed jobs can be retried from *AI Agent → System*.
- **Worker**: starts with the server (`src/instrumentation.ts`). On serverless hosts set `WORKER_DISABLED=1` and have a cron call `POST /api/jobs/tick` every minute with `Authorization: Bearer $CRON_SECRET`.
- **Agent** (`src/lib/agent/`): each run gives Claude the lead, conversation, comments and timeline and lets it call tools — `send_dm`, `reply_comment`, `update_lead`, `schedule_followup`, `escalate_to_human`. Without a Claude key (or in demo mode) a deterministic rule-based planner proposes the same actions with conservative confidence.
- **Autonomy controls**: every tool is *Off*, *Ask me* (queued for approval) or *Auto*. Auto actions below the confidence threshold, over the daily send cap, or beyond 4 automatic DMs per person per 24h fall back to the approval queue. A daily token budget pauses planning. Defaults: DMs and comment replies need approval; lead updates, follow-ups and escalations run automatically.
- **Approval queue / audit log**: every proposal is stored (`AgentAction`) with its reasoning, confidence, outcome and who approved it; reviewers can edit a message before sending. Stale suggestions are superseded, and a suggestion is dropped if a human replied in the meantime.
- **Kill switch**: the *Agent enabled* toggle stops all runs and queueing immediately.
- **Prompt-injection posture**: prospect text is passed as delimited, sanitised data; the model can only act through the whitelisted tools and only on the lead/conversation/comments in its context; it can never mark a lead WON.

Heads-up: a send in live mode still needs the prospect's last message to be under Instagram's 24-hour window; later replies fail with a clear message and stay in the queue.

## Layout

```
prisma/schema.prisma      data model       prisma/seed.ts   demo data
src/proxy.ts              login gate       src/lib/session.ts   JWT cookie session
src/lib/ingest.ts         lead capture + auto-assignment
src/lib/ai/classify.ts    Claude classification / reply drafts (+ offline fallback)
src/lib/jobs.ts           job queue          src/lib/worker.ts     job handlers + in-process worker
src/lib/agent/            agent runtime: context, tools, planner, runner (policy gate), stale-lead scan
src/lib/meta.ts           Graph API client, signature check
src/app/api/meta/webhook  public Meta webhook
src/app/(app)/*           pages          src/components/*   UI
```

## Notes

- Built for personal/local use. Before exposing it publicly: set strong secrets, serve over HTTPS, and add login rate-limiting.
- SQLite file lives at `prisma/dev.db`; the schema is portable to Postgres by changing the datasource provider.

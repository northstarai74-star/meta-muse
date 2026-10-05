# NorthStar AI CFO

(Rebranded from "Vanita Business OS"; features are unchanged.)

A personal CRM / operating system for three business lines: **AI Voice Receptionist**, **Web Development** and **Dropshipping**.
It captures Instagram DMs, comments and Meta Lead Ads, classifies each lead with Claude, assigns it to an AI agent or team member, and tracks leads → converted customers → revenue.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Auth + Postgres) · Prisma 6 · Recharts.

## Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings > API**: copy the project URL, the anon (or publishable) key and the `service_role` key.
3. **Project Settings > Database > Connection string**: copy the **Transaction pooler** string (port 6543) for `DATABASE_URL` and append `?pgbouncer=true`. Use the **Session pooler** string (port 5432) for `DIRECT_URL`; Prisma uses it for migrations.
4. **Authentication > Sign In / Providers**: turn off "Allow new users to sign up". Only admins add logins, from the Team page.

## Run it

```bash
npm install
cp .env.example .env     # fill in the Supabase values, ENCRYPTION_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
npx prisma migrate deploy
npm run db:seed          # creates the admin login in Supabase Auth + demo data
npm run dev              # http://localhost:3000
```

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`; use a real email address you own. The demo team members are created as `you+aisha@yourdomain.com` and so on, with the same password. Change that password before using real data.
`npm run db:seed` **wipes leads, contacts, follow-ups and team** and recreates demo data (costs, tokens and settings are kept) — don't run it once you have real data.

## What's inside

| Page | What it does |
|---|---|
| Dashboard | Leads per service, converted customers, revenue, conversion rate, **spend, profit, cost per client and monthly budget used**, a **follow-ups due** list, charts, funnel, activity |
| Leads | Table + drag-and-drop kanban (New → Contacted → Qualified → Demo booked → Proposal → Won), filters, bulk assign, lead drawer with **follow-up tasks** and timeline, convert-to-customer (records revenue in £) |
| Inbox | Instagram DMs: threads, reply, "Suggest" (Claude draft), create lead from thread |
| Comments & Enquiries | Triage IG comments and lead-ad forms; reply, convert to lead |
| Contacts | CRM: contact info, website / industry / country, services, assigned team, lifetime value, **do-not-contact flag and lawful basis** |
| Import prospects | CSV import of cold-email lists (limited to 5,000 rows) into contacts + leads, with duplicate and do-not-contact skipping |
| Costs | Log spend in ₹ / £ / $ by category; feeds profit, cost per client and budget used |
| Team | Members, workload, auto-assignment rules per service (AI agent or person) |
| Integrations | Meta connection + webhook details, **multi-key vault** for Meta / Claude / Higgsfield, **API tokens for n8n** |
| Settings | Demo mode, auto-assign, dashboard currency, exchange rates, monthly budget (default ₹15,000), Claude model |

## Outbound: cold email into the pipeline

1. Build your list elsewhere (a scraper, a lead database) and export a CSV with columns such as name, email, company, website, industry, country.
2. **Import prospects**: pick the service you are pitching, the starting stage and the lawful basis, then import. Existing contacts, people already in the pipeline for that service, and anyone marked do-not-contact are skipped. Imports never call Claude, so a big list costs nothing in API fees.
3. Send the emails from a proper cold-email tool on separate sending domains. When someone replies, move the lead (Contacted → Qualified → Demo booked …), add a follow-up task, and mark opt-outs as do-not-contact.

UK note: PECR lets you send B2B marketing email to limited companies and LLPs with clear identification and an opt-out, but sole traders and most partnerships are treated as individuals and usually need prior consent. The app records your lawful basis; it does not check the law for you, and this is not legal advice.

## Connect n8n (or any automation tool)

1. **Integrations > Automation API > New token.** Copy the token when it is shown; it is not stored and cannot be shown again.
2. In n8n use an HTTP Request node with the header `Authorization: Bearer <token>`.
3. `POST /api/ingest/lead` adds a lead: `name`, and `email` or `phone`, are required; optional `company`, `website`, `industry`, `country`, `message`, `service` (`AI_VOICE`, `WEB_DEV`, `DROPSHIPPING`), `stage`, `source` (`API`, `COLD_EMAIL`, `IMPORT`). Without `service`, Claude classifies the `message`. The response says `created`, `duplicate` or `do_not_contact`.
4. `GET /api/ingest/stats?range=30` returns KPIs, funnel, finance and the number of follow-ups due.
5. Tokens only work on these two endpoints. Revoke one from the same page at any time.

## Money and currency

Client payments are recorded in pounds (£). Costs carry their own currency (₹, £ or $). The dashboard converts everything to the currency chosen in Settings using the exchange rates you enter there (defaults: ₹105 per £1, ₹85 per $1; update them when the rate moves). The monthly budget (default ₹15,000) is compared with this calendar month's costs.

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

## Layout

```
prisma/schema.prisma      data model       prisma/seed.ts   demo data
src/proxy.ts              login gate       src/lib/supabase/*   Supabase auth clients
src/lib/session.ts        current app user from the Supabase session
src/lib/ingest.ts         lead capture + auto-assignment
src/lib/ai/classify.ts    Claude classification / reply drafts (+ offline fallback)
src/lib/meta.ts           Graph API client, signature check
src/app/api/meta/webhook  public Meta webhook
src/app/(app)/*           pages          src/components/*   UI
```

## Notes

- Built for personal/local use. Before exposing it publicly: set strong secrets, serve over HTTPS, and add login rate-limiting.
- Logins are in Supabase Auth; each app user row (`User.authId`) links to one. Tables have Row Level Security on with no policies, so the browser's anon key cannot read them; the app accesses data through Prisma only.
- Adding a team member on the Team page creates their Supabase login (the "temporary password" is their password); removing them deletes it.

## Deploy to Vercel

1. Set up Supabase as above.
2. In the Vercel project, set every variable from `.env.example`: the three Supabase values, `DATABASE_URL`, `DIRECT_URL`, `ENCRYPTION_KEY`, `APP_URL` (your `https://….vercel.app` URL), and `ADMIN_EMAIL` / `ADMIN_PASSWORD` if you want them there.
3. Deploy. `vercel-build` runs `prisma migrate deploy` before `next build`, and `postinstall` generates the Prisma client.
4. Create the admin once, from your machine, with `.env` pointing at the same Supabase project: `npm run db:seed`. This also loads demo data and wipes existing leads/contacts/team, so only run it on a new database.
5. If sign-in fails, check the Vercel function logs and confirm all environment variables are set. "Sign-in isn't configured" means a `NEXT_PUBLIC_SUPABASE_*` value is missing (redeploy after adding it, since these are baked in at build time). "Your account isn't set up in this workspace" means the Supabase login exists but has no matching Team member.

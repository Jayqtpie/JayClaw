# JayClaw Control Center (Next.js)

A Vercel-ready Next.js (App Router, TypeScript) control panel for securely operating an **OpenClaw Gateway**.

## Security model

- **Gateway token never reaches the browser.**
- The browser calls **Next.js Route Handlers** under `src/app/api/...`.
- Those handlers call the Gateway using server-only env vars:
  - `OPENCLAW_GATEWAY_URL`
  - `OPENCLAW_GATEWAY_TOKEN`
- A simple app gate protects all pages + API routes using:
  - `APP_ACCESS_KEY`
  - An httpOnly cookie session (`occ_session`) validated server-side
- **Safe Mode (read-only):**
  - Toggle in the header.
  - Stored as a signed httpOnly cookie (`occ_safe_mode`).
  - Mutating API routes call `requireNotSafeMode()` and return `409 safe_mode_enabled` when blocked.
- **Audit trail:**
  - Mutating API routes append JSONL entries to `./.jayclaw-data/audit.jsonl` when a writable filesystem is available.
  - On serverless / read-only filesystems, the app automatically falls back to an in-memory log (graceful empty state on cold start).

## Pages

- `/console` – send a message to the main session
- `/subagents` – list + send “spawn/steer” request (MVP placeholder)
- `/ops` – gateway status + restart button
- `/scheduler` – create/list/run reminders (MVP in-memory store)
- `/memory` – memory search + snippet view (gateway-first; filesystem fallback)
- `/health` – **Health Wall** (gateway status, token check, SSL expiry, recent failures)
- `/audit` – **Audit Trail** panel (local JSONL store)
- `/quick` – **Quick Actions** templates/macros

## Local development

```bash
cd /home/ubuntu/.openclaw/workspace/projects/jayclaw-control-center
cp .env.example .env.local

# edit .env.local
# - OPENCLAW_GATEWAY_URL
# - OPENCLAW_GATEWAY_TOKEN
# - APP_ACCESS_KEY

npm install
npm run dev
```

Open: <http://localhost:3000>

## Vercel deployment

1. Push this project to GitHub.
2. Import it into Vercel.
3. Set these Environment Variables in Vercel:
   - `OPENCLAW_GATEWAY_URL`
   - `OPENCLAW_GATEWAY_TOKEN`
   - `APP_ACCESS_KEY`
   - (optional) `OPENCLAW_MEMORY_DIR` (only relevant if you deploy with memory files available)
4. Deploy.

### Vercel runtime notes (persistence)

Vercel Serverless/Edge runtimes often have an **ephemeral and/or read-only filesystem**.

JayClaw’s local persistence (chat thread + audit trail) is therefore **best-effort**:

- By default it tries to write under `./.jayclaw-data/`.
- If writes fail (e.g. `EROFS`), it automatically **falls back to in-memory storage** and API routes return **graceful empty states** (no hard 500s).

You can control this with:

- `JAYCLAW_DATA_DIR` – path to a writable directory (if your runtime provides one)
- `JAYCLAW_AUDIT_PATH` – override the audit JSONL file path
- `JAYCLAW_PERSISTENCE=memory` – force in-memory mode (useful for strict serverless)

If you need durable history on Vercel, wire these stores to a DB/kv (Upstash/Redis, Postgres, etc.).

### Notes

- The Gateway API shape can differ between deployments.
  - Update **one place**: `src/lib/openclaw.ts` (`gatewayFetch()` / `invokeTool()`).
- Scheduler is an MVP and stores reminders in memory (resets on server restart / redeploy).
  - For production, wire this to your Gateway scheduler or persistent storage.

## Scripts

- `npm run dev` – local dev server
- `npm run build` – production build
- `npm start` – start production server

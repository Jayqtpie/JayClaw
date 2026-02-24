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

## Pages

- `/console` – send a message to the main session
- `/subagents` – list + send “spawn/steer” request (MVP placeholder)
- `/ops` – gateway status + restart button
- `/scheduler` – create/list/run reminders (MVP in-memory store)
- `/memory` – memory search + snippet view (gateway-first; filesystem fallback)

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

### Notes

- The Gateway API shape can differ between deployments.
  - Update **one place**: `src/lib/openclaw.ts` (`gatewayFetch()` / `invokeTool()`).
- Scheduler is an MVP and stores reminders in memory (resets on server restart / redeploy).
  - For production, wire this to your Gateway scheduler or persistent storage.

## Scripts

- `npm run dev` – local dev server
- `npm run build` – production build
- `npm start` – start production server

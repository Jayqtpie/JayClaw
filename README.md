# JayClaw Control Center (Next.js)

A Vercel-ready Next.js (App Router, TypeScript) control panel for operating an **OpenClaw Gateway** with a security-first, server-only token model.

> Security note: this README intentionally avoids real URLs, IDs, tokens, IPs, and internal host paths. **Never** commit `.env*` or secret values.

## Security model (high level)

- **Gateway token never reaches the browser.**
- The browser calls **Next.js Route Handlers** under `src/app/api/...`.
- Those handlers call the Gateway using **server-only** env vars:
  - `OPENCLAW_GATEWAY_URL`
  - `OPENCLAW_GATEWAY_TOKEN`
- A simple app gate protects all pages + API routes using:
  - `APP_ACCESS_KEY`
  - a signed, httpOnly session cookie (validated server-side)
- **Safe Mode (read-only):**
  - Mutating API routes return `409 safe_mode_enabled` when blocked.
- **Audit trail:**
  - Mutating API routes append JSONL entries when a writable filesystem is available.
  - On serverless / read-only filesystems, the app falls back to in-memory storage.

## Pages

- `/diagnostics` – PASS/FAIL capability matrix + one-click **Run probes**
- `/ops` – gateway status + config diagnostics (restart is intentionally disabled)
- `/health` – Health Wall (gateway status, auth check, recent failures)
- `/console` – message send (capability-gated)
- `/subagents` – list subagents (spawn/steer disabled unless verified)
- `/scheduler` – create/list/toggle reminders (local store; “run now” disabled)
- `/memory` – memory search + snippet view (gateway-first; filesystem fallback)
- `/audit` – Audit Trail panel
- `/quick` – Quick Actions templates/macros (capability-gated)

## Capability-gated by design

JayClaw is explicitly **capability-gated** to avoid fake success states.

In restricted/public gateway deployments, some tools/actions may be unavailable (commonly via `404/405`). The UI will disable those actions with an explicit “Unavailable in current gateway mode” message.

## Local development

```bash
# from the repo root
cp .env.example .env.local

# edit .env.local with your values
npm install
npm run dev
```

## Deployment (Vercel or similar)

Set these Environment Variables:

Required:
- `OPENCLAW_GATEWAY_URL` (e.g. `https://your-gateway-domain.example`)
- `OPENCLAW_GATEWAY_TOKEN`
- `APP_ACCESS_KEY`

Optional (Console send requirements):
- `DEFAULT_MESSAGE_TARGET`
- `DEFAULT_MESSAGE_CHANNEL` (default: `discord`)

Optional (best-effort relay fallback when direct send is blocked):
- `RELAY_SESSION_KEY`
- `RELAY_TOOL_NAMESPACE` / `RELAY_TOOL_ACTION`

## Runtime notes (persistence)

Serverless runtimes often have an **ephemeral and/or read-only filesystem**.

Local persistence (audit + diagnostics cache) is therefore **best-effort**:

- Default write directory: `./.jayclaw-data/`
- If writes fail (e.g. `EROFS`), the app automatically falls back to **in-memory storage**.

You can control persistence with:

- `JAYCLAW_DATA_DIR` – path to a writable directory
- `JAYCLAW_AUDIT_PATH` – override the audit JSONL file path
- `JAYCLAW_DIAGNOSTICS_PATH` – override the diagnostics JSON path
- `JAYCLAW_PERSISTENCE=memory` – force in-memory mode

## Scripts

- `npm run dev` – local dev server
- `npm run build` – production build
- `npm start` – start production server

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
  - On serverless / read-only filesystems, the app automatically falls back to an in-memory log.

## Pages

- `/diagnostics` – **PASS/FAIL capability matrix** (with timestamps) + one-click **Run probes**
- `/ops` – gateway status (`session_status`) + config diagnostics (restart is intentionally disabled)
- `/health` – **Health Wall** (gateway status, token check, SSL expiry, recent failures)
- `/console` – console message send (capability-gated; requires env + gateway support)
- `/subagents` – list subagents (spawn/steer is intentionally disabled unless verified)
- `/scheduler` – create/list/toggle reminders (local in-memory store; run-now is intentionally disabled)
- `/memory` – memory search + snippet view (gateway-first; filesystem fallback)
- `/audit` – **Audit Trail** panel (local JSONL store)
- `/quick` – **Quick Actions** templates/macros (capability-gated)

## Functional surface in current gateway mode

JayClaw is explicitly **capability-gated** to avoid fake success states.

Verified via real probes (`/diagnostics`):

- PASS:
  - `session_status`
  - `subagents.list` (read-only)
  - Memory: local filesystem mode (when configured) OR `memory.search` (gateway)
  - Local modules: Audit log read, Scheduler list/create/toggle

Intentionally disabled (shows **Unavailable in current gateway mode**):

- Chat module (removed completely)
- Gateway restart (public API not exposed)
- Scheduler “Run now” (requires verified message-send capability)
- Subagents spawn/steer (mutating + not safe to auto-probe)

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

## Deployment (Vercel or similar)

Set these Environment Variables:

- `OPENCLAW_GATEWAY_URL`
- `OPENCLAW_GATEWAY_TOKEN`
- `APP_ACCESS_KEY`

Optional (Console send requirements):

- `DEFAULT_MESSAGE_TARGET` (or `OWNER_TARGET`)
- `DEFAULT_MESSAGE_CHANNEL` (default: `discord`)

Optional relay fallback (best-effort delivery when direct send is blocked):

- `RELAY_SESSION_KEY` (default: `agent:main:main`)
- `RELAY_TOOL_NAMESPACE` / `RELAY_TOOL_ACTION` (fallback tool path)

### Runtime notes (persistence)

Serverless runtimes often have an **ephemeral and/or read-only filesystem**.

JayClaw’s local persistence (audit + diagnostics cache) is therefore **best-effort**:

- By default it tries to write under `./.jayclaw-data/`.
- If writes fail (e.g. `EROFS`), it automatically **falls back to in-memory storage**.

You can control this with:

- `JAYCLAW_DATA_DIR` – path to a writable directory
- `JAYCLAW_AUDIT_PATH` – override the audit JSONL file path
- `JAYCLAW_DIAGNOSTICS_PATH` – override the diagnostics JSON path
- `JAYCLAW_PERSISTENCE=memory` – force in-memory mode

## Known gateway limitations + graceful behavior

OpenClaw Gateway deployments can vary by **base path**, **available tools**, and **tool invocation schema**.

JayClaw is designed to **degrade gracefully**:

- Tool invocation is centralized in **one place**: `src/lib/openclaw.ts`.
- If tool invocation fails with `404` / `405` / schema mismatches, API routes return **actionable errors**.
- JayClaw retries common tool invoke endpoints: `/tools/invoke`, `/api/tools/invoke`, `/tool/invoke`.

Quick verification endpoints:

- `GET /api/ops/status` (gateway `session_status`)
- `GET /api/ops/diag` (URL reachability + auth check)
- `GET /api/diagnostics` (capability matrix)

## Scripts

- `npm run dev` – local dev server
- `npm run build` – production build
- `npm start` – start production server

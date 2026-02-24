#!/usr/bin/env node
/**
 * Smoke-test for OpenClaw Gateway tool invocation.
 *
 * Usage:
 *   OPENCLAW_GATEWAY_URL=http://127.0.0.1:18471 \
 *   OPENCLAW_GATEWAY_TOKEN=... \
 *   node scripts/gateway-smoke.mjs session_status
 *
 * Or test message send:
 *   DEFAULT_MESSAGE_TARGET=... node scripts/gateway-smoke.mjs message.send "hello"
 */

const baseUrl = (process.env.OPENCLAW_GATEWAY_URL || '').replace(/\/+$/, '');
const token = process.env.OPENCLAW_GATEWAY_TOKEN;

if (!baseUrl) {
  console.error('Missing OPENCLAW_GATEWAY_URL');
  process.exit(2);
}
if (!token) {
  console.error('Missing OPENCLAW_GATEWAY_TOKEN');
  process.exit(2);
}

const cmd = process.argv[2] || 'session_status';
const arg = process.argv.slice(3).join(' ');

function headers() {
  return {
    Authorization: `Bearer ${token}`,
    'X-Gateway-Token': token,
    'X-OpenClaw-Token': token,
    'Content-Type': 'application/json',
  };
}

async function post(path, body) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, url, json };
}

async function main() {
  if (cmd === 'session_status') {
    const r = await post('/tools/invoke', { tool: 'session_status' });
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  if (cmd === 'message.send') {
    const target = process.env.DEFAULT_MESSAGE_TARGET || process.env.OWNER_TARGET;
    const channel = process.env.DEFAULT_MESSAGE_CHANNEL || 'discord';
    if (!target) {
      console.error('Missing DEFAULT_MESSAGE_TARGET (or OWNER_TARGET)');
      process.exit(2);
    }
    const message = arg || 'gateway smoke test';

    const attempts = [
      { path: '/tools/invoke', body: { tool: 'message', action: 'send', params: { channel, target, message } } },
      { path: '/tools/invoke', body: { namespace: 'message', action: 'send', params: { channel, target, message } } },
      { path: '/tools/invoke', body: { tool: 'message', params: { action: 'send', channel, target, message } } },
      { path: '/tools/invoke', body: { tool: 'message.send', params: { channel, target, message } } },
      { path: '/invoke', body: { tool: 'message', action: 'send', params: { channel, target, message } } },
    ];

    for (const a of attempts) {
      const r = await post(a.path, a.body);
      console.log(`\n=== ${a.path} ${Object.keys(a.body).join(',')} => HTTP ${r.status} ===`);
      console.log(JSON.stringify(r.json, null, 2));
      if (r.ok) return;
      if (r.status === 401 || r.status === 403) return;
    }
    process.exit(1);
  }

  console.error(`Unknown command: ${cmd}`);
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

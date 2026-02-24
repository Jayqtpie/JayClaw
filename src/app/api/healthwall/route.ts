import 'server-only';

import tls from 'tls';
import { URL } from 'url';
import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import { listAudit } from '@/lib/audit';

async function getSslInfo(gatewayUrl: string | undefined) {
  if (!gatewayUrl) return { ok: false, skipped: true, reason: 'missing_env' };
  let u: URL;
  try {
    u = new URL(gatewayUrl);
  } catch {
    return { ok: false, skipped: true, reason: 'bad_url' };
  }
  if (u.protocol !== 'https:') return { ok: false, skipped: true, reason: 'not_https' };

  const host = u.hostname;
  const port = Number(u.port || '443');

  return await new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        timeout: 4000,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) {
          resolve({ ok: false, skipped: false, reason: 'no_cert' });
          return;
        }
        const validTo = new Date(cert.valid_to);
        const msLeft = validTo.getTime() - Date.now();
        resolve({
          ok: true,
          skipped: false,
          host,
          port,
          validTo: validTo.toISOString(),
          daysLeft: Math.floor(msLeft / (1000 * 60 * 60 * 24)),
          subject: cert.subject,
          issuer: cert.issuer,
        });
      }
    );
    socket.on('error', (e) => {
      resolve({ ok: false, skipped: false, host, port, reason: e.message });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, skipped: false, host, port, reason: 'timeout' });
    });
  });
}

export async function GET() {
  const started = Date.now();

  const envUrl = process.env.OPENCLAW_GATEWAY_URL;
  const gatewayUrl = envUrl
    ? envUrl.trim().replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://').replace(/\/+$/, '')
    : undefined;

  let gatewayStatus: any = null;
  let gatewayStatusError: any = null;
  try {
    gatewayStatus = await invokeTool<any>({ namespace: 'session_status' });
  } catch (e: any) {
    gatewayStatusError = { error: e?.code || e?.message || 'status_failed', status: e?.status };
  }

  let tokenCheck: any = null;
  try {
    // Quick auth check using session_status
    tokenCheck = { ok: true };
    if (gatewayStatusError) tokenCheck = { ok: false, ...gatewayStatusError };
  } catch {
    tokenCheck = { ok: false, error: 'unknown' };
  }

  const ssl = await getSslInfo(gatewayUrl);

  const audit = await listAudit(250);
  const failures = audit.filter((e) => !e.result.ok).slice(0, 25);

  return NextResponse.json({
    ok: true,
    ms: Date.now() - started,
    gateway: {
      url: gatewayUrl ? { set: true, value: gatewayUrl } : { set: false },
      status: gatewayStatus,
      statusError: gatewayStatusError,
    },
    tokenCheck,
    ssl,
    recentFailures: failures,
  });
}

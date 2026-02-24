import 'server-only';

import tls from 'tls';
import { URL } from 'url';
import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import { listAudit, auditStoreInfo } from '@/lib/audit';

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
    gatewayStatusError = {
      code: e?.code || 'status_failed',
      error: e?.message || 'status_failed',
      status: e?.status,
      hint: 'The dashboard could not reach the OpenClaw Gateway. Verify OPENCLAW_GATEWAY_URL/OPENCLAW_GATEWAY_TOKEN on the server.',
    };
  }

  const tokenCheck = gatewayStatusError ? { ok: false, ...gatewayStatusError } : { ok: true };

  const ssl = await getSslInfo(gatewayUrl);

  let audit: any[] = [];
  let auditWarning: any = null;
  let store: any = null;
  try {
    audit = await listAudit(250);
    store = await auditStoreInfo();
  } catch (e: any) {
    auditWarning = {
      code: 'audit_unavailable',
      error: e?.message,
      hint: 'Audit log storage is unavailable in this runtime. This is expected on serverless unless configured with a writable mount.',
    };
    store = { mode: 'memory', persistent: false };
  }

  const failures = audit.filter((e: any) => !e?.result?.ok).slice(0, 25);

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
    audit: {
      store,
      warning: auditWarning,
    },
    recentFailures: failures,
  });
}

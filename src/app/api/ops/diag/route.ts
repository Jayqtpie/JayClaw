import 'server-only';

import crypto from 'crypto';
import { NextResponse } from 'next/server';

function normalizeGatewayUrl(input: string) {
  const raw = input.trim();
  const normalized = raw
    .replace(/^ws:\/\//i, 'http://')
    .replace(/^wss:\/\//i, 'https://')
    .replace(/\/+$/, '');

  const rawScheme = raw.match(/^([a-z]+):\/\//i)?.[1]?.toLowerCase() ?? null;
  const normalizedScheme = normalized.match(/^([a-z]+):\/\//i)?.[1]?.toLowerCase() ?? null;

  return { raw, normalized, rawScheme, normalizedScheme };
}

function tokenFingerprint(token: string) {
  // Non-reversible fingerprint (helps detect which token is deployed without leaking it)
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 10);
}

async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number }) {
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 3000;
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { timeoutMs: _omit, ...rest } = init;
    return await fetch(url, { ...rest, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const envUrl = process.env.OPENCLAW_GATEWAY_URL;
  const envToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  const cfg = {
    gatewayUrl: envUrl ? normalizeGatewayUrl(envUrl) : null,
    token: envToken
      ? {
          set: true,
          length: envToken.length,
          sha256_10: tokenFingerprint(envToken),
        }
      : { set: false },
  };

  const tests: any = {
    reachability: { ok: false, skipped: true },
    auth: { ok: false, skipped: true },
  };

  if (cfg.gatewayUrl?.normalized) {
    tests.reachability = { ok: false, skipped: false };
    try {
      // Basic reachability: any HTTP response is useful here (even 404).
      const r = await fetchWithTimeout(cfg.gatewayUrl.normalized + '/', {
        method: 'GET',
        timeoutMs: 3000,
        headers: { Accept: 'application/json,text/plain,*/*' },
      });
      tests.reachability = {
        ok: true,
        skipped: false,
        status: r.status,
        statusText: r.statusText,
      };
    } catch (e: any) {
      tests.reachability = {
        ok: false,
        skipped: false,
        error: e?.name === 'AbortError' ? 'timeout' : (e?.message ?? String(e)),
      };
    }

    if (envToken) {
      tests.auth = { ok: false, skipped: false };
      const url = cfg.gatewayUrl.normalized + '/tools/invoke';
      try {
        const r = await fetchWithTimeout(url, {
          method: 'POST',
          timeoutMs: 5000,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${envToken}`,
            'X-Gateway-Token': envToken,
            'X-OpenClaw-Token': envToken,
          },
          body: JSON.stringify({ tool: 'session_status', params: {} }),
        });

        let bodyText: string | undefined;
        try {
          bodyText = (await r.text())?.slice(0, 500) || undefined;
        } catch {
          // ignore
        }

        tests.auth = {
          ok: r.ok,
          skipped: false,
          status: r.status,
          statusText: r.statusText,
          ...(bodyText ? { bodyPreview: bodyText } : null),
          ...(r.status === 401 || r.status === 403
            ? {
                hint:
                  'Unauthorized. Confirm OPENCLAW_GATEWAY_TOKEN and that the gateway is configured to accept it. This API sends Authorization Bearer, X-Gateway-Token, and X-OpenClaw-Token.',
              }
            : null),
        };
      } catch (e: any) {
        tests.auth = {
          ok: false,
          skipped: false,
          error: e?.name === 'AbortError' ? 'timeout' : (e?.message ?? String(e)),
          hint: 'Gateway unreachable or blocked; check OPENCLAW_GATEWAY_URL and network access.',
        };
      }
    }
  }

  // Redacted summary for UI/ops pages.
  return NextResponse.json({
    ok: true,
    config: {
      gatewayUrl: cfg.gatewayUrl
        ? {
            set: true,
            rawScheme: cfg.gatewayUrl.rawScheme,
            normalizedScheme: cfg.gatewayUrl.normalizedScheme,
            normalized: cfg.gatewayUrl.normalized,
          }
        : { set: false },
      token: cfg.token,
    },
    tests,
  });
}

import 'server-only';

import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'occ_safe_mode';

type SafeModePayload = {
  v: 1;
  enabled: boolean;
  iat: number; // epoch ms
};

function mustGetAccessKey() {
  const key = process.env.APP_ACCESS_KEY;
  if (!key) throw new Error('Missing APP_ACCESS_KEY env var');
  return key;
}

function hmac(data: string) {
  return crypto.createHmac('sha256', mustGetAccessKey()).update(data).digest('hex');
}

function encode(payload: SafeModePayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = hmac(body);
  return `${body}.${sig}`;
}

function decode(value: string | undefined | null): SafeModePayload | null {
  if (!value) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  const expected = hmac(body);
  if (expected.length !== sig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const json = Buffer.from(body, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as SafeModePayload;
    if (payload?.v !== 1 || typeof payload.enabled !== 'boolean') return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSafeModeEnabled() {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  const payload = decode(raw);
  return payload?.enabled ?? false;
}

export async function setSafeModeEnabled(enabled: boolean) {
  const jar = await cookies();
  const payload: SafeModePayload = { v: 1, enabled, iat: Date.now() };
  jar.set(COOKIE_NAME, encode(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30d
  });
}

export async function requireNotSafeMode() {
  const safe = await getSafeModeEnabled();
  if (safe) {
    const err: any = new Error('Safe Mode is enabled');
    err.status = 409;
    err.code = 'safe_mode_enabled';
    throw err;
  }
}

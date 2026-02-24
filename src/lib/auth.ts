import 'server-only';

import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'occ_session';

function mustGetAccessKey() {
  const key = process.env.APP_ACCESS_KEY;
  if (!key) throw new Error('Missing APP_ACCESS_KEY env var');
  return key;
}

function hmac(data: string) {
  return crypto.createHmac('sha256', mustGetAccessKey()).update(data).digest('hex');
}

export type SessionPayload = {
  v: 1;
  iat: number; // epoch ms
};

export function createSessionCookieValue(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = hmac(body);
  return `${body}.${sig}`;
}

export function verifySessionCookieValue(value: string | undefined | null): SessionPayload | null {
  if (!value) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  const expected = hmac(body);
  // timing safe compare
  if (expected.length !== sig.length) return null;
  const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  if (!ok) return null;
  try {
    const json = Buffer.from(body, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as SessionPayload;
    if (payload?.v !== 1 || typeof payload.iat !== 'number') return null;
    return payload;
  } catch {
    return null;
  }
}

export async function isAuthed() {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  return !!verifySessionCookieValue(value);
}

export async function setAuthedSession() {
  const jar = await cookies();
  const payload: SessionPayload = { v: 1, iat: Date.now() };
  jar.set(COOKIE_NAME, createSessionCookieValue(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14, // 14 days
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export function validateAccessKey(key: string | undefined | null) {
  const expected = mustGetAccessKey();
  if (!key) return false;
  // timing safe compare
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

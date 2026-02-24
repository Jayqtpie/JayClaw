import { NextResponse } from 'next/server';
import { setAuthedSession, validateAccessKey } from '@/lib/auth';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { key?: string } | null;
  const key = body?.key;

  if (!validateAccessKey(key)) {
    return NextResponse.json({ ok: false, error: 'invalid_key' }, { status: 401 });
  }

  await setAuthedSession();
  return NextResponse.json({ ok: true });
}

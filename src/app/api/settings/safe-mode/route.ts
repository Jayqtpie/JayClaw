import { NextResponse } from 'next/server';
import { getSafeModeEnabled, setSafeModeEnabled } from '@/lib/safeMode';

export async function GET() {
  const enabled = await getSafeModeEnabled();
  return NextResponse.json({ ok: true, enabled });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { enabled?: boolean } | null;
  const enabled = !!body?.enabled;
  await setSafeModeEnabled(enabled);
  return NextResponse.json({ ok: true, enabled });
}

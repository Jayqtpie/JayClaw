import { NextResponse } from 'next/server';
import { listAudit } from '@/lib/audit';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || '200')));
  const entries = await listAudit(limit);
  return NextResponse.json({ ok: true, entries });
}

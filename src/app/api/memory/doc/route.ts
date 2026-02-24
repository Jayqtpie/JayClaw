import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { safeResolveDoc } from '@/lib/memoryFs';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get('id') || '').trim();
  const maxBytes = clamp(Number(searchParams.get('maxBytes') || 120_000), 10_000, 400_000);

  if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const resolved = await safeResolveDoc(id);
  if (!resolved) return NextResponse.json({ ok: false, error: 'not_allowed' }, { status: 403 });

  try {
    const st = await fs.stat(resolved.full);
    if (!st.isFile()) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

    const fh = await fs.open(resolved.full, 'r');
    try {
      const len = Math.min(st.size, maxBytes);
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, 0);
      const content = buf.toString('utf8');
      return NextResponse.json({ ok: true, id, truncated: st.size > maxBytes, content });
    } finally {
      await fh.close();
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'read_failed' }, { status: 500 });
  }
}

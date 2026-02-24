import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import fs from 'fs/promises';
import path from 'path';

type SearchHit = { id: string; file: string; line: number; text: string };

async function fallbackSearch(q: string): Promise<SearchHit[]> {
  const dir = process.env.OPENCLAW_MEMORY_DIR;
  if (!dir) return [];
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  const hits: SearchHit[] = [];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const full = path.join(dir, f);
    const content = await fs.readFile(full, 'utf8').catch(() => '');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q.toLowerCase())) {
        hits.push({ id: `${f}:${i + 1}`, file: f, line: i + 1, text: lines[i].slice(0, 300) });
        if (hits.length >= 50) return hits;
      }
    }
  }
  return hits;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ ok: true, hits: [] });

  try {
    const result = await invokeTool<any>({
      namespace: 'memory',
      action: 'search',
      params: { query: q, limit: 20 },
    });
    return NextResponse.json({ ok: true, source: 'gateway', result });
  } catch {
    const hits = await fallbackSearch(q);
    return NextResponse.json({ ok: true, source: 'filesystem', hits });
  }
}

import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import fs from 'fs/promises';
import path from 'path';
import { resolveMemoryFsConfig } from '@/lib/memoryFs';

async function fallbackGet(id: string) {
  const cfg = await resolveMemoryFsConfig();
  const dir = cfg.dailyDir;
  if (!dir) return null;
  const [file, lineStr] = id.split(':');
  const line = Number(lineStr || 0);
  if (!file || !line || !Number.isFinite(line)) return null;
  const full = path.join(dir, file);
  const content = await fs.readFile(full, 'utf8').catch(() => null);
  if (!content) return null;
  const lines = content.split(/\r?\n/);
  const start = Math.max(0, line - 6);
  const end = Math.min(lines.length, line + 5);
  const snippet = lines.slice(start, end).join('\n');
  return { file, line, startLine: start + 1, endLine: end, snippet };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });

  try {
    const result = await invokeTool<any>({
      namespace: 'memory',
      action: 'get',
      params: { id },
    });
    return NextResponse.json({ ok: true, source: 'gateway', result });
  } catch {
    const snippet = await fallbackGet(id);
    if (!snippet) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, source: 'filesystem', snippet });
  }
}

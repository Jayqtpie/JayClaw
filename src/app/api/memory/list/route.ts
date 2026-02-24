import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { normalizeDateParam, resolveMemoryFsConfig } from '@/lib/memoryFs';

export type MemoryDocType = 'root' | 'daily' | 'unknown';

export type MemoryListItem = {
  id: string; // e.g. "MEMORY.md" or "memory/2026-02-24.md"
  source: 'MEMORY.md' | 'memory';
  fileName: string;
  type: MemoryDocType;
  date?: string; // inferred as YYYY-MM-DD (from filename)
  project?: string | null;
  mtimeMs?: number;
  size?: number;
  title?: string | null;
  preview: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function readHead(fullPath: string, maxBytes = 8192) {
  // Avoid loading large files.
  const fh = await fs.open(fullPath, 'r');
  try {
    const { size } = await fh.stat();
    const len = Math.min(size, maxBytes);
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, 0);
    return buf.toString('utf8');
  } finally {
    await fh.close();
  }
}

function inferDate(fileName: string): string | undefined {
  const m = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  return m?.[1];
}

function inferTitle(head: string): string | null {
  const lines = head.split(/\r?\n/);
  for (const l of lines) {
    const s = l.trim();
    if (!s) continue;
    const h1 = s.match(/^#\s+(.+)$/);
    if (h1) return h1[1].trim().slice(0, 120);
  }
  return null;
}

function inferProject(head: string): string | null {
  const m = head.match(/\bProject\s*:\s*(.+)$/im);
  if (m?.[1]) return m[1].trim().slice(0, 80);
  return null;
}

function normalizePreview(head: string): string {
  const lines = head.split(/\r?\n/).slice(0, 40);
  // Trim trailing empty lines.
  while (lines.length && !lines[lines.length - 1]?.trim()) lines.pop();
  return lines.join('\n').slice(0, 2500);
}

function itemTypeFromId(id: string): MemoryDocType {
  if (id === 'MEMORY.md') return 'root';
  if (id.startsWith('memory/') && /\d{4}-\d{2}-\d{2}\.md$/.test(id)) return 'daily';
  return 'unknown';
}

async function buildList(): Promise<{
  items: MemoryListItem[];
  warnings: string[];
  resolved: { rootFile: string | null; dailyDir: string | null };
}> {
  const cfg = await resolveMemoryFsConfig();
  const items: MemoryListItem[] = [];

  // Root MEMORY.md
  if (cfg.rootFile) {
    try {
      const st = await fs.stat(cfg.rootFile);
      if (st.isFile()) {
        const head = await readHead(cfg.rootFile);
        items.push({
          id: 'MEMORY.md',
          source: 'MEMORY.md',
          fileName: 'MEMORY.md',
          type: 'root',
          date: undefined,
          project: inferProject(head),
          title: inferTitle(head),
          preview: normalizePreview(head),
          mtimeMs: st.mtimeMs,
          size: st.size,
        });
      }
    } catch {
      // ignore unreadable
    }
  }

  // memory/*.md
  if (cfg.dailyDir) {
    const files = await fs.readdir(cfg.dailyDir).catch(() => [] as string[]);
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const full = path.join(cfg.dailyDir, f);
      try {
        const st = await fs.stat(full);
        if (!st.isFile()) continue;
        const head = await readHead(full);
        const id = `memory/${f}`;
        items.push({
          id,
          source: 'memory',
          fileName: f,
          type: itemTypeFromId(id),
          date: inferDate(f),
          project: inferProject(head),
          title: inferTitle(head),
          preview: normalizePreview(head),
          mtimeMs: st.mtimeMs,
          size: st.size,
        });
      } catch {
        // ignore unreadable
      }
    }
  }

  // Sort: by inferred date desc, then mtime desc.
  items.sort((a, b) => {
    const ad = a.date ?? '';
    const bd = b.date ?? '';
    if (ad && bd && ad !== bd) return ad < bd ? 1 : -1;
    const am = a.mtimeMs ?? 0;
    const bm = b.mtimeMs ?? 0;
    return bm - am;
  });

  return { items, warnings: cfg.warnings, resolved: { rootFile: cfg.rootFile, dailyDir: cfg.dailyDir } };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = clamp(Number(searchParams.get('page') || 1), 1, 100000);
  const pageSize = clamp(Number(searchParams.get('pageSize') || 25), 5, 100);

  const source = (searchParams.get('source') || '').trim(); // MEMORY.md|memory|""
  const type = (searchParams.get('type') || '').trim(); // root|daily|unknown|""
  const project = (searchParams.get('project') || '').trim();
  const date = normalizeDateParam((searchParams.get('date') || '').trim()); // YYYY-MM-DD exact (accepts dd/mm/yyyy)

  try {
    const built = await buildList();
    let all = built.items;

    if (source === 'MEMORY.md' || source === 'memory') {
      all = all.filter((i) => i.source === source);
    }
    if (type === 'root' || type === 'daily' || type === 'unknown') {
      all = all.filter((i) => i.type === type);
    }
    if (project) {
      const p = project.toLowerCase();
      all = all.filter((i) => (i.project || '').toLowerCase().includes(p));
    }
    if (date) {
      all = all.filter((i) => i.date === date);
    }

    const total = all.length;
    const start = (page - 1) * pageSize;
    const pageItems = all.slice(start, start + pageSize);

    const projects = Array.from(
      new Set(
        all
          .map((i) => i.project)
          .filter((p): p is string => Boolean(p && p.trim()))
          .map((p) => p.trim())
      )
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total,
      projects,
      items: pageItems,
      warnings: built.warnings,
      resolved: built.resolved,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'list_failed' }, { status: 500 });
  }
}

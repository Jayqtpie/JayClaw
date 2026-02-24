import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { invokeTool } from '@/lib/openclaw';
import { normalizeDateParam, resolveMemoryFsConfig } from '@/lib/memoryFs';

export type MemoryDocType = 'root' | 'daily' | 'unknown';
export type MemoryListMode = 'local' | 'gateway';

export type MemoryListItem = {
  id: string; // e.g. "MEMORY.md" or "memory/2026-02-24.md" or a gateway memory id
  source: 'MEMORY.md' | 'memory' | 'gateway';
  fileName: string;
  type: MemoryDocType;
  date?: string; // inferred as YYYY-MM-DD (from filename / id)
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

function inferDate(input: string): string | undefined {
  const m = input.match(/(\d{4}-\d{2}-\d{2})/);
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

function truncatePreview(input: string, max = 2500) {
  const s = String(input || '');
  if (s.length <= max) return s;
  return s.slice(0, max - 12) + '\n…(truncated)';
}

function extractGatewayHits(result: any): Array<{ id: string; preview: string; title?: string | null }> {
  const candidates: any[] =
    (Array.isArray(result?.hits) && result.hits) ||
    (Array.isArray(result?.items) && result.items) ||
    (Array.isArray(result?.results) && result.results) ||
    (Array.isArray(result) && result) ||
    [];

  const hits: Array<{ id: string; preview: string; title?: string | null }> = [];
  for (const h of candidates) {
    const id = String(h?.id || h?.key || h?.memoryId || h?.docId || '').trim();
    if (!id) continue;
    const title = (h?.title ?? h?.file ?? h?.name ?? null) as string | null;
    const previewRaw = h?.text ?? h?.snippet ?? h?.preview ?? h?.content ?? '';
    const preview = truncatePreview(typeof previewRaw === 'string' ? previewRaw : JSON.stringify(previewRaw, null, 2));
    hits.push({ id, preview, title: title ? String(title).slice(0, 140) : null });
  }
  return hits;
}

function isGatewayMemoryUnavailable(e: any): boolean {
  const status = Number(e?.status || e?.details?.status || 0);
  const code = String(e?.code || '');
  return status === 404 || status === 405 || code === 'gateway_not_found' || code === 'gateway_method_not_allowed';
}

async function buildListLocal(): Promise<{
  mode: MemoryListMode;
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

  return { mode: 'local', items, warnings: cfg.warnings, resolved: { rootFile: cfg.rootFile, dailyDir: cfg.dailyDir } };
}

async function buildListGateway(seedQuery: string, limit: number): Promise<{
  mode: MemoryListMode;
  items: MemoryListItem[];
  warnings: string[];
  resolved: { rootFile: null; dailyDir: null };
}> {
  const warnings = [
    'Local memory files are not available in this deployment; showing gateway-backed results instead.',
  ];

  const queriesToTry = [seedQuery, '', '202'];
  let result: any = null;
  let lastErr: any = null;
  for (const q of queriesToTry) {
    try {
      result = await invokeTool<any>({
        namespace: 'memory',
        action: 'search',
        params: { query: q, limit },
      });
      lastErr = null;
      break;
    } catch (e: any) {
      lastErr = e;
    }
  }

  if (!result && lastErr) throw lastErr;

  const hits = extractGatewayHits(result);
  const items: MemoryListItem[] = hits.map((h) => ({
    id: h.id,
    source: 'gateway',
    fileName: h.title || h.id,
    type: 'unknown',
    date: inferDate(h.id),
    project: null,
    title: h.title || null,
    preview: h.preview,
  }));

  return { mode: 'gateway', items, warnings, resolved: { rootFile: null, dailyDir: null } };
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
    const cfg = await resolveMemoryFsConfig();
    const hasLocal = Boolean(cfg.rootFile || cfg.dailyDir);

    let built: Awaited<ReturnType<typeof buildListLocal>> | Awaited<ReturnType<typeof buildListGateway>>;
    let warningCodes: string[] = [];

    if (hasLocal) {
      built = await buildListLocal();
    } else {
      try {
        built = await buildListGateway(project || date || '202', Math.min(200, page * pageSize));
      } catch (e: any) {
        if (isGatewayMemoryUnavailable(e)) {
          built = {
            mode: 'gateway',
            items: [],
            warnings: [
              'Local memory files are not available in this deployment; showing gateway-backed results instead.',
              'Gateway memory tool is unavailable (404/405).',
            ],
            resolved: { rootFile: null, dailyDir: null },
          };
          warningCodes = ['gateway_memory_unavailable'];
        } else {
          throw e;
        }
      }
    }

    let all = built.items;

    // In gateway mode we can't reliably filter by source/type/project.
    // We still apply date filtering if we can infer it from the id.
    if (built.mode === 'local') {
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
      mode: built.mode,
      page,
      pageSize,
      total,
      projects,
      items: pageItems,
      warnings: built.warnings,
      warningCodes,
      resolved: built.resolved,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'list_failed' }, { status: 500 });
  }
}

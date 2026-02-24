import 'server-only';

import fs from 'fs/promises';
import path from 'path';
import { cookies, headers } from 'next/headers';
import { verifySessionCookieValue } from '@/lib/auth';

export type AuditEntry = {
  id: string;
  ts: string; // ISO
  actor: {
    sessionIat?: number;
    ua?: string;
  };
  action: string;
  summary?: string;
  payload?: unknown;
  result: {
    ok: boolean;
    status?: number;
    error?: string;
  };
};

type StoreMode = 'fs' | 'memory';

declare global {
  // eslint-disable-next-line no-var
  var __jayclawAudit: { mode: StoreMode; entries: AuditEntry[] } | undefined;
}

function memStore() {
  if (!globalThis.__jayclawAudit) globalThis.__jayclawAudit = { mode: 'memory', entries: [] };
  return globalThis.__jayclawAudit;
}

let fsMode: StoreMode | null = null;

function dataDir() {
  // NOTE: Many serverless hosts (Vercel) have an ephemeral, sometimes read-only filesystem.
  // We default to a deploy-friendly location, but transparently fall back to memory.
  const base = process.env.JAYCLAW_DATA_DIR ? path.resolve(process.env.JAYCLAW_DATA_DIR) : path.resolve(process.cwd(), '.jayclaw-data');
  return base;
}

function auditPath() {
  return process.env.JAYCLAW_AUDIT_PATH ? path.resolve(process.env.JAYCLAW_AUDIT_PATH) : path.join(dataDir(), 'audit.jsonl');
}

async function detectFsWritable(): Promise<boolean> {
  if (fsMode) return fsMode === 'fs';

  // Allow explicit override.
  const forced = (process.env.JAYCLAW_PERSISTENCE || '').toLowerCase();
  if (forced === 'memory') {
    fsMode = 'memory';
    return false;
  }

  try {
    await fs.mkdir(path.dirname(auditPath()), { recursive: true });
    // Touch file if missing.
    await fs.appendFile(auditPath(), '');
    fsMode = 'fs';
    return true;
  } catch {
    fsMode = 'memory';
    return false;
  }
}

function randomId() {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

function capEntries(entries: AuditEntry[], cap = 1000) {
  if (entries.length <= cap) return entries;
  return entries.slice(-cap);
}

export async function appendAudit(partial: Omit<AuditEntry, 'id' | 'ts' | 'actor'> & { actor?: AuditEntry['actor'] }) {
  const jar = await cookies();
  const session = verifySessionCookieValue(jar.get('occ_session')?.value);
  const h = await headers();

  const entry: AuditEntry = {
    id: randomId(),
    ts: new Date().toISOString(),
    actor: {
      sessionIat: session?.iat,
      ua: h.get('user-agent') ?? undefined,
      ...(partial.actor ?? {}),
    },
    action: partial.action,
    summary: partial.summary,
    payload: partial.payload,
    result: partial.result,
  };

  const canFs = await detectFsWritable();
  if (!canFs) {
    const mem = memStore();
    mem.entries.push(entry);
    mem.entries = capEntries(mem.entries);
    return entry;
  }

  try {
    await fs.appendFile(auditPath(), JSON.stringify(entry) + '\n', 'utf8');
    return entry;
  } catch {
    // FS turned out not to be writable (or became unavailable). Fall back.
    fsMode = 'memory';
    const mem = memStore();
    mem.entries.push(entry);
    mem.entries = capEntries(mem.entries);
    return entry;
  }
}

export async function listAudit(limit = 200): Promise<AuditEntry[]> {
  const canFs = await detectFsWritable();
  if (!canFs) {
    const mem = memStore();
    return [...mem.entries].slice(-limit).reverse();
  }

  try {
    const content = await fs.readFile(auditPath(), 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    const slice = lines.slice(-limit);
    const out: AuditEntry[] = [];
    for (const line of slice) {
      try {
        out.push(JSON.parse(line));
      } catch {
        // ignore bad line
      }
    }
    return out.reverse();
  } catch {
    fsMode = 'memory';
    const mem = memStore();
    return [...mem.entries].slice(-limit).reverse();
  }
}

export async function auditStoreInfo(): Promise<{ mode: StoreMode; persistent: boolean; path?: string }> {
  const canFs = await detectFsWritable();
  return canFs ? { mode: 'fs', persistent: true, path: auditPath() } : { mode: 'memory', persistent: false };
}

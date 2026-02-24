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

function dataDir() {
  // Keep persistent data outside of .next; committed app runs with project root as cwd.
  return path.join(process.cwd(), 'data');
}

function auditPath() {
  return path.join(dataDir(), 'audit.jsonl');
}

async function ensureStore() {
  await fs.mkdir(dataDir(), { recursive: true });
  // Touch file if missing.
  await fs.appendFile(auditPath(), '');
}

function randomId() {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

export async function appendAudit(partial: Omit<AuditEntry, 'id' | 'ts' | 'actor'> & { actor?: AuditEntry['actor'] }) {
  await ensureStore();

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

  await fs.appendFile(auditPath(), JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

export async function listAudit(limit = 200): Promise<AuditEntry[]> {
  await ensureStore();
  // For simplicity (and small logs), read entire file.
  // If it grows large, switch to tail reading.
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
}

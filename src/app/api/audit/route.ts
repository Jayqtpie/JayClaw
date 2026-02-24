import { NextResponse } from 'next/server';
import { listAudit, auditStoreInfo } from '@/lib/audit';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || '200')));

  try {
    const entries = await listAudit(limit);
    const store = await auditStoreInfo();
    return NextResponse.json({ ok: true, entries, store });
  } catch (e: any) {
    // Never hard-fail the UI: return an empty log with actionable hints.
    return NextResponse.json({
      ok: true,
      entries: [],
      store: { mode: 'memory', persistent: false },
      warning: {
        code: 'audit_unavailable',
        hint: 'Audit persistence is unavailable in this runtime (common on serverless). Set JAYCLAW_DATA_DIR or JAYCLAW_AUDIT_PATH to a writable mount, or ship logs externally.',
        error: e?.message,
      },
    });
  }
}

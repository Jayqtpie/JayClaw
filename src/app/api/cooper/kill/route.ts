import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import { appendAudit } from '@/lib/audit';

function extractCandidates(listResult: any): string[] {
  const raw = listResult?.items ?? listResult?.subagents ?? listResult?.result ?? listResult;
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
  const ids: string[] = [];
  for (const it of arr) {
    const id =
      it?.id ??
      it?.sessionId ??
      it?.session_id ??
      it?.target ??
      it?.name ??
      it?.uuid ??
      null;
    if (typeof id === 'string' && id.trim()) ids.push(id.trim());
  }
  // de-dupe
  return Array.from(new Set(ids));
}

export async function POST() {
  const started = Date.now();
  try {
    const list = await invokeTool<any>({
      namespace: 'subagents',
      action: 'list',
      params: { recentMinutes: 24 * 60 },
    });

    const candidates = extractCandidates(list);

    const results: Array<{ target: string; ok: boolean; error?: string }> = [];
    for (const target of candidates) {
      try {
        await invokeTool<any>({
          namespace: 'subagents',
          action: 'kill',
          params: { target },
        });
        results.push({ target, ok: true });
      } catch (e: any) {
        results.push({ target, ok: false, error: e?.code || e?.message || 'kill_failed' });
      }
    }

    await appendAudit({
      action: 'cooper.kill',
      summary: `attempted=${candidates.length} ok=${results.filter((r) => r.ok).length}`,
      payload: { candidates },
      result: { ok: true, status: 200 },
    });

    return NextResponse.json({ ok: true, attempted: candidates.length, results, ms: Date.now() - started });
  } catch (e: any) {
    await appendAudit({
      action: 'cooper.kill',
      summary: 'failed',
      result: { ok: false, status: e?.status || 500, error: e?.code || e?.message || 'failed' },
    });
    return NextResponse.json(
      { ok: false, error: e?.code || e?.message || 'Failed to execute Cooper kill switch', details: e?.details },
      { status: e?.status || 500 }
    );
  }
}

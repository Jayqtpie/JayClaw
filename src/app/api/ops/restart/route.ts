import { NextResponse } from 'next/server';
import { requireNotSafeMode } from '@/lib/safeMode';
import { appendAudit } from '@/lib/audit';

export async function POST() {
  try {
    await requireNotSafeMode();
  } catch (e: any) {
    await appendAudit({
      action: 'ops.restart',
      summary: 'blocked_by_safe_mode',
      result: { ok: false, status: e?.status || 409, error: e?.code || e?.message || 'blocked' },
    });
    return NextResponse.json({ ok: false, error: e?.code || 'safe_mode_enabled' }, { status: e?.status || 409 });
  }

  // The hosted gateway currently does not expose a public restart tool endpoint.
  // Keep this explicit so UI can show a clear message instead of generic failure.
  await appendAudit({
    action: 'ops.restart',
    summary: 'restart_unavailable',
    result: { ok: false, status: 501, error: 'restart_unavailable' },
  });

  return NextResponse.json(
    {
      ok: false,
      error: 'restart_unavailable',
      message:
        'Gateway restart is not exposed via the public API in this deployment. Use server CLI: openclaw gateway restart',
    },
    { status: 501 }
  );
}

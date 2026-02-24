import { NextResponse } from 'next/server';
import { getDiagnosticsState, runDiagnosticsProbes } from '@/lib/diagnostics';
import { appendAudit } from '@/lib/audit';

export async function GET() {
  const state = await getDiagnosticsState();
  if (state) return NextResponse.json({ ok: true, state });

  // First load: run probes so the UI has something real to show.
  const next = await runDiagnosticsProbes();
  await appendAudit({
    action: 'diagnostics.run',
    summary: 'auto',
    payload: { reason: 'no_cached_state' },
    result: { ok: true, status: 200 },
  });
  return NextResponse.json({ ok: true, state: next });
}

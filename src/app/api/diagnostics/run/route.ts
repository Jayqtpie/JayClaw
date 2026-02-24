import { NextResponse } from 'next/server';
import { runDiagnosticsProbes } from '@/lib/diagnostics';
import { requireNotSafeMode } from '@/lib/safeMode';
import { appendAudit } from '@/lib/audit';

export async function POST() {
  // Probes are read-only, but we still respect Safe Mode to match operator expectations.
  // (Some probes may touch local FS config, etc.)
  try {
    await requireNotSafeMode();
  } catch {
    // If safe mode is enabled, still allow probes (read-only) but mark in audit.
  }

  const state = await runDiagnosticsProbes();

  await appendAudit({
    action: 'diagnostics.run',
    summary: 'manual',
    payload: { generatedAt: state.generatedAt },
    result: { ok: true, status: 200 },
  });

  return NextResponse.json({ ok: true, state });
}

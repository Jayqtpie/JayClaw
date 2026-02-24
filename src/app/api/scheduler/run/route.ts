import { NextResponse } from 'next/server';
import { getReminder } from '@/lib/reminders';
// invokeTool removed (scheduler.run unavailable in current gateway mode)
import { requireNotSafeMode } from '@/lib/safeMode';
import { appendAudit } from '@/lib/audit';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id;
  if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const reminder = getReminder(id);
  if (!reminder) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  if (!reminder.enabled) return NextResponse.json({ ok: false, error: 'disabled' }, { status: 400 });

  try {
    await requireNotSafeMode();

    // NOTE: The public gateway mode in this environment does not expose a verified, safe
    // message-send path for scheduler execution.
    // Keep this explicit to avoid fake success states.
    await appendAudit({
      action: 'scheduler.run',
      summary: reminder.title,
      payload: { id },
      result: { ok: false, status: 501, error: 'unavailable_in_current_gateway_mode' },
    });

    return NextResponse.json(
      {
        ok: false,
        error: 'unavailable_in_current_gateway_mode',
        message:
          'Scheduler run is unavailable in the current gateway mode (requires a verified message-send capability).',
      },
      { status: 501 }
    );
  } catch (e: any) {
    await appendAudit({
      action: 'scheduler.run',
      summary: reminder.title,
      payload: { id },
      result: { ok: false, status: e?.status || 500, error: e?.code || e?.message || 'failed' },
    });

    return NextResponse.json(
      { ok: false, error: e?.code || e?.message || 'Failed to run reminder', details: e?.details },
      { status: e?.status || 500 }
    );
  }
}

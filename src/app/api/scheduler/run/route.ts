import { NextResponse } from 'next/server';
import { getReminder } from '@/lib/reminders';
import { invokeTool } from '@/lib/openclaw';
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

    // Run = send a message through the gateway.
    const result = await invokeTool<any>({
      namespace: 'message',
      action: 'send',
      params: {
        message: `[Reminder] ${reminder.title}\n\n${reminder.message}`,
      },
    });

    await appendAudit({
      action: 'scheduler.run',
      summary: reminder.title,
      payload: { id },
      result: { ok: true, status: 200 },
    });

    return NextResponse.json({ ok: true, reminder, result });
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

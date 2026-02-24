import { NextResponse } from 'next/server';
import { addReminder, listReminders, setReminderEnabled } from '@/lib/reminders';
import { requireNotSafeMode } from '@/lib/safeMode';
import { appendAudit } from '@/lib/audit';

export async function GET() {
  return NextResponse.json({ ok: true, reminders: listReminders() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { action?: 'create'; title?: string; message?: string; cron?: string }
    | { action?: 'toggle'; id?: string; enabled?: boolean }
    | null;

  try {
    await requireNotSafeMode();

    if (!body?.action || body.action === 'create') {
      const title = (body as any)?.title?.trim();
      const message = (body as any)?.message?.trim();
      const cron = (body as any)?.cron?.trim();
      if (!title || !message || !cron) {
        return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
      }
      const reminder = addReminder({ title, message, cron, enabled: true });

      await appendAudit({
        action: 'scheduler.create',
        summary: title,
        payload: { cron },
        result: { ok: true, status: 200 },
      });

      return NextResponse.json({ ok: true, reminder, reminders: listReminders() });
    }

    if (body.action === 'toggle') {
      const id = (body as any)?.id;
      const enabled = !!(body as any)?.enabled;
      if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
      const reminder = setReminderEnabled(id, enabled);
      if (!reminder) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

      await appendAudit({
        action: 'scheduler.toggle',
        summary: id,
        payload: { enabled },
        result: { ok: true, status: 200 },
      });

      return NextResponse.json({ ok: true, reminder, reminders: listReminders() });
    }

    return NextResponse.json({ ok: false, error: 'bad_action' }, { status: 400 });
  } catch (e: any) {
    await appendAudit({
      action: 'scheduler.mutate',
      summary: body?.action || 'unknown',
      payload: body,
      result: { ok: false, status: e?.status || 500, error: e?.code || e?.message || 'failed' },
    });

    return NextResponse.json(
      { ok: false, error: e?.code || e?.message || 'Failed to update scheduler' },
      { status: e?.status || 500 }
    );
  }
}

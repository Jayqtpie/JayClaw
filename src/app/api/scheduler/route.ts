import { NextResponse } from 'next/server';
import { addReminder, listReminders, setReminderEnabled } from '@/lib/reminders';

export async function GET() {
  return NextResponse.json({ ok: true, reminders: listReminders() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { action?: 'create'; title?: string; message?: string; cron?: string }
    | { action?: 'toggle'; id?: string; enabled?: boolean }
    | null;

  if (!body?.action || body.action === 'create') {
    const title = (body as any)?.title?.trim();
    const message = (body as any)?.message?.trim();
    const cron = (body as any)?.cron?.trim();
    if (!title || !message || !cron) {
      return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }
    const reminder = addReminder({ title, message, cron, enabled: true });
    return NextResponse.json({ ok: true, reminder, reminders: listReminders() });
  }

  if (body.action === 'toggle') {
    const id = (body as any)?.id;
    const enabled = !!(body as any)?.enabled;
    if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
    const reminder = setReminderEnabled(id, enabled);
    if (!reminder) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, reminder, reminders: listReminders() });
  }

  return NextResponse.json({ ok: false, error: 'bad_action' }, { status: 400 });
}

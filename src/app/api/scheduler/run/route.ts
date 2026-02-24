import { NextResponse } from 'next/server';
import { getReminder } from '@/lib/reminders';
import { invokeTool } from '@/lib/openclaw';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id;
  if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const reminder = getReminder(id);
  if (!reminder) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  if (!reminder.enabled) return NextResponse.json({ ok: false, error: 'disabled' }, { status: 400 });

  // Run = send a message through the gateway.
  const result = await invokeTool<any>({
    namespace: 'message',
    action: 'send',
    params: {
      message: `[Reminder] ${reminder.title}\n\n${reminder.message}`,
    },
  });

  return NextResponse.json({ ok: true, reminder, result });
}

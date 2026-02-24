import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import { requireNotSafeMode } from '@/lib/safeMode';
import { appendAudit } from '@/lib/audit';

export async function GET() {
  try {
    const result = await invokeTool<any>({
      namespace: 'subagents',
      action: 'list',
      params: { recentMinutes: 120 },
    });
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.code || e?.message || 'Failed to load subagents', details: e?.details },
      { status: e?.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ ok: false, error: 'missing_message' }, { status: 400 });

  try {
    await requireNotSafeMode();

    // Not exposed/verified in current gateway mode.
    await appendAudit({
      action: 'subagents.steer',
      summary: 'unavailable_in_current_gateway_mode',
      payload: { messageLen: message.length },
      result: { ok: false, status: 501, error: 'unavailable_in_current_gateway_mode' },
    });

    return NextResponse.json(
      {
        ok: false,
        error: 'unavailable_in_current_gateway_mode',
        message: 'Spawning/steering subagents is unavailable in the current public gateway mode.',
      },
      { status: 501 }
    );
  } catch (e: any) {
    await appendAudit({
      action: 'subagents.steer',
      summary: message.length > 180 ? message.slice(0, 180) + '…' : message,
      payload: { messageLen: message.length },
      result: { ok: false, status: e?.status || 500, error: e?.code || e?.message || 'failed' },
    });

    return NextResponse.json(
      { ok: false, error: e?.code || e?.message || 'Failed to send subagent message', details: e?.details },
      { status: e?.status || 500 }
    );
  }
}

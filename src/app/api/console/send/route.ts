import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import { requireNotSafeMode } from '@/lib/safeMode';
import { appendAudit } from '@/lib/audit';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ ok: false, error: 'missing_message' }, { status: 400 });

  try {
    await requireNotSafeMode();

    // Assumption: gateway supports a tool-style invoke endpoint.
    // Update src/lib/openclaw.ts if your gateway uses different paths.
    const defaultTarget = process.env.DEFAULT_MESSAGE_TARGET || process.env.OWNER_TARGET;
    const defaultChannel = process.env.DEFAULT_MESSAGE_CHANNEL || 'discord';

    if (!defaultTarget) {
      throw Object.assign(new Error('missing_default_target'), {
        status: 400,
        code: 'missing_default_target',
        details: {
          hint: 'Set DEFAULT_MESSAGE_TARGET in env (e.g. your Discord user id) for console send.',
        },
      });
    }

    const result = await invokeTool<any>({
      namespace: 'message',
      action: 'send',
      params: {
        channel: defaultChannel,
        target: defaultTarget,
        message,
      },
    });

    await appendAudit({
      action: 'console.send',
      summary: message.length > 180 ? message.slice(0, 180) + '…' : message,
      payload: { messageLen: message.length },
      result: { ok: true, status: 200 },
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    // Debug-safe log: do not print tokens or full message.
    console.error('[console.send] failed', {
      status: e?.status || 500,
      code: e?.code,
      message: e?.message,
      details: e?.details,
      messageLen: message.length,
    });

    await appendAudit({
      action: 'console.send',
      summary: message.length > 180 ? message.slice(0, 180) + '…' : message,
      payload: { messageLen: message.length },
      result: { ok: false, status: e?.status || 500, error: e?.code || e?.message || 'failed' },
    });

    return NextResponse.json(
      {
        ok: false,
        error: e?.code || e?.message || 'Failed to send',
        // Keep details actionable but avoid secret leakage; openclaw.ts already avoids tokens.
        details: e?.details,
        status: e?.status || 500,
      },
      { status: e?.status || 500 }
    );
  }
}

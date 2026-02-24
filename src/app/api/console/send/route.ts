import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import { requireNotSafeMode } from '@/lib/safeMode';
import { appendAudit } from '@/lib/audit';
import { relayToAssistant } from '@/lib/chatRelay';

type AttemptLog = {
  path:
    | 'message.send(action+params:message)'
    | 'message.send(action+params:text)'
    | 'message.send(action+params:content)'
    | 'message.send(action+params:targets[])'
    | 'message.send(params.action)'
    | 'message.send(tool=message.send)';
  ok: boolean;
  status?: number;
  code?: string;
  message?: string;
};

function errSummary(e: any): { status?: number; code?: string; message?: string } {
  return {
    status: typeof e?.status === 'number' ? e.status : undefined,
    code: typeof e?.code === 'string' ? e.code : undefined,
    message: typeof e?.message === 'string' ? e.message : undefined,
  };
}

function isFatalGatewayErr(e: any) {
  const status = e?.status as number | undefined;
  const code = e?.code as string | undefined;
  return status === 401 || status === 403 || code === 'gateway_unauthorized' || code === 'gateway_unreachable';
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ ok: false, error: 'missing_message' }, { status: 400 });

  const attempts: AttemptLog[] = [];

  try {
    await requireNotSafeMode();

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

    // ---- Direct send via message tool (try a few schema variants) ----
    const baseParams = {
      channel: defaultChannel,
      target: defaultTarget,
    };

    const directVariants: Array<{ path: AttemptLog['path']; req: Parameters<typeof invokeTool<any>>[0] }> = [
      {
        path: 'message.send(action+params:message)',
        req: { namespace: 'message', action: 'send', params: { ...baseParams, message } },
      },
      {
        path: 'message.send(action+params:text)',
        req: { namespace: 'message', action: 'send', params: { ...baseParams, text: message } },
      },
      {
        path: 'message.send(action+params:content)',
        req: { namespace: 'message', action: 'send', params: { ...baseParams, content: message } },
      },
      {
        path: 'message.send(action+params:targets[])',
        req: { namespace: 'message', action: 'send', params: { channel: defaultChannel, targets: [defaultTarget], message } },
      },
      {
        path: 'message.send(params.action)',
        req: { namespace: 'message', params: { action: 'send', ...baseParams, message } },
      },
      {
        path: 'message.send(tool=message.send)',
        req: { namespace: 'message.send', params: { ...baseParams, message } },
      },
    ];

    let directResult: any = null;
    let directErr: any = null;

    for (const v of directVariants) {
      try {
        directResult = await invokeTool<any>(v.req);
        attempts.push({ path: v.path, ok: true });
        break;
      } catch (e: any) {
        directErr = e;
        attempts.push({ path: v.path, ok: false, ...errSummary(e) });
        if (isFatalGatewayErr(e)) break;
      }
    }

    if (directResult) {
      await appendAudit({
        action: 'console.send',
        summary: message.length > 180 ? message.slice(0, 180) + '…' : message,
        payload: {
          messageLen: message.length,
          mode: 'sent',
        },
        result: { ok: true, status: 200 },
      });

      return NextResponse.json({
        ok: true,
        mode: 'sent',
        result: directResult,
        diagnostic: { attempted: attempts },
      });
    }

    // ---- Relay fallback: message tool blocked or incompatible ----
    // If gateway auth/network is broken, relaying will not help.
    if (isFatalGatewayErr(directErr)) throw directErr;

    const relay = await relayToAssistant(
      `Console send relay (direct message tool unavailable):\n\nTarget: ${defaultTarget}\nChannel: ${defaultChannel}\n\nMessage:\n${message}`
    );

    if (!relay.ok) {
      const err = Object.assign(new Error('console_send_failed'), {
        status: relay.error?.status || 502,
        code: relay.error?.code || 'console_send_failed',
        details: {
          hint:
            'Direct message tool failed and relay fallback also failed. ' +
            'Check gateway tool exposure/permissions and CHAT_* env configuration.',
        },
      });
      throw err;
    }

    await appendAudit({
      action: 'console.send',
      summary: message.length > 180 ? message.slice(0, 180) + '…' : message,
      payload: {
        messageLen: message.length,
        mode: 'relay',
        relayPipeline: relay.pipeline,
      },
      result: { ok: true, status: 200 },
    });

    return NextResponse.json({
      ok: true,
      mode: 'relay',
      note:
        'Direct send was not available in this gateway deployment. Your message was relayed to the main assistant session for handling.',
      result: relay.result,
      diagnostic: {
        attempted: attempts,
        relay: { pipeline: relay.pipeline, attempted: relay.attempted },
      },
    });
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
        details: e?.details,
        status: e?.status || 500,
        diagnostic: { attempted: attempts },
      },
      { status: e?.status || 500 }
    );
  }
}

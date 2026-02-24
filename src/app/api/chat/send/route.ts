import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import { requireNotSafeMode } from '@/lib/safeMode';
import { appendAudit } from '@/lib/audit';
import { appendMessage, updateMessage, readThread } from '@/lib/chatStore';

function extractAssistantText(result: any): string | null {
  if (!result) return null;
  if (typeof result === 'string') return result;
  // common shapes
  const candidates = [
    result?.reply,
    result?.message,
    result?.text,
    result?.content,
    result?.result?.reply,
    result?.result?.message,
    result?.result?.text,
    result?.result?.content,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }

  // Sometimes the tool returns an array of messages.
  const arr = result?.messages ?? result?.result?.messages;
  if (Array.isArray(arr)) {
    const last = [...arr]
      .reverse()
      .find((m) => (m?.role === 'assistant' || m?.type === 'assistant') && typeof m?.text === 'string');
    if (last?.text?.trim()) return last.text.trim();
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type HistoryMsg = {
  role?: string;
  type?: string;
  text?: string;
  content?: string;
  message?: string;
  ts?: number | string;
  createdAt?: number | string;
  time?: number | string;
};

function parseTs(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim()) {
    const n = Number(x);
    if (Number.isFinite(n)) return n;
    const d = Date.parse(x);
    if (!Number.isNaN(d)) return d;
  }
  return null;
}

function assistantTextFromHistoryPayload(payload: any, minTs: number) {
  const arr: any[] =
    (Array.isArray(payload) ? payload : null) ??
    payload?.messages ??
    payload?.result?.messages ??
    payload?.history ??
    payload?.items ??
    payload?.result?.history ??
    [];

  if (!Array.isArray(arr) || !arr.length) return null;

  // Try to find newest assistant message after minTs.
  const candidates = [...arr]
    .map((m) => m as HistoryMsg)
    .filter((m) => (m?.role === 'assistant' || m?.type === 'assistant'))
    .map((m) => {
      const ts =
        parseTs(m?.ts) ??
        parseTs(m?.createdAt) ??
        parseTs(m?.time) ??
        // Some deployments use { at: ... }
        parseTs((m as any)?.at);
      const text =
        (typeof m?.text === 'string' ? m.text : null) ??
        (typeof m?.content === 'string' ? m.content : null) ??
        (typeof m?.message === 'string' ? m.message : null);
      return { ts: ts ?? 0, text: text?.trim() || '' };
    })
    .filter((x) => x.text && (x.ts ? x.ts >= minTs : true))
    .sort((a, b) => b.ts - a.ts);

  if (!candidates.length) return null;
  return candidates[0]!.text;
}

async function sessionsSend(sessionKey: string, message: string) {
  const attempts = [
    { sessionKey, message },
    { sessionKey, text: message },
    { sessionKey, content: message },
    // compatibility: some gateways use "key"
    { key: sessionKey, message },
    { key: sessionKey, text: message },
  ];

  let lastErr: any = null;
  for (const params of attempts) {
    try {
      return await invokeTool<any>({ namespace: 'sessions_send', params });
    } catch (e: any) {
      lastErr = e;
      const status = e?.status as number | undefined;
      // If it's clearly auth/network, fail fast.
      if (status === 401 || status === 403 || e?.code === 'gateway_unauthorized' || e?.code === 'gateway_unreachable') {
        throw e;
      }
    }
  }
  throw lastErr || new Error('sessions_send_failed');
}

async function sessionsHistory(sessionKey: string, limit = 30) {
  const attempts = [
    { sessionKey, limit },
    { sessionKey, n: limit },
    { key: sessionKey, limit },
    { key: sessionKey, n: limit },
  ];

  let lastErr: any = null;
  for (const params of attempts) {
    try {
      return await invokeTool<any>({ namespace: 'sessions_history', params });
    } catch (e: any) {
      lastErr = e;
      const status = e?.status as number | undefined;
      if (status === 401 || status === 403 || e?.code === 'gateway_unauthorized' || e?.code === 'gateway_unreachable') {
        throw e;
      }
    }
  }
  throw lastErr || new Error('sessions_history_failed');
}

function shouldFallbackToConfiguredTool(err: any) {
  const status = err?.status as number | undefined;
  const code = err?.code as string | undefined;
  // If the sessions tools simply don't exist on this deployment, fall back.
  return status === 404 || code === 'gateway_not_found';
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message)
    return NextResponse.json(
      {
        ok: false,
        error: 'missing_message',
        code: 'missing_message',
        hint: 'POST JSON: { "message": "..." }',
      },
      { status: 400 }
    );

  const userMsg = await appendMessage({ role: 'user', text: message, status: 'sending' });

  const namespace = process.env.CHAT_TOOL_NAMESPACE || 'subagents';
  const action = process.env.CHAT_TOOL_ACTION || 'steer';
  const sessionKey = process.env.CHAT_SESSION_KEY || 'agent:main:main';

  try {
    await requireNotSafeMode();

    const startedAt = Date.now();

    // Default: reliable pipeline that matches how OpenClaw itself chats.
    // 1) Send message into the configured session
    // 2) Poll history for the assistant's reply
    let result: any = null;
    let assistantText: string | null = null;
    let pipeline: 'sessions' | 'tool' = 'sessions';

    try {
      result = await sessionsSend(sessionKey, message);

      const pollAttempts = Math.max(1, Math.min(12, Number(process.env.CHAT_POLL_ATTEMPTS || '8')));
      const pollDelayMs = Math.max(150, Math.min(1500, Number(process.env.CHAT_POLL_DELAY_MS || '350')));

      for (let i = 0; i < pollAttempts; i++) {
        // small backoff to avoid hammering the gateway
        if (i) await sleep(pollDelayMs);
        const h = await sessionsHistory(sessionKey, 50);
        assistantText = assistantTextFromHistoryPayload(h, startedAt - 250);
        if (assistantText) break;
      }

      if (!assistantText) {
        throw Object.assign(new Error('chat_no_reply'), {
          status: 502,
          code: 'chat_no_reply',
          details: {
            hint:
              'sessions_send succeeded but no assistant message appeared in sessions_history in time. ' +
              'Try increasing CHAT_POLL_ATTEMPTS/CHAT_POLL_DELAY_MS, or verify the target session is correct via CHAT_SESSION_KEY.',
            sessionKey,
          },
        });
      }
    } catch (e: any) {
      // If sessions_* tooling is missing in this gateway deployment, fall back to the prior configurable tool path.
      if (!shouldFallbackToConfiguredTool(e)) throw e;

      pipeline = 'tool';
      result = await invokeTool<any>({
        namespace,
        action,
        params: {
          message,
          channel: 'dashboard',
          thread: 'jayclaw',
          returnTranscript: true,
        },
      });

      assistantText = extractAssistantText(result);
      if (!assistantText) {
        throw Object.assign(new Error('chat_no_reply'), {
          status: 502,
          code: 'chat_no_reply',
          details: {
            hint:
              'Gateway returned no assistant text. Preferred fix: ensure sessions_send and sessions_history tools are available. ' +
              'Fallback fix: configure CHAT_TOOL_NAMESPACE/CHAT_TOOL_ACTION to a tool that returns a reply, or update extractAssistantText() to match your gateway response shape.',
            pipeline,
            namespace,
            action,
            sessionKey,
          },
        });
      }
    }

    await updateMessage(userMsg.id, { status: 'sent' });
    await appendMessage({ role: 'assistant', text: assistantText, status: 'sent' });

    await appendAudit({
      action: 'chat.send',
      summary: message.length > 180 ? message.slice(0, 180) + '…' : message,
      payload: {
        messageLen: message.length,
        pipeline,
        ...(pipeline === 'sessions' ? { sessionKey } : { tool: { namespace, action } }),
      },
      result: { ok: true, status: 200 },
    });

    const thread = await readThread();
    return NextResponse.json({ ok: true, result: { pipeline, result }, thread });
  } catch (e: any) {
    await updateMessage(userMsg.id, { status: 'error' });

    await appendAudit({
      action: 'chat.send',
      summary: message.length > 180 ? message.slice(0, 180) + '…' : message,
      payload: { messageLen: message.length },
      result: { ok: false, status: e?.status || 500, error: e?.code || e?.message || 'failed' },
    });

    return NextResponse.json(
      {
        ok: false,
        error: e?.code || e?.message || 'Failed to send chat message',
        code: e?.code,
        details: e?.details,
        status: e?.status || 500,
      },
      { status: e?.status || 500 }
    );
  }
}

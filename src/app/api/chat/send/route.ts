import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import { requireNotSafeMode } from '@/lib/safeMode';
import { appendAudit } from '@/lib/audit';
import { appendMessage, readThread, updateMessage } from '@/lib/chatStore';

function extractAssistantText(result: any): string | null {
  if (!result) return null;
  if (typeof result === 'string') return result.trim() || null;

  // Common direct envelopes.
  const candidates: unknown[] = [
    result?.reply,
    result?.message,
    result?.text,
    result?.content,
    result?.assistant,
    result?.assistantText,
    result?.output,
    result?.result?.reply,
    result?.result?.message,
    result?.result?.text,
    result?.result?.content,
    result?.result?.assistant,
    result?.result?.output,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (c && typeof c === 'object') {
      const t = (c as any)?.text ?? (c as any)?.content ?? (c as any)?.message;
      if (typeof t === 'string' && t.trim()) return t.trim();
    }
  }

  // Common transcript arrays: messages/history/items/transcript/events.
  const arrays: unknown[] = [
    result?.messages,
    result?.result?.messages,
    result?.history,
    result?.result?.history,
    result?.items,
    result?.transcript,
    result?.result?.transcript,
    result?.events,
    result?.result?.events,
  ];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;

    // Prefer explicit assistant role/type.
    const lastAssistant = [...arr]
      .reverse()
      .find(
        (m) =>
          (m as any)?.role === 'assistant' ||
          (m as any)?.type === 'assistant' ||
          (m as any)?.kind === 'assistant'
      );

    const pick = lastAssistant ?? [...arr].reverse().find((m) => typeof (m as any)?.text === 'string');
    if (pick) {
      const t =
        (typeof (pick as any)?.text === 'string' ? (pick as any).text : null) ??
        (typeof (pick as any)?.content === 'string' ? (pick as any).content : null) ??
        (typeof (pick as any)?.message === 'string' ? (pick as any).message : null) ??
        (typeof (pick as any)?.data?.text === 'string' ? (pick as any).data.text : null) ??
        (typeof (pick as any)?.data?.content === 'string' ? (pick as any).data.content : null);
      if (typeof t === 'string' && t.trim()) return t.trim();
    }
  }

  // Last resort: walk a few layers deep looking for the most plausible assistant text.
  const seen = new Set<any>();
  const stack: Array<{ v: any; depth: number }> = [{ v: result, depth: 0 }];
  while (stack.length) {
    const { v, depth } = stack.pop()!;
    if (!v || typeof v !== 'object') continue;
    if (seen.has(v)) continue;
    seen.add(v);
    if (depth > 4) continue;

    if (Array.isArray(v)) {
      for (let i = v.length - 1; i >= 0; i--) stack.push({ v: v[i], depth: depth + 1 });
      continue;
    }

    const role = (v as any)?.role ?? (v as any)?.type ?? (v as any)?.kind;
    const text = (v as any)?.text ?? (v as any)?.content ?? (v as any)?.message;
    if (role === 'assistant' && typeof text === 'string' && text.trim()) return text.trim();

    for (const key of Object.keys(v)) stack.push({ v: (v as any)[key], depth: depth + 1 });
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

  const candidates = [...arr]
    .map((m) => m as HistoryMsg)
    .filter((m) => m?.role === 'assistant' || m?.type === 'assistant')
    .map((m) => {
      const ts =
        parseTs(m?.ts) ??
        parseTs(m?.createdAt) ??
        parseTs(m?.time) ??
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

type AttemptLog = {
  path:
    | 'sessions_send(sessionKey)'
    | 'sessions_send(label)'
    | 'sessions_history(sessionKey)'
    | 'sessions_history(label)'
    | 'sessions_spawn(run.message)'
    | 'invokeTool(configured)';
  ok: boolean;
  code?: string;
  status?: number;
  message?: string;
  hint?: string;
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

function shouldFallbackFromSessions(err: any) {
  const status = err?.status as number | undefined;
  const code = err?.code as string | undefined;
  // If the sessions tools simply don't exist or are not exposed on this deployment, fall back.
  // (Common cases: 404 Not Found, 405 Method Not Allowed)
  return status === 404 || status === 405 || code === 'gateway_not_found';
}

async function sessionsSendWithParams(params: Record<string, unknown>) {
  const attempts = [
    params,
    // alternate field names for the payload text
    { ...params, text: params.message },
    { ...params, content: params.message },
  ];

  let lastErr: any = null;
  for (const p of attempts) {
    try {
      return await invokeTool<any>({ namespace: 'sessions_send', params: p });
    } catch (e: any) {
      lastErr = e;
      if (isFatalGatewayErr(e)) throw e;
    }
  }
  throw lastErr || new Error('sessions_send_failed');
}

async function sessionsHistoryWithParams(params: Record<string, unknown>) {
  const attempts = [params, { ...params, n: (params as any).limit }];
  let lastErr: any = null;
  for (const p of attempts) {
    try {
      return await invokeTool<any>({ namespace: 'sessions_history', params: p });
    } catch (e: any) {
      lastErr = e;
      if (isFatalGatewayErr(e)) throw e;
    }
  }
  throw lastErr || new Error('sessions_history_failed');
}

async function sessionsSpawnRunMessage(message: string) {
  // sessions_spawn (mode=run) is our most robust fallback when sessions_send/history aren't exposed.
  // Gateway deployments differ slightly in schema; try a few shapes.
  const base = { channel: 'dashboard', thread: 'jayclaw', message };
  const attempts: Record<string, unknown>[] = [
    { mode: 'run', task: 'message', ...base },
    { mode: 'run', task: { type: 'message', ...base } },
    { mode: 'run', task: { kind: 'message', ...base } },
    { mode: 'run', task: { action: 'message', ...base } },
    { mode: 'run', input: { type: 'message', ...base } },
  ];

  let lastErr: any = null;
  for (const p of attempts) {
    try {
      return await invokeTool<any>({ namespace: 'sessions_spawn', params: p });
    } catch (e: any) {
      lastErr = e;
      if (isFatalGatewayErr(e)) throw e;
    }
  }

  throw lastErr || new Error('sessions_spawn_failed');
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json(
      {
        ok: false,
        error: 'missing_message',
        code: 'missing_message',
        hint: 'POST JSON: { "message": "..." }',
      },
      { status: 400 }
    );
  }

  const userMsg = await appendMessage({ role: 'user', text: message, status: 'sending' });

  const configuredNamespace = process.env.CHAT_TOOL_NAMESPACE || 'subagents';
  const configuredAction = process.env.CHAT_TOOL_ACTION || 'steer';

  // Primary path expects a concrete session key.
  const sessionKeyEnv = (process.env.CHAT_SESSION_KEY || '').trim();
  const sessionKey = sessionKeyEnv || 'agent:main:main';

  // Fallback A: some gateways/session managers identify sessions by label instead of key.
  const sessionLabelEnv = (process.env.CHAT_SESSION_LABEL || '').trim();
  const sessionLabel = sessionLabelEnv || (sessionKeyEnv ? '' : sessionKey);

  const attempts: AttemptLog[] = [];

  try {
    await requireNotSafeMode();

    const startedAt = Date.now();

    let result: any = null;
    let assistantText: string | null = null;
    let pipeline: 'sessions' | 'sessions_label' | 'sessions_spawn' | 'tool' = 'sessions';

    const pollAttempts = Math.max(1, Math.min(12, Number(process.env.CHAT_POLL_ATTEMPTS || '8')));
    const pollDelayMs = Math.max(150, Math.min(1500, Number(process.env.CHAT_POLL_DELAY_MS || '350')));

    // ---- 1) Primary: sessions_send + sessions_history using sessionKey ----
    let lastSessionsErr: any = null;
    try {
      result = await sessionsSendWithParams({ sessionKey, message });
      attempts.push({ path: 'sessions_send(sessionKey)', ok: true });

      for (let i = 0; i < pollAttempts; i++) {
        if (i) await sleep(pollDelayMs);
        const h = await sessionsHistoryWithParams({ sessionKey, limit: 50 });
        attempts.push({ path: 'sessions_history(sessionKey)', ok: true });
        assistantText = assistantTextFromHistoryPayload(h, startedAt - 250);
        if (assistantText) break;
      }

      if (!assistantText) {
        lastSessionsErr = Object.assign(new Error('chat_no_reply'), {
          status: 502,
          code: 'chat_no_reply',
          details: {
            hint:
              'sessions_send succeeded but no assistant message appeared in sessions_history in time. ' +
              'Try increasing CHAT_POLL_ATTEMPTS/CHAT_POLL_DELAY_MS, or verify CHAT_SESSION_KEY/CHAT_SESSION_LABEL.',
            sessionKey,
          },
        });
      }
    } catch (e: any) {
      attempts.push({ path: 'sessions_send(sessionKey)', ok: false, ...errSummary(e) });
      lastSessionsErr = e;
    }

    // ---- 2) Fallback A: sessions_* using label (when key routing fails or key is unknown) ----
    if (!assistantText && !isFatalGatewayErr(lastSessionsErr) && sessionLabel && !shouldFallbackFromSessions(lastSessionsErr)) {
      pipeline = 'sessions_label';
      try {
        result = await sessionsSendWithParams({ label: sessionLabel, message });
        attempts.push({
          path: 'sessions_send(label)',
          ok: true,
          hint: sessionLabelEnv ? 'Using CHAT_SESSION_LABEL fallback.' : 'Using implicit label fallback.',
        });

        for (let i = 0; i < pollAttempts; i++) {
          if (i) await sleep(pollDelayMs);
          const h = await sessionsHistoryWithParams({ label: sessionLabel, limit: 50 });
          attempts.push({ path: 'sessions_history(label)', ok: true });
          assistantText = assistantTextFromHistoryPayload(h, startedAt - 250);
          if (assistantText) break;
        }

        if (!assistantText) {
          lastSessionsErr = Object.assign(new Error('chat_no_reply'), {
            status: 502,
            code: 'chat_no_reply',
            details: {
              hint:
                'sessions_send (label) succeeded but no assistant message appeared in sessions_history (label) in time. ' +
                'Verify CHAT_SESSION_LABEL points at an active assistant session.',
              sessionLabel,
            },
          });
        }
      } catch (e2: any) {
        attempts.push({ path: 'sessions_send(label)', ok: false, ...errSummary(e2) });
        lastSessionsErr = e2;
      }
    }

    // ---- 3) Fallback B: sessions_spawn(mode=run, task=message) OR configurable tool invoke ----
    if (!assistantText) {
      // If the failure is clearly auth/network, stop here (fallbacks use the same gateway).
      if (isFatalGatewayErr(lastSessionsErr)) throw lastSessionsErr;

      const fallbackModeRaw = (process.env.CHAT_FALLBACK_MODE || 'sessions_spawn').trim().toLowerCase();
      const fallbackMode = fallbackModeRaw === 'tool_invoke' ? 'tool_invoke' : 'sessions_spawn';

      // If sessions tooling isn't exposed (404/405), prefer sessions_spawn by default.
      const sessionsUnavailable = shouldFallbackFromSessions(lastSessionsErr);

      const trySessionsSpawnFirst = sessionsUnavailable ? fallbackMode !== 'tool_invoke' : fallbackMode === 'sessions_spawn';

      if (trySessionsSpawnFirst) {
        pipeline = 'sessions_spawn';
        try {
          result = await sessionsSpawnRunMessage(message);
          attempts.push({ path: 'sessions_spawn(run.message)', ok: true });
          assistantText = extractAssistantText(result);
        } catch (e: any) {
          attempts.push({ path: 'sessions_spawn(run.message)', ok: false, ...errSummary(e) });
          // Keep going to tool fallback if configured.
        }
      }

      if (!assistantText) {
        pipeline = 'tool';
        try {
          result = await invokeTool<any>({
            namespace: configuredNamespace,
            action: configuredAction,
            params: {
              message,
              channel: 'dashboard',
              thread: 'jayclaw',
              returnTranscript: true,
            },
          });
          attempts.push({ path: 'invokeTool(configured)', ok: true });
          assistantText = extractAssistantText(result);
        } catch (e: any) {
          attempts.push({ path: 'invokeTool(configured)', ok: false, ...errSummary(e) });
          throw e;
        }
      }

      // If user explicitly requested tool_invoke first, optionally try sessions_spawn second.
      if (!assistantText && !trySessionsSpawnFirst && fallbackMode === 'tool_invoke') {
        pipeline = 'sessions_spawn';
        try {
          result = await sessionsSpawnRunMessage(message);
          attempts.push({ path: 'sessions_spawn(run.message)', ok: true, hint: 'Second-chance fallback after tool_invoke.' });
          assistantText = extractAssistantText(result);
        } catch (e: any) {
          attempts.push({ path: 'sessions_spawn(run.message)', ok: false, ...errSummary(e), hint: 'Second-chance fallback after tool_invoke.' });
        }
      }

      if (!assistantText) {
        throw Object.assign(new Error('chat_no_reply'), {
          status: 502,
          code: 'chat_no_reply',
          details: {
            hint:
              'Gateway returned no assistant text. Preferred fix: ensure sessions_send and sessions_history are available. ' +
              'Fallback fix: use CHAT_FALLBACK_MODE=sessions_spawn (default) or configure CHAT_TOOL_NAMESPACE/CHAT_TOOL_ACTION for a tool that returns a reply, ' +
              'or update extractAssistantText() to match your gateway response shape.',
            configuredTool: { namespace: configuredNamespace, action: configuredAction },
            fallbackMode,
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
        session: {
          sessionKey: sessionKeyEnv ? sessionKey : undefined,
          sessionLabel: sessionLabelEnv ? sessionLabel : undefined,
        },
        configuredTool: { namespace: configuredNamespace, action: configuredAction },
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
      payload: {
        messageLen: message.length,
        attempted: attempts,
      },
      result: { ok: false, status: e?.status || 500, error: e?.code || e?.message || 'failed' },
    });

    // Rich actionable payload for UI debugging.
    const diagnostic = {
      code: e?.code || 'gateway_error',
      status: e?.status || 500,
      message: e?.message || 'Failed to send chat message',
      attempted: attempts,
      hints: [
        'If you see gateway_unreachable: verify OPENCLAW_GATEWAY_URL is reachable from the server and points to the HTTP(S) endpoint (not ws/wss).',
        'If you see gateway_unauthorized: verify OPENCLAW_GATEWAY_TOKEN.',
        'If sessions_* are missing (404/405): your gateway likely does not expose sessions_send/sessions_history. Use CHAT_FALLBACK_MODE=sessions_spawn (default) or set CHAT_TOOL_NAMESPACE/CHAT_TOOL_ACTION.',
        'If chat_no_reply: verify the target session is correct (CHAT_SESSION_KEY or CHAT_SESSION_LABEL) and that an assistant is actively producing replies.',
      ],
      config: {
        hasGatewayUrl: Boolean(process.env.OPENCLAW_GATEWAY_URL),
        hasGatewayToken: Boolean(process.env.OPENCLAW_GATEWAY_TOKEN),
        chatSessionKeySet: Boolean(sessionKeyEnv),
        chatSessionLabelSet: Boolean(sessionLabelEnv),
        configuredTool: { namespace: configuredNamespace, action: configuredAction },
      },
      upstream: e?.details,
    };

    return NextResponse.json(
      {
        ok: false,
        error: e?.code || e?.message || 'Failed to send chat message',
        code: e?.code,
        details: e?.details,
        status: e?.status || 500,
        diagnostic,
      },
      { status: e?.status || 500 }
    );
  }
}

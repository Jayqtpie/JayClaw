import 'server-only';

import { invokeTool } from '@/lib/openclaw';

type AttemptLog = {
  path: 'sessions_send' | 'sessions_spawn(run.message)' | 'invokeTool(configured)';
  ok: boolean;
  status?: number;
  code?: string;
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

async function sessionsSendWithParams(params: Record<string, unknown>) {
  const attempts = [params, { ...params, text: params.message }, { ...params, content: params.message }];
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

async function sessionsSpawnRunMessage(message: string) {
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

export type RelayResult = {
  ok: boolean;
  pipeline: 'sessions' | 'sessions_spawn' | 'tool';
  attempted: AttemptLog[];
  result?: any;
  error?: { status?: number; code?: string; message?: string };
};

/**
 * Best-effort message delivery to the main assistant session when direct tools are blocked.
 * This does NOT require a reply stream.
 */
export async function relayToAssistant(message: string): Promise<RelayResult> {
  const attempts: AttemptLog[] = [];

  const configuredNamespace = process.env.CHAT_TOOL_NAMESPACE || 'subagents';
  const configuredAction = process.env.CHAT_TOOL_ACTION || 'steer';

  const sessionKeyEnv = (process.env.CHAT_SESSION_KEY || '').trim();
  const sessionKey = sessionKeyEnv || 'agent:main:main';

  // 1) Try sessions_send(sessionKey)
  try {
    const result = await sessionsSendWithParams({ sessionKey, message });
    attempts.push({ path: 'sessions_send', ok: true });
    return { ok: true, pipeline: 'sessions', attempted: attempts, result };
  } catch (e: any) {
    attempts.push({ path: 'sessions_send', ok: false, ...errSummary(e) });
    if (isFatalGatewayErr(e)) return { ok: false, pipeline: 'sessions', attempted: attempts, error: errSummary(e) };
  }

  // 2) Try sessions_spawn(mode=run, task=message)
  try {
    const result = await sessionsSpawnRunMessage(message);
    attempts.push({ path: 'sessions_spawn(run.message)', ok: true });
    return { ok: true, pipeline: 'sessions_spawn', attempted: attempts, result };
  } catch (e: any) {
    attempts.push({ path: 'sessions_spawn(run.message)', ok: false, ...errSummary(e) });
    if (isFatalGatewayErr(e)) return { ok: false, pipeline: 'sessions_spawn', attempted: attempts, error: errSummary(e) };
  }

  // 3) Configured tool invoke fallback (may or may not return transcript; we only care about delivery)
  try {
    const result = await invokeTool<any>({
      namespace: configuredNamespace,
      action: configuredAction,
      params: {
        message,
        channel: 'dashboard',
        thread: 'jayclaw',
        returnTranscript: false,
      },
    });
    attempts.push({ path: 'invokeTool(configured)', ok: true });
    return { ok: true, pipeline: 'tool', attempted: attempts, result };
  } catch (e: any) {
    attempts.push({ path: 'invokeTool(configured)', ok: false, ...errSummary(e) });
    return { ok: false, pipeline: 'tool', attempted: attempts, error: errSummary(e) };
  }
}

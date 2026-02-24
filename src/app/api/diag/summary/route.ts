import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import { getSafeModeEnabled } from '@/lib/safeMode';
import { resolveMemoryFsConfig } from '@/lib/memoryFs';

function errSummary(e: any) {
  return {
    status: typeof e?.status === 'number' ? e.status : undefined,
    code: typeof e?.code === 'string' ? e.code : undefined,
    message: typeof e?.message === 'string' ? e.message : undefined,
    details: e?.details,
  };
}

export async function GET() {
  const safeModeEnabled = await getSafeModeEnabled();

  const env = {
    hasGatewayUrl: Boolean(process.env.OPENCLAW_GATEWAY_URL),
    hasGatewayToken: Boolean(process.env.OPENCLAW_GATEWAY_TOKEN),
    hasDefaultMessageTarget: Boolean((process.env.DEFAULT_MESSAGE_TARGET || process.env.OWNER_TARGET || '').trim()),
    defaultMessageChannel: (process.env.DEFAULT_MESSAGE_CHANNEL || 'discord').trim(),
    chatSessionKeySet: Boolean((process.env.CHAT_SESSION_KEY || '').trim()),
    chatSessionLabelSet: Boolean((process.env.CHAT_SESSION_LABEL || '').trim()),
  };

  const checks: any = {
    safeModeEnabled,
    gateway: { ok: false, probed: false, probe: null as any },
    chat: { ok: false, probed: false, probes: [] as any[] },
    memory: { ok: false, probed: false, mode: 'unknown' as 'unknown' | 'local' | 'gateway', probes: [] as any[] },
    console: {
      ok: false,
      probed: false,
      note: 'Console readiness is mostly environment-driven. We do not send a test message from diagnostics.',
      envOk: env.hasDefaultMessageTarget,
    },
  };

  // Gateway probe (read-only): session_status
  if (env.hasGatewayUrl && env.hasGatewayToken && !safeModeEnabled) {
    try {
      const result = await invokeTool<any>({ namespace: 'session_status' });
      checks.gateway = {
        ok: true,
        probed: true,
        probe: {
          kind: 'session_status',
          ok: true,
          resultSummary: typeof result === 'object' ? Object.keys(result || {}) : typeof result,
        },
      };
    } catch (e: any) {
      checks.gateway = { ok: false, probed: true, probe: { kind: 'session_status', ok: false, ...errSummary(e) } };
    }
  }

  // Chat probe (read-only): sessions_history
  if (env.hasGatewayUrl && env.hasGatewayToken && !safeModeEnabled) {
    const sessionKeyEnv = (process.env.CHAT_SESSION_KEY || '').trim();
    const sessionKey = sessionKeyEnv || 'agent:main:main';

    const sessionLabelEnv = (process.env.CHAT_SESSION_LABEL || '').trim();
    const sessionLabel = sessionLabelEnv || (sessionKeyEnv ? '' : sessionKey);

    try {
      await invokeTool<any>({ namespace: 'sessions_history', params: { sessionKey, limit: 1 } });
      checks.chat.probes.push({ kind: 'sessions_history(sessionKey)', ok: true });
      checks.chat.ok = true;
      checks.chat.probed = true;
    } catch (e: any) {
      checks.chat.probes.push({ kind: 'sessions_history(sessionKey)', ok: false, ...errSummary(e) });
      checks.chat.probed = true;
    }

    if (!checks.chat.ok && sessionLabel) {
      try {
        await invokeTool<any>({ namespace: 'sessions_history', params: { label: sessionLabel, limit: 1 } });
        checks.chat.probes.push({ kind: 'sessions_history(label)', ok: true });
        checks.chat.ok = true;
      } catch (e: any) {
        checks.chat.probes.push({ kind: 'sessions_history(label)', ok: false, ...errSummary(e) });
      }
    }
  }

  // Memory readiness:
  // - Prefer local filesystem if configured
  // - Otherwise probe gateway memory.search (read-only)
  try {
    const cfg = await resolveMemoryFsConfig();
    const hasLocal = Boolean(cfg.rootFile || cfg.dailyDir);

    if (hasLocal) {
      checks.memory.mode = 'local';
      checks.memory.ok = true;
      checks.memory.probed = true;
      checks.memory.probes.push({
        kind: 'local_fs',
        ok: true,
        warnings: cfg.warnings,
        resolved: { rootFile: cfg.rootFile, dailyDir: cfg.dailyDir },
      });
    } else if (env.hasGatewayUrl && env.hasGatewayToken && !safeModeEnabled) {
      checks.memory.mode = 'gateway';
      checks.memory.probed = true;
      try {
        await invokeTool<any>({ namespace: 'memory', action: 'search', params: { query: '', limit: 1 } });
        checks.memory.ok = true;
        checks.memory.probes.push({ kind: 'memory.search', ok: true });
      } catch (e: any) {
        checks.memory.probes.push({ kind: 'memory.search', ok: false, ...errSummary(e) });
      }
    } else {
      checks.memory.mode = 'unknown';
      checks.memory.probed = true;
      checks.memory.ok = false;
      checks.memory.probes.push({
        kind: 'memory',
        ok: false,
        reason: safeModeEnabled ? 'safe_mode_enabled' : 'missing_gateway_env_or_no_local_fs',
      });
    }
  } catch (e: any) {
    checks.memory.probed = true;
    checks.memory.ok = false;
    checks.memory.probes.push({ kind: 'resolveMemoryFsConfig', ok: false, ...errSummary(e) });
  }

  // Console env-only readiness
  checks.console.ok = checks.console.envOk;
  checks.console.probed = true;

  const overallOk = Boolean(checks.gateway.ok || safeModeEnabled) && checks.memory.ok;

  return NextResponse.json({
    ok: overallOk,
    env,
    checks,
    hints: [
      'If gateway probes show 404/405, your gateway deployment may be on a different path. JayClaw retries /tools/invoke, /api/tools/invoke, /tool/invoke.',
      'If gateway probes show 401/403, verify OPENCLAW_GATEWAY_TOKEN and gateway auth headers.',
      'If chat probes fail with 404, your gateway may not expose sessions_* tools; configure CHAT_TOOL_NAMESPACE/CHAT_TOOL_ACTION as a fallback for /api/chat/send.',
      'Console requires DEFAULT_MESSAGE_TARGET (or OWNER_TARGET). JayClaw will not send a test message from diagnostics.',
    ],
  });
}

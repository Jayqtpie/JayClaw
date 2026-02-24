import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import { getSafeModeEnabled, requireNotSafeMode } from '@/lib/safeMode';

function errSummary(e: any) {
  return {
    status: typeof e?.status === 'number' ? e.status : undefined,
    code: typeof e?.code === 'string' ? e.code : undefined,
    message: typeof e?.message === 'string' ? e.message : undefined,
  };
}

export async function GET() {
  const safeModeEnabled = await getSafeModeEnabled();

  const configuredNamespace = process.env.CHAT_TOOL_NAMESPACE || 'subagents';
  const configuredAction = process.env.CHAT_TOOL_ACTION || 'steer';

  const sessionKeyEnv = (process.env.CHAT_SESSION_KEY || '').trim();
  const sessionKey = sessionKeyEnv || 'agent:main:main';

  const sessionLabelEnv = (process.env.CHAT_SESSION_LABEL || '').trim();
  const sessionLabel = sessionLabelEnv || (sessionKeyEnv ? '' : sessionKey);

  // Security: never expose tokens, URLs, or message content.
  const base = {
    ok: true,
    safeModeEnabled,
    env: {
      hasGatewayUrl: Boolean(process.env.OPENCLAW_GATEWAY_URL),
      hasGatewayToken: Boolean(process.env.OPENCLAW_GATEWAY_TOKEN),
      chatSessionKeySet: Boolean(sessionKeyEnv),
      chatSessionLabelSet: Boolean(sessionLabelEnv),
      configuredTool: { namespace: configuredNamespace, action: configuredAction },
    },
  };

  if (safeModeEnabled) {
    return NextResponse.json({
      ...base,
      paths: {
        sessions: { available: false, reason: 'safe_mode_enabled' },
        configuredTool: { available: false, reason: 'safe_mode_enabled', verified: false },
      },
      hint: 'Disable Safe Mode to run gateway-backed diagnostics.',
    });
  }

  // If Safe Mode is off we can probe sessions_history (read-only) to infer availability.
  await requireNotSafeMode();

  const paths: any = {
    sessions: {
      available: false,
      verified: false,
      probes: [] as any[],
    },
    configuredTool: {
      // We do NOT invoke this tool here to avoid side effects.
      available: true,
      verified: false,
      note: 'Not probed to avoid side effects. This path is used only as a fallback on /api/chat/send.',
      tool: { namespace: configuredNamespace, action: configuredAction },
    },
  };

  // Probe 1: sessions_history(sessionKey)
  try {
    await invokeTool<any>({ namespace: 'sessions_history', params: { sessionKey, limit: 1 } });
    paths.sessions.available = true;
    paths.sessions.verified = true;
    paths.sessions.probes.push({ kind: 'sessions_history(sessionKey)', ok: true });
  } catch (e: any) {
    paths.sessions.probes.push({ kind: 'sessions_history(sessionKey)', ok: false, ...errSummary(e) });
  }

  // Probe 2: sessions_history(label) (only if probe 1 failed and label is set)
  if (!paths.sessions.verified && sessionLabel) {
    try {
      await invokeTool<any>({ namespace: 'sessions_history', params: { label: sessionLabel, limit: 1 } });
      paths.sessions.available = true;
      paths.sessions.verified = true;
      paths.sessions.probes.push({ kind: 'sessions_history(label)', ok: true });
    } catch (e: any) {
      paths.sessions.probes.push({ kind: 'sessions_history(label)', ok: false, ...errSummary(e) });
    }
  }

  return NextResponse.json({
    ...base,
    paths,
    hints: [
      'If sessions probes show 404/gateway_not_found, your gateway deployment likely does not expose sessions_* tools. Configure CHAT_TOOL_NAMESPACE/CHAT_TOOL_ACTION for a compatible tool path.',
      'If probes show 401/403, verify OPENCLAW_GATEWAY_TOKEN and gateway auth headers.',
      'If probes show gateway_unreachable, verify OPENCLAW_GATEWAY_URL points to the HTTP(S) gateway endpoint (not ws/wss) and is reachable from the server.',
    ],
  });
}

import 'server-only';

export type GatewayError = {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
};

function normalizeGatewayUrl(input: string) {
  const raw = input.trim();
  // Users sometimes copy the gateway websocket URL. The API is HTTP(S).
  const normalized = raw
    .replace(/^ws:\/\//i, 'http://')
    .replace(/^wss:\/\//i, 'https://')
    .replace(/\/+$/, '');

  return { raw, normalized };
}

function mustGetGatewayEnv() {
  const baseUrl = process.env.OPENCLAW_GATEWAY_URL;
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!baseUrl) {
    const err: GatewayError = {
      status: 500,
      code: 'missing_env',
      message: 'Missing OPENCLAW_GATEWAY_URL env var',
    };
    throw err;
  }
  if (!token) {
    const err: GatewayError = {
      status: 500,
      code: 'missing_env',
      message: 'Missing OPENCLAW_GATEWAY_TOKEN env var',
    };
    throw err;
  }
  const { raw, normalized } = normalizeGatewayUrl(baseUrl);
  return { baseUrl: normalized, baseUrlRaw: raw, token };
}

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Minimal gateway client.
 *
 * IMPORTANT: OpenClaw Gateway API shape may differ by deployment.
 * This wrapper intentionally centralizes the "how" so you only update it here.
 */
export async function gatewayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, baseUrlRaw, token } = mustGetGatewayEnv();
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        // Some deployments expect different header names.
        Authorization: `Bearer ${token}`,
        'X-Gateway-Token': token,
        'X-OpenClaw-Token': token,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
  } catch (e: any) {
    const err: GatewayError = {
      status: 502,
      code: 'gateway_unreachable',
      message:
        `Failed to reach OpenClaw Gateway at ${baseUrl}. ` +
        `Check OPENCLAW_GATEWAY_URL (current: ${baseUrlRaw}).`,
      details: {
        cause: e?.message ?? String(e),
        url,
      },
    };
    throw err;
  }

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const baseMessage = typeof data === 'string' ? data : (data?.message ?? res.statusText);

    const err: GatewayError = {
      status: res.status,
      code:
        res.status === 401 || res.status === 403
          ? 'gateway_unauthorized'
          : res.status === 404
            ? 'gateway_not_found'
            : 'gateway_error',
      message: baseMessage,
      details: {
        url,
        ...(typeof data === 'string' ? { body: data } : { body: data }),
        ...(res.status === 401 || res.status === 403
          ? {
              hint:
                'Gateway rejected auth. Verify OPENCLAW_GATEWAY_TOKEN and that the deployment accepts Authorization Bearer, X-Gateway-Token, or X-OpenClaw-Token.',
            }
          : null),
      },
    };
    throw err;
  }

  return data as T;
}

export type ToolInvokeRequest = {
  namespace: string; // tool name, e.g. "subagents", "session_status", "cron"
  action?: string; // optional action merged into params when needed
  params?: Record<string, unknown>;
};

// OpenClaw gateway tool invocation endpoint.
export async function invokeTool<T>(req: ToolInvokeRequest): Promise<T> {
  const params = {
    ...(req.params ?? {}),
    ...(req.action ? { action: req.action } : {}),
  };

  return gatewayFetch<T>('/tools/invoke', {
    method: 'POST',
    body: JSON.stringify({
      tool: req.namespace,
      params,
    }),
  });
}

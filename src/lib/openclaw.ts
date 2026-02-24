import 'server-only';

export type GatewayError = {
  status: number;
  message: string;
  details?: unknown;
};

function mustGetGatewayEnv() {
  const baseUrl = process.env.OPENCLAW_GATEWAY_URL;
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!baseUrl) throw new Error('Missing OPENCLAW_GATEWAY_URL env var');
  if (!token) throw new Error('Missing OPENCLAW_GATEWAY_TOKEN env var');
  return { baseUrl: baseUrl.replace(/\/+$/, ''), token };
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
  const { baseUrl, token } = mustGetGatewayEnv();
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const err: GatewayError = {
      status: res.status,
      message: typeof data === 'string' ? data : (data?.message ?? res.statusText),
      details: typeof data === 'string' ? undefined : data,
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

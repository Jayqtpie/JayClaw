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
            : res.status === 405
              ? 'gateway_method_not_allowed'
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
        ...(res.status === 404
          ? {
              hint:
                'Gateway endpoint not found. Verify OPENCLAW_GATEWAY_URL points to the gateway HTTP(S) API root and that it exposes /tools/invoke.',
            }
          : null),
        ...(res.status === 405
          ? {
              hint:
                'Gateway returned 405 Method Not Allowed. Verify your gateway exposes POST /tools/invoke for tool invocation.',
              allow: res.headers.get('allow') || undefined,
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
  action?: string; // many tools require top-level action
  params?: Record<string, unknown>;
};

function safeToolDebug(req: ToolInvokeRequest) {
  return {
    namespace: req.namespace,
    action: req.action,
    // Only keys (no values) to avoid leaking content.
    paramsKeys: req.params ? Object.keys(req.params) : [],
  };
}

// OpenClaw gateway tool invocation endpoint.
// Some deployments differ in body shape or endpoint path; we try a small set of compatible fallbacks.
export async function invokeTool<T>(req: ToolInvokeRequest): Promise<T> {
  const attempts: Array<{ path: string; body: any }> = [];

  const pathsToTry = ['/tools/invoke'];

  // Most common (current JayClaw assumption)
  for (const path of pathsToTry) {
    attempts.push({
      path,
      body: {
        tool: req.namespace,
        ...(req.action ? { action: req.action } : {}),
        ...(req.params ? { params: req.params } : {}),
      },
    });
  }

  // Alternate: "namespace" instead of "tool"
  for (const path of pathsToTry) {
    attempts.push({
      path,
      body: {
        namespace: req.namespace,
        ...(req.action ? { action: req.action } : {}),
        ...(req.params ? { params: req.params } : {}),
      },
    });
  }

  // Alternate: action nested inside params
  if (req.action) {
    for (const path of pathsToTry) {
      attempts.push({
        path,
        body: {
          tool: req.namespace,
          params: {
            action: req.action,
            ...(req.params || {}),
          },
        },
      });
    }
  }

  // Alternate: tool name includes action (e.g. "message.send")
  if (req.action) {
    for (const path of pathsToTry) {
      attempts.push({
        path,
        body: {
          tool: `${req.namespace}.${req.action}`,
          ...(req.params ? { params: req.params } : {}),
        },
      });
    }
  }

  let lastErr: any = null;
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i]!;

    // Only retry on likely compatibility issues.
    // If auth/network fails, fail fast.
    if (lastErr) {
      const status = lastErr?.status as number | undefined;
      const code = lastErr?.code as string | undefined;
      const retryable =
        status === 404 ||
        status === 400 ||
        status === 405 ||
        status === 422 ||
        code === 'gateway_not_found' ||
        code === 'gateway_method_not_allowed' ||
        code === 'gateway_error';

      const fatal = code === 'gateway_unauthorized' || code === 'gateway_unreachable' || status === 401 || status === 403;
      if (fatal || !retryable) break;
    }

    try {
      return await gatewayFetch<T>(a.path, {
        method: 'POST',
        body: JSON.stringify(a.body),
      });
    } catch (e: any) {
      lastErr = e;
    }
  }

  const err: GatewayError = {
    status: lastErr?.status || 500,
    code: lastErr?.code || 'gateway_error',
    message: lastErr?.message || 'Gateway tool invocation failed',
    details: {
      ...(lastErr?.details ? { upstream: lastErr.details } : null),
      hint:
        'Tool invoke failed. This may be an API-shape mismatch between JayClaw and your Gateway deployment. ' +
        'Update src/lib/openclaw.ts invokeTool fallbacks to match your gateway.',
      debug: safeToolDebug(req),
      tried: attempts.map((a) => ({ path: a.path, bodyKeys: Object.keys(a.body || {}) })),
    },
  };
  throw err;
}

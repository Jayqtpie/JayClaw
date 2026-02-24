'use client';

import { useCallback, useEffect, useState } from 'react';

export type OpsStatus = {
  ok: boolean;
  result?: any;
  error?: string;
};

export function useOpsStatus({ refreshMs = 30000 }: { refreshMs?: number } = {}) {
  const [data, setData] = useState<OpsStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ops/status', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setData({ ok: false, error: j?.error || 'Failed to load status' });
        return;
      }
      setData({ ok: true, result: j?.result });
    } catch (e: any) {
      setData({ ok: false, error: e?.message || 'Failed to load status' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), refreshMs);
    return () => window.clearInterval(t);
  }, [load, refreshMs]);

  return { data, loading, refresh: load };
}

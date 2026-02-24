'use client';

import { useEffect, useMemo, useState } from 'react';

type State = any;

type Probe = { id: string; status: 'pass' | 'fail' | 'skip'; details?: any };

export function useDiagnostics() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      const res = await fetch('/api/diagnostics', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      setState(j?.state ?? null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const probes: Record<string, Probe> = useMemo(() => state?.results || {}, [state]);
  const get = (id: string) => probes?.[id] as Probe | undefined;
  const pass = (id: string) => get(id)?.status === 'pass';

  return { state, busy, refresh, get, pass };
}

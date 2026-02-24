'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type SafeModeState = {
  enabled: boolean;
  loading: boolean;
  setEnabled: (v: boolean) => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<SafeModeState | null>(null);

export function SafeModeProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/safe-mode', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      if (res.ok) setEnabledState(!!j?.enabled);
    } finally {
      setLoading(false);
    }
  }, []);

  const setEnabled = useCallback(async (v: boolean) => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/safe-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: v }),
      });
      const j = (await res.json().catch(() => null)) as any;
      if (res.ok) setEnabledState(!!j?.enabled);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ enabled, loading, setEnabled, refresh }), [enabled, loading, setEnabled, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSafeMode() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSafeMode must be used within SafeModeProvider');
  return v;
}

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'jc_low_power';

function readInitial(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === '0') return false;
  if (raw === '1') return true;

  // Default: optimized (low power ON), unless FX is explicitly opted-in via env.
  return process.env.NEXT_PUBLIC_JC_FX === '1' ? false : true;
}

function applyToDom(enabled: boolean) {
  const root = document.documentElement;

  // Low power mode implies: reduce heavy visual effects.
  root.classList.toggle('jc-perf', enabled);

  // Heavyweight FX layer is env-gated (NEXT_PUBLIC_JC_FX=1).
  if (enabled) {
    root.removeAttribute('data-jc-fx');
    return;
  }

  if (process.env.NEXT_PUBLIC_JC_FX === '1') {
    root.setAttribute('data-jc-fx', '1');
  } else {
    root.removeAttribute('data-jc-fx');
  }
}

type Ctx = {
  enabled: boolean;
  loading: boolean;
  setEnabled: (v: boolean) => Promise<void>;
  toggle: () => Promise<void>;
};

const LowPowerModeContext = createContext<Ctx | null>(null);

export function LowPowerModeProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  const setEnabled = useCallback(async (v: boolean) => {
    setEnabledState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    } catch {
      // ignore storage failures
    }
    applyToDom(v);
  }, []);

  useEffect(() => {
    const v = readInitial();
    setEnabledState(v);
    applyToDom(v);
    setLoading(false);
  }, []);

  useEffect(() => {
    function onToggle() {
      void (async () => {
        await setEnabled(!enabled);
      })();
    }
    window.addEventListener('jc:toggle-low-power', onToggle as any);
    return () => window.removeEventListener('jc:toggle-low-power', onToggle as any);
  }, [enabled, setEnabled]);

  const toggle = useCallback(async () => {
    await setEnabled(!enabled);
  }, [enabled, setEnabled]);

  const value = useMemo(() => ({ enabled, loading, setEnabled, toggle }), [enabled, loading, setEnabled, toggle]);

  return <LowPowerModeContext.Provider value={value}>{children}</LowPowerModeContext.Provider>;
}

export function useLowPowerMode() {
  const ctx = useContext(LowPowerModeContext);
  if (!ctx) throw new Error('useLowPowerMode must be used within LowPowerModeProvider');
  return ctx;
}

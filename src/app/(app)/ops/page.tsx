'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, EmptyState, Skeleton, StatusChip } from '@/components/ui';
import { useSafeMode } from '@/components/SafeModeClient';
// (restart dialog removed)
import { RawJsonPanel } from '@/components/RawJsonPanel';

export default function OpsPage() {
  const { enabled: safeMode } = useSafeMode();

  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // restart is unavailable in current public gateway mode

  const runtime = useMemo(() => {
    const r = status?.runtime;
    if (!r) return null;
    const bits = [r?.host ? `host=${r.host}` : null, r?.node ? `node=${r.node}` : null, r?.model ? `model=${r.model}` : null].filter(Boolean);
    return bits.length ? bits.join(' • ') : null;
  }, [status]);

  const fxMode = process.env.NEXT_PUBLIC_JC_FX === '1';
  const [docFxMode, setDocFxMode] = useState<boolean | null>(null);

  useEffect(() => {
    // Reflect the actual DOM state (in case something toggles it at runtime).
    const root = document.documentElement;
    setDocFxMode(root.dataset.jcFx === '1');
  }, []);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ops/status', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Failed to load');
      setStatus(j.result);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setBusy(false);
    }
  }

  // Restart is unavailable in current public gateway mode.

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <Card
        title="Ops"
        subtitle="Gateway status + restart. All calls are server-side (token never hits the browser)."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_88%,transparent)] px-2 py-1 text-[11px] text-[var(--muted)] sm:flex">
              <span className="font-mono">FX mode:</span>
              <span className="font-semibold text-[var(--fg)]">{(docFxMode ?? fxMode) ? 'on' : 'off'}</span>
              <span className="mx-1 opacity-50">•</span>
              <span className="font-mono">Perf mode:</span>
              <span className="font-semibold text-[var(--fg)]">optimized</span>
            </div>

            <StatusChip tone={busy ? 'warn' : error ? 'bad' : status ? 'ok' : 'idle'}>
              {busy ? 'Checking…' : error ? 'Degraded' : status ? 'Operational' : 'Idle'}
            </StatusChip>
            <Button variant="outline" onClick={load} disabled={busy}>
              Refresh
            </Button>
            <Button variant="danger" disabled>
              Restart (Unavailable)
            </Button>
          </div>
        }
      >
        {safeMode ? <Alert variant="warning" title="Safe Mode" message="Read-only mode is enabled; restart is blocked server-side." /> : null}
        <Alert
          variant="info"
          title="Restart unavailable"
          message="This public gateway deployment does not expose a restart endpoint. Use server CLI: openclaw gateway restart"
        />
        {error ? (
          <Alert variant="error" title="Ops status unavailable" message={error} right={<Button variant="outline" onClick={load}>Retry</Button>} />
        ) : status ? (
          <Alert
            variant="success"
            title="Gateway reachable"
            message={runtime ? <span className="font-mono text-[12px]">{runtime}</span> : 'session_status loaded successfully.'}
          />
        ) : (
          <Alert variant="info" message="Loading session_status from the gateway…" />
        )}
      </Card>

      <Card title="Raw status" subtitle="Gateway response (collapsed by default).">
        {busy && !status ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : !status ? (
          <EmptyState title="No data" description="Refresh to fetch current gateway session_status." action={<Button variant="outline" onClick={load}>Refresh</Button>} />
        ) : (
          <RawJsonPanel data={status} label="STATUS" filename="ops-status.json" />
        )}
      </Card>

      {/* Restart UI removed: unavailable in current public gateway mode */}
    </div>
  );
}

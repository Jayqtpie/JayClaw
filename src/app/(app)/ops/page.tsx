'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, CodeBlock, EmptyState, Skeleton, StatusChip } from '@/components/ui';

export default function OpsPage() {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runtime = useMemo(() => {
    const r = status?.runtime;
    if (!r) return null;
    const bits = [r?.host ? `host=${r.host}` : null, r?.node ? `node=${r.node}` : null, r?.model ? `model=${r.model}` : null].filter(Boolean);
    return bits.length ? bits.join(' • ') : null;
  }, [status]);

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

  async function restart() {
    if (!confirm('Restart OpenClaw Gateway? This may interrupt in-flight tasks.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ops/restart', { method: 'POST' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Restart failed');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Restart failed');
    } finally {
      setBusy(false);
    }
  }

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
            <StatusChip tone={busy ? 'warn' : error ? 'bad' : status ? 'ok' : 'idle'}>
              {busy ? 'Checking…' : error ? 'Degraded' : status ? 'Operational' : 'Idle'}
            </StatusChip>
            <Button variant="outline" onClick={load} disabled={busy}>
              Refresh
            </Button>
            <Button variant="danger" onClick={restart} disabled={busy}>
              Restart
            </Button>
          </div>
        }
      >
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

      <Card title="Raw status" subtitle="Gateway response.">
        {busy && !status ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : !status ? (
          <EmptyState title="No data" description="Refresh to fetch current gateway session_status." action={<Button variant="outline" onClick={load}>Refresh</Button>} />
        ) : (
          <CodeBlock label="STATUS">{JSON.stringify(status, null, 2)}</CodeBlock>
        )}
      </Card>
    </div>
  );
}

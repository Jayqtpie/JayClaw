'use client';

import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';

export default function OpsPage() {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ops/status');
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
    if (!confirm('Restart OpenClaw Gateway?')) return;
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <Card
        title="Ops"
        subtitle="Gateway status + restart. All calls are server-side (token never hits the browser)."
        right={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={busy}>
              {busy ? 'Loading…' : 'Refresh'}
            </Button>
            <Button onClick={restart} disabled={busy}>
              Restart
            </Button>
          </div>
        }
      >
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </Card>

      <Card title="Raw status" subtitle="Gateway response.">
        <pre className="max-h-[520px] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-[var(--fg)]">
          {status ? JSON.stringify(status, null, 2) : '—'}
        </pre>
      </Card>
    </div>
  );
}

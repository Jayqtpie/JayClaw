'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, EmptyState, Skeleton, StatusChip } from '@/components/ui';
import { RawJsonPanel } from '@/components/RawJsonPanel';

type DiagState = any;

type Row = {
  id: string;
  label: string;
  module: string;
  status: 'pass' | 'fail' | 'skip';
  ts: string;
  details?: any;
};

function toneFor(status: Row['status']) {
  if (status === 'pass') return 'ok';
  if (status === 'fail') return 'bad';
  return 'idle';
}

export default function DiagnosticsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DiagState | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/diagnostics', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Failed to load diagnostics');
      setState(j?.state ?? null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load diagnostics');
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/diagnostics/run', { method: 'POST' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Failed to run probes');
      setState(j?.state ?? null);
    } catch (e: any) {
      setError(e?.message || 'Failed to run probes');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const r = state?.results || {};
    return Object.values(r) as Row[];
  }, [state]);

  const modules = useMemo(() => {
    const by: Record<string, Row[]> = {};
    for (const row of rows) {
      const k = row.module || 'Other';
      if (!by[k]) by[k] = [];
      by[k].push(row);
    }
    for (const k of Object.keys(by)) {
      by[k]!.sort((a, b) => a.id.localeCompare(b.id));
    }
    return Object.entries(by).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const summary = useMemo(() => {
    const pass = rows.filter((r) => r.status === 'pass').length;
    const fail = rows.filter((r) => r.status === 'fail').length;
    const skip = rows.filter((r) => r.status === 'skip').length;
    return { pass, fail, skip, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-6">
      <Card
        title="Diagnostics"
        subtitle="Server-side capability probes. Actions are gated to avoid fake success states."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={busy ? 'warn' : summary.fail ? 'bad' : 'ok'}>
              {busy ? 'Probing…' : `${summary.pass} pass • ${summary.fail} fail • ${summary.skip} skip`}
            </StatusChip>
            <Button variant="outline" onClick={load} disabled={busy}>
              Refresh
            </Button>
            <Button onClick={run} disabled={busy}>
              Run probes
            </Button>
          </div>
        }
      >
        {error ? <Alert variant="error" title="Diagnostics error" message={error} /> : null}
        {state?.generatedAt ? (
          <div className="mt-2 text-xs text-[var(--muted)]">
            Last probe: <span className="font-mono">{state.generatedAt}</span>
            {state?.safeModeEnabled ? <span className="ml-2">• Safe Mode enabled</span> : null}
          </div>
        ) : null}

        <Alert
          variant="info"
          title="How to read this"
          message="PASS = verified via a real server-side tool call. FAIL = tool call failed. SKIP = not safe to probe automatically (mutating) or missing env prerequisites."
        />
      </Card>

      {busy && !state ? <Skeleton className="h-44 w-full" /> : null}

      {!busy && !state ? (
        <EmptyState title="No diagnostics yet" description="Run probes to discover what this gateway deployment supports." action={<Button onClick={run}>Run probes</Button>} />
      ) : null}

      {modules.map(([module, list]) => (
        <Card key={module} title={module} subtitle="PASS/FAIL reflects last probe timestamp.">
          <div className="space-y-2">
            {list.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)] p-3 shadow-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold break-words">{r.label}</div>
                  <div className="mt-1 text-[11px] text-[var(--muted)] font-mono break-all">{r.id}</div>
                  <div className="mt-1 text-[11px] text-[var(--muted-2)] font-mono break-all">{r.ts}</div>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <StatusChip tone={toneFor(r.status) as any}>{r.status.toUpperCase()}</StatusChip>
                  {r.details ? <RawJsonPanel data={r.details} label="DETAILS" filename="probe-details.json" defaultOpen={false} maxChars={800} /> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card title="Raw payload" subtitle="Exactly what /api/diagnostics returns (collapsed by default).">
        <RawJsonPanel data={state} label="DIAGNOSTICS" filename="diagnostics.json" defaultOpen={false} maxChars={2400} maxArrayItems={50} />
      </Card>
    </div>
  );
}

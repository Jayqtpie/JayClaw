'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, CodeBlock, EmptyState, Skeleton, StatusChip, TextInput } from '@/components/ui';

type Entry = any;

export default function AuditPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/audit?limit=250', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Failed to load');
      setEntries(j.entries || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return null;
    const qq = q.trim().toLowerCase();
    if (!qq) return entries;
    return entries.filter((e) => {
      const hay = JSON.stringify({ action: e?.action, summary: e?.summary, result: e?.result }).toLowerCase();
      return hay.includes(qq);
    });
  }, [entries, q]);

  const failureCount = useMemo(() => (entries ? entries.filter((e) => !e?.result?.ok).length : 0), [entries]);

  return (
    <div className="space-y-6">
      <Card
        title="Audit Trail"
        subtitle="Local JSONL audit log (data/audit.jsonl). Captures mutating actions + outcomes."
        right={
          <div className="flex items-center gap-2">
            <StatusChip tone={busy ? 'warn' : failureCount ? 'warn' : 'ok'}>
              {busy ? 'Loading…' : `${entries?.length ?? 0} entries • ${failureCount} failures`}
            </StatusChip>
            <Button variant="outline" onClick={load} disabled={busy}>
              Refresh
            </Button>
          </div>
        }
      >
        {error ? <Alert variant="error" title="Audit error" message={error} /> : null}
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <TextInput value={q} onChange={setQ} placeholder="Filter by action / summary / error…" />
          <Button variant="outline" onClick={() => setQ('')} disabled={!q.trim()}>
            Clear
          </Button>
        </div>
      </Card>

      <Card title="Entries" subtitle="Newest first.">
        {busy && !entries ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : !entries ? (
          <EmptyState title="No data" description="Refresh to fetch audit entries." action={<Button variant="outline" onClick={load}>Refresh</Button>} />
        ) : (filtered?.length || 0) === 0 ? (
          <EmptyState title="No matching entries" description="Adjust your filter." />
        ) : (
          <CodeBlock label="AUDIT">{JSON.stringify(filtered, null, 2)}</CodeBlock>
        )}
      </Card>
    </div>
  );
}

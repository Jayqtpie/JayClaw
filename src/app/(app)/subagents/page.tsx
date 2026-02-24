'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, EmptyState, Skeleton, StatusChip, TextArea } from '@/components/ui';
import { useSafeMode } from '@/components/SafeModeClient';
import { RawJsonPanel } from '@/components/RawJsonPanel';

type SubagentList = any;

export default function SubagentsPage() {
  const { enabled: safeMode } = useSafeMode();

  const [list, setList] = useState<SubagentList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [spawnPrompt, setSpawnPrompt] = useState('');

  const count = useMemo(() => {
    const arr = (list as any)?.subagents || (list as any)?.items || (Array.isArray(list) ? list : null);
    return Array.isArray(arr) ? arr.length : undefined;
  }, [list]);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/subagents', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Failed to load');
      setList(j.result);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setBusy(false);
    }
  }

  async function spawn() {
    const message = spawnPrompt.trim();
    if (!message) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/subagents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Spawn failed');
      setSpawnPrompt('');
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Spawn failed');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <Card
        title="Subagents"
        subtitle="List and optionally spawn/steer subagents via the gateway."
        right={
          <div className="flex items-center gap-2">
            <StatusChip tone={busy ? 'warn' : 'info'}>{busy ? 'Loading…' : count !== undefined ? `${count} items` : 'Ready'}</StatusChip>
            <Button variant="outline" onClick={refresh} disabled={busy}>
              Refresh
            </Button>
          </div>
        }
      >
        {error ? (
          <Alert variant="error" title="Couldn’t load subagents" message={error} right={<Button variant="outline" onClick={refresh}>Retry</Button>} />
        ) : (
          <Alert
            title="Fast workflow"
            variant="info"
            message={
              <span>
                Use the command palette (Ctrl/Cmd+K) to jump to Ops / Scheduler / Memory without losing context.
              </span>
            }
          />
        )}
      </Card>

      <Card title="Spawn / Steer" subtitle="POSTs to /api/subagents (server-side).">
        {safeMode ? <Alert variant="warning" title="Safe Mode" message="Read-only mode is enabled; spawning/steering is blocked server-side." /> : null}
        <div className="space-y-3">
          <TextArea value={spawnPrompt} onChange={setSpawnPrompt} rows={6} placeholder="Describe the subagent task…" />
          <div className="flex justify-end">
            <Button onClick={spawn} disabled={busy || safeMode || !spawnPrompt.trim()}>
              {busy ? 'Working…' : 'Send'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Raw list" subtitle="Gateway response (collapsed by default).">
        {busy && !list ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !list ? (
          <EmptyState title="No data" description="Refresh to fetch the current subagent list." action={<Button variant="outline" onClick={refresh}>Refresh</Button>} />
        ) : (
          <RawJsonPanel data={list} label="SUBAGENTS" filename="subagents.json" />
        )}
      </Card>
    </div>
  );
}

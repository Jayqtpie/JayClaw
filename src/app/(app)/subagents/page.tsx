'use client';

import { useEffect, useState } from 'react';
import { Button, Card, TextInput, TextArea } from '@/components/ui';

type SubagentList = any;

export default function SubagentsPage() {
  const [list, setList] = useState<SubagentList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [spawnPrompt, setSpawnPrompt] = useState('');

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/subagents');
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
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <Card
        title="Subagents"
        subtitle="List and (optionally) spawn/steer subagents via the gateway. If your gateway uses a different action name, update /src/lib/openclaw.ts + /api/subagents."
        right={
          <Button variant="outline" onClick={refresh} disabled={busy}>
            {busy ? 'Loading…' : 'Refresh'}
          </Button>
        }
      >
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </Card>

      <Card title="Spawn / Steer" subtitle="MVP placeholder: POSTs to /api/subagents (server-side).">
        <div className="space-y-3">
          <TextArea value={spawnPrompt} onChange={setSpawnPrompt} rows={5} placeholder="Describe the subagent task…" />
          <div className="flex justify-end">
            <Button onClick={spawn} disabled={busy || !spawnPrompt.trim()}>
              {busy ? 'Working…' : 'Send'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Raw list" subtitle="Gateway response.">
        <pre className="max-h-[520px] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-[var(--fg)]">
          {list ? JSON.stringify(list, null, 2) : '—'}
        </pre>
      </Card>
    </div>
  );
}

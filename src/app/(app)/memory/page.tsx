'use client';

import { useState } from 'react';
import { Button, Card, TextInput } from '@/components/ui';

type FsHit = { id: string; file: string; line: number; text: string };

export default function MemoryPage() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hits, setHits] = useState<FsHit[]>([]);
  const [gatewayResult, setGatewayResult] = useState<any>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snippet, setSnippet] = useState<any>(null);

  async function search() {
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setError(null);
    setSelectedId(null);
    setSnippet(null);
    setHits([]);
    setGatewayResult(null);

    try {
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(query)}`);
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Search failed');
      if (j.source === 'filesystem') {
        setHits(j.hits || []);
      } else {
        setGatewayResult(j.result);
      }
    } catch (e: any) {
      setError(e?.message || 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  async function open(id: string) {
    setBusy(true);
    setError(null);
    setSelectedId(id);
    setSnippet(null);
    try {
      const res = await fetch(`/api/memory/get?id=${encodeURIComponent(id)}`);
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Load failed');
      setSnippet(j.snippet ?? j.result ?? j);
    } catch (e: any) {
      setError(e?.message || 'Load failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Memory" subtitle="Search memory (gateway-first; filesystem fallback if configured).">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <TextInput value={q} onChange={setQ} placeholder="Search…" />
          </div>
          <Button onClick={search} disabled={busy || !q.trim()}>
            {busy ? 'Searching…' : 'Search'}
          </Button>
        </div>
        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      </Card>

      {hits.length ? (
        <Card title="Hits" subtitle="Filesystem fallback hits (click for snippet).">
          <div className="space-y-2">
            {hits.map((h) => (
              <button
                key={h.id}
                className={`w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-sm transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                  selectedId === h.id ? 'ring-2 ring-[var(--ring)]' : ''
                }`}
                onClick={() => open(h.id)}
              >
                <div className="text-xs text-[var(--muted)]">
                  {h.file}:{h.line}
                </div>
                <div className="mt-1 text-sm text-[var(--fg)]">{h.text}</div>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {snippet ? (
        <Card title="Snippet" subtitle={selectedId ? `From ${selectedId}` : undefined}>
          <pre className="max-h-[520px] overflow-auto rounded-xl border border-slate-800 bg-black/30 p-3 text-xs text-slate-200">
            {typeof snippet === 'string' ? snippet : JSON.stringify(snippet, null, 2)}
          </pre>
        </Card>
      ) : null}

      {gatewayResult ? (
        <Card title="Gateway result" subtitle="Raw gateway response.">
          <pre className="max-h-[520px] overflow-auto rounded-xl border border-slate-800 bg-black/30 p-3 text-xs text-slate-200">
            {JSON.stringify(gatewayResult, null, 2)}
          </pre>
        </Card>
      ) : null}
    </div>
  );
}

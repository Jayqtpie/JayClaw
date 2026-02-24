'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Card, CodeBlock, EmptyState, Skeleton, StatusChip, TextInput } from '@/components/ui';

type FsHit = { id: string; file: string; line: number; text: string };

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export default function MemoryPage() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hits, setHits] = useState<FsHit[]>([]);
  const [gatewayResult, setGatewayResult] = useState<any>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snippet, setSnippet] = useState<any>(null);

  const mode = useMemo(() => {
    if (gatewayResult) return 'gateway';
    if (hits.length) return 'filesystem';
    return 'idle';
  }, [gatewayResult, hits.length]);

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
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
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
      const res = await fetch(`/api/memory/get?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
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
      <Card
        title="Memory"
        subtitle="Search memory (gateway-first; filesystem fallback if configured)."
        right={
          <StatusChip tone={busy ? 'warn' : mode === 'gateway' ? 'info' : mode === 'filesystem' ? 'ok' : 'idle'}>
            {busy ? 'Searching…' : mode === 'gateway' ? 'Gateway' : mode === 'filesystem' ? 'Filesystem' : 'Idle'}
          </StatusChip>
        }
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <TextInput
              value={q}
              onChange={setQ}
              placeholder="Search…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!busy && q.trim()) void search();
                }
              }}
            />
          </div>
          <Button onClick={search} disabled={busy || !q.trim()}>
            {busy ? 'Searching…' : 'Search'}
          </Button>
        </div>

        <div className="mt-3">
          {error ? (
            <Alert variant="error" title="Memory query failed" message={error} />
          ) : (
            <Alert
              variant="info"
              message="Search terms match agent memory entries. Use filesystem hits to open contextual snippets."
            />
          )}
        </div>
      </Card>

      {busy && mode === 'idle' ? (
        <Card title="Results" subtitle="Loading…">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
      ) : null}

      {hits.length ? (
        <Card title="Hits" subtitle="Filesystem fallback hits (click for snippet).">
          <div className="space-y-2">
            {hits.map((h) => (
              <button
                key={h.id}
                className={cx(
                  'w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)] p-4 text-left shadow-sm transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                  selectedId === h.id && 'ring-2 ring-[var(--ring)]'
                )}
                onClick={() => void open(h.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-[var(--muted)] font-mono">
                    {h.file}:{h.line}
                  </div>
                  <StatusChip tone={selectedId === h.id ? 'info' : 'idle'}>
                    {selectedId === h.id ? 'Selected' : 'Hit'}
                  </StatusChip>
                </div>
                <div className="mt-2 text-sm text-[var(--fg)]">{h.text}</div>
              </button>
            ))}
          </div>
        </Card>
      ) : mode === 'filesystem' ? (
        <Card title="Hits" subtitle="Filesystem fallback results.">
          <EmptyState title="No matches" description="Try fewer terms or search for a unique keyword." />
        </Card>
      ) : null}

      {snippet ? (
        <Card title="Snippet" subtitle={selectedId ? `From ${selectedId}` : undefined}>
          <CodeBlock label="SNIPPET">
            {typeof snippet === 'string' ? snippet : JSON.stringify(snippet, null, 2)}
          </CodeBlock>
        </Card>
      ) : selectedId && busy ? (
        <Card title="Snippet" subtitle={`Loading ${selectedId}…`}>
          <Skeleton className="h-44 w-full" />
        </Card>
      ) : null}

      {gatewayResult ? (
        <Card title="Gateway result" subtitle="Raw gateway response.">
          <CodeBlock label="GATEWAY">{JSON.stringify(gatewayResult, null, 2)}</CodeBlock>
        </Card>
      ) : mode === 'gateway' && !gatewayResult && !busy ? (
        <Card title="Gateway result" subtitle="Raw gateway response.">
          <EmptyState title="No result" description="The gateway returned no payload for this query." />
        </Card>
      ) : null}
    </div>
  );
}

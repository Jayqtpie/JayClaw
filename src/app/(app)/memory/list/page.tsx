'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, CodeBlock, EmptyState, Skeleton, StatusChip, TextInput } from '@/components/ui';

type MemoryDocType = 'root' | 'daily' | 'unknown';

type MemoryListItem = {
  id: string;
  source: 'MEMORY.md' | 'memory' | 'gateway';
  fileName: string;
  type: MemoryDocType;
  date?: string;
  project?: string | null;
  mtimeMs?: number;
  size?: number;
  title?: string | null;
  preview: string;
};

type MemoryListResponse = {
  ok: true;
  mode: 'local' | 'gateway';
  page: number;
  pageSize: number;
  total: number;
  projects: string[];
  items: MemoryListItem[];
  warnings?: string[];
  resolved?: { rootFile: string | null; dailyDir: string | null };
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function MiniSelect({
  value,
  onChange,
  children,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold tracking-[0.14em] text-[var(--muted-2)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_65%,transparent)] px-3 text-sm text-[var(--fg)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {children}
      </select>
    </label>
  );
}

function formatUkDate(yyyyMmDd: string): string {
  const m = (yyyyMmDd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return yyyyMmDd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function SnippetDialog({
  open,
  title,
  body,
  truncated,
  onClose,
  onCopy,
}: {
  open: boolean;
  title: string;
  body: string;
  truncated?: boolean;
  onClose: () => void;
  onCopy: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--fg)] truncate">{title}</div>
            {truncated ? <div className="mt-1 text-xs text-[var(--muted)]">Truncated for safety/perf.</div> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onCopy}>
              Copy
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <CodeBlock label="SNIPPET">{body}</CodeBlock>
        </div>
      </div>
    </div>
  );
}

export default function MemoryListPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [source, setSource] = useState('');
  const [type, setType] = useState('');
  const [project, setProject] = useState('');
  const [date, setDate] = useState('');

  const [data, setData] = useState<MemoryListResponse | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [openBusy, setOpenBusy] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [openBody, setOpenBody] = useState<string>('');
  const [openTruncated, setOpenTruncated] = useState(false);

  const lastReqKey = useRef<string>('');

  const reqKey = useMemo(() => {
    return JSON.stringify({ page, pageSize, source, type, project, date });
  }, [page, pageSize, source, type, project, date]);

  async function load() {
    setBusy(true);
    setError(null);

    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('pageSize', String(pageSize));
    if (source) qs.set('source', source);
    if (type) qs.set('type', type);
    if (project.trim()) qs.set('project', project.trim());
    if (date.trim()) qs.set('date', date.trim());

    try {
      const res = await fetch(`/api/memory/list?${qs.toString()}`, { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'List failed');
      setData(j as MemoryListResponse);
    } catch (e: any) {
      setError(e?.message || 'List failed');
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (lastReqKey.current === reqKey) return;
    lastReqKey.current = reqKey;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey]);

  const groups = useMemo(() => {
    const items = data?.items || [];
    const by: Record<string, MemoryListItem[]> = {};
    for (const it of items) {
      const k = it.source;
      by[k] = by[k] || [];
      by[k].push(it);
    }
    return by;
  }, [data?.items]);

  async function openSnippet(item: MemoryListItem) {
    setOpenId(item.id);
    setOpenBusy(true);
    setOpenError(null);
    setOpenBody('');
    setOpenTruncated(false);

    try {
      if (item.source === 'gateway') {
        const res = await fetch(`/api/memory/get?id=${encodeURIComponent(item.id)}`, { cache: 'no-store' });
        const j = (await res.json().catch(() => null)) as any;
        if (!res.ok || !j?.ok) throw new Error(j?.error || 'Load failed');
        const payload = j.result ?? j.snippet ?? j;
        setOpenBody(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
        setOpenTruncated(false);
      } else {
        const res = await fetch(`/api/memory/doc?id=${encodeURIComponent(item.id)}`, { cache: 'no-store' });
        const j = (await res.json().catch(() => null)) as any;
        if (!res.ok || !j?.ok) throw new Error(j?.error || 'Load failed');
        setOpenBody(String(j.content || ''));
        setOpenTruncated(Boolean(j.truncated));
      }
    } catch (e: any) {
      setOpenError(e?.message || 'Load failed');
      setOpenBody(item.preview || '');
    } finally {
      setOpenBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (data?.pageSize ?? pageSize)));

  return (
    <div className="space-y-6">
      <Card
        title="Memory List"
        subtitle="Browse memory docs (local files when configured; gateway fallback when server filesystem is unavailable)."
        right={
          <div className="flex flex-wrap items-center gap-2">
            {data?.mode ? (
              <StatusChip tone={data.mode === 'gateway' ? 'info' : 'ok'}>
                {data.mode === 'gateway' ? 'Gateway mode' : 'Local mode'}
              </StatusChip>
            ) : null}
            <StatusChip tone={busy ? 'warn' : error ? 'bad' : 'ok'}>
              {busy ? 'Loading…' : error ? 'Error' : `${total} docs`}
            </StatusChip>
          </div>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[var(--muted)]">
            <Link className="underline decoration-[color-mix(in_oklab,var(--primary)_55%,transparent)] hover:text-[var(--fg)]" href="/memory">
              Back to search
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPage(1);
                void load();
              }}
              disabled={busy}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <MiniSelect label="Source" value={source} onChange={(v) => {
            setPage(1);
            setSource(v);
          }}>
            <option value="">All</option>
            <option value="MEMORY.md">MEMORY.md</option>
            <option value="memory">memory/</option>
            <option value="gateway">gateway</option>
          </MiniSelect>

          <MiniSelect label="Type" value={type} onChange={(v) => {
            setPage(1);
            setType(v);
          }}>
            <option value="">All</option>
            <option value="root">root</option>
            <option value="daily">daily</option>
            <option value="unknown">unknown</option>
          </MiniSelect>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-[0.14em] text-[var(--muted-2)]">Project</span>
            <TextInput
              value={project}
              onChange={(v) => {
                setPage(1);
                setProject(v);
              }}
              placeholder={data?.projects?.length ? `e.g. ${data.projects[0]}` : 'Project…'}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-[0.14em] text-[var(--muted-2)]">Date (dd/mm/yyyy)</span>
            <TextInput
              value={date}
              onChange={(v) => {
                setPage(1);
                setDate(v);
              }}
              placeholder="24/02/2026"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <MiniSelect label="Page size" value={String(pageSize)} onChange={(v) => {
            setPage(1);
            setPageSize(Number(v) || 25);
          }}>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </MiniSelect>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={busy || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </Button>
            <div className="text-sm text-[var(--muted)]">
              Page <span className="text-[var(--fg)] font-semibold">{page}</span> / {totalPages}
            </div>
            <Button
              variant="outline"
              disabled={busy || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {data?.warnings?.length ? (
            <Alert
              variant={data?.mode === 'gateway' ? 'info' : 'warning'}
              title={data?.mode === 'gateway' ? 'Gateway-backed listing' : 'Memory paths'}
              message={
                <div className="space-y-1">
                  {data.warnings.map((w, idx) => (
                    <div key={idx}>{w}</div>
                  ))}
                  {data?.mode === 'local' ? (
                    <div className="mt-2 text-xs">
                      Tip: ensure the server can read <span className="font-mono">MEMORY.md</span> and <span className="font-mono">memory/*.md</span>.
                    </div>
                  ) : null}
                </div>
              }
            />
          ) : null}
          {error ? <Alert variant="error" title="Memory list failed" message={error} /> : null}
        </div>
      </Card>

      {busy && !data ? (
        <Card title="Documents" subtitle="Loading…">
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </Card>
      ) : null}

      {!busy && data && !data.items.length ? (
        <Card title="Documents" subtitle="No matches for your filters.">
          <EmptyState
            title="Nothing to show"
            description="Try clearing filters, or reduce specificity (project/date)."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setPage(1);
                  setSource('');
                  setType('');
                  setProject('');
                  setDate('');
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : null}

      {data?.items?.length ? (
        <div className="space-y-6">
          {(['MEMORY.md', 'memory', 'gateway'] as const).map((k) => {
            const items = groups[k] || [];
            if (!items.length) return null;
            return (
              <Card
                key={k}
                title={k === 'MEMORY.md' ? 'MEMORY.md' : k === 'memory' ? 'memory/' : 'gateway'}
                subtitle={`${items.length} shown (this page)`}
              >
                <div className="space-y-2">
                  {items.map((it) => {
                    const label = it.title || it.fileName;
                    return (
                      <div
                        key={it.id}
                        className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)] p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[var(--fg)] truncate">{label}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-[var(--muted)] font-mono">{it.id}</span>
                              {it.type ? <StatusChip tone="idle">{it.type}</StatusChip> : null}
                              {it.date ? <StatusChip tone="info">{formatUkDate(it.date)}</StatusChip> : null}
                              {it.project ? <StatusChip tone="ok">{it.project}</StatusChip> : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" onClick={() => void copy(it.preview)}>
                              Copy preview
                            </Button>
                            <Button variant="outline" onClick={() => void openSnippet(it)}>
                              Open snippet
                            </Button>
                            <Link
                              className={cx(
                                'inline-flex h-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_70%,transparent)] px-4 text-sm font-medium text-[var(--fg)] shadow-sm transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
                              )}
                              href={`/memory?q=${encodeURIComponent(label)}`}
                              title="Run a search seeded from this document"
                            >
                              Search
                            </Link>
                          </div>
                        </div>

                        <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--code)_92%,black)] p-3 text-xs text-[var(--code-fg)] shadow-sm max-h-40 overflow-auto whitespace-pre-wrap">
                          {it.preview || '(empty)'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      <SnippetDialog
        open={Boolean(openId)}
        title={openId ? `Snippet: ${openId}` : 'Snippet'}
        body={openBusy ? 'Loading…' : openError ? `Error: ${openError}\n\n---\n\n${openBody}` : openBody}
        truncated={openTruncated}
        onClose={() => {
          setOpenId(null);
          setOpenError(null);
          setOpenBody('');
          setOpenTruncated(false);
        }}
        onCopy={() => void copy(openBody)}
      />
    </div>
  );
}

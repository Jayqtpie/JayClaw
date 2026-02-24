'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, EmptyState, Skeleton, StatusChip, TextInput } from '@/components/ui';
import { RawJsonPanel } from '@/components/RawJsonPanel';

type Entry = any;

const DEFAULT_PAGE_SIZE = 25;
const MAX_RENDER = 500; // hard cap as an extra safety net

export default function AuditPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/audit?limit=500', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Failed to load');
      const next = (j.entries || []) as Entry[];
      setEntries(next.slice(0, MAX_RENDER));
      setPage(1);
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

  const indexed = useMemo(() => {
    if (!entries) return null;
    // Precompute a small searchable string once (avoids repeated JSON.stringify work during typing).
    return entries.map((e) => {
      const action = String(e?.action ?? '');
      const summary = String(e?.summary ?? '');
      const ok = e?.result?.ok === false ? 'fail' : 'ok';
      const err = String(e?.result?.error ?? e?.error ?? '');
      return {
        entry: e,
        hay: `${action} ${summary} ${ok} ${err}`.toLowerCase(),
      };
    });
  }, [entries]);

  const filtered = useMemo(() => {
    if (!indexed) return null;
    const qq = q.trim().toLowerCase();
    if (!qq) return indexed;
    return indexed.filter((x) => x.hay.includes(qq));
  }, [indexed, q]);

  const failureCount = useMemo(
    () => (entries ? entries.filter((e) => e?.result?.ok === false).length : 0),
    [entries]
  );

  const total = filtered?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    if (!filtered) return null;
    const start = (clampedPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, clampedPage, pageSize]);

  useEffect(() => {
    // keep page in range when filter/pageSize changes
    if (page !== clampedPage) setPage(clampedPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedPage]);

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
          <TextInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Filter by action / summary / error…"
          />
          <Button variant="outline" onClick={() => setQ('')} disabled={!q.trim()}>
            Clear
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <div>
            Showing <span className="font-semibold text-[var(--fg)]">{total}</span> matches
          </div>
          <div className="flex items-center gap-2">
            <span>Page size</span>
            <select
              value={String(pageSize)}
              onChange={(e) => {
                const next = Number(e.target.value) || DEFAULT_PAGE_SIZE;
                setPageSize(next);
                setPage(1);
              }}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_65%,transparent)] px-2 py-1 text-xs text-[var(--fg)]"
              aria-label="Page size"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card
        title="Entries"
        subtitle={
          totalPages > 1
            ? `Page ${clampedPage} of ${totalPages}. Newest first.`
            : 'Newest first.'
        }
        right={
          entries ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </Button>
              <Button variant="outline" disabled={clampedPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          ) : null
        }
      >
        {busy && !entries ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : !entries ? (
          <EmptyState title="No data" description="Refresh to fetch audit entries." action={<Button variant="outline" onClick={load}>Refresh</Button>} />
        ) : total === 0 ? (
          <EmptyState title="No matching entries" description="Adjust your filter." />
        ) : (
          <div className="space-y-3 jc-cv">
            {pageItems?.map(({ entry }, idx) => {
              const ok = entry?.result?.ok !== false;
              const action = String(entry?.action ?? '—');
              const summary = String(entry?.summary ?? '').trim();
              const when = String(entry?.ts ?? entry?.time ?? entry?.at ?? '');
              const errMsg = entry?.result?.ok === false ? String(entry?.result?.error ?? entry?.error ?? 'Failed') : '';

              return (
                <div
                  key={entry?.id ?? `${clampedPage}-${idx}`}
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)] p-4 shadow-sm jc-contain"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--fg)] break-words">{action}</div>
                      {summary ? <div className="mt-1 text-xs text-[var(--muted)] break-words">{summary}</div> : null}
                      {when ? <div className="mt-1 text-[11px] text-[var(--muted-2)] font-mono break-all">{when}</div> : null}
                    </div>
                    <StatusChip tone={ok ? 'ok' : 'bad'}>{ok ? 'OK' : 'FAIL'}</StatusChip>
                  </div>

                  {!ok && errMsg ? (
                    <div className="mt-2 text-xs text-[color-mix(in_oklab,var(--danger)_80%,var(--fg))] break-words">{errMsg}</div>
                  ) : null}

                  <div className="mt-3">
                    <RawJsonPanel data={entry} label="ENTRY" filename="audit-entry.json" defaultOpen={false} maxChars={2200} maxArrayItems={25} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

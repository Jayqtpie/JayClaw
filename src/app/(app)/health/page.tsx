'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, EmptyState, Skeleton, StatusChip } from '@/components/ui';
import { RawJsonPanel } from '@/components/RawJsonPanel';

type Healthwall = any;

export default function HealthWallPage() {
  const [data, setData] = useState<Healthwall | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/healthwall', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Failed to load');
      setData(j);
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

  const gatewayOk = data?.gateway?.status && !data?.gateway?.statusError;
  const ssl = data?.ssl;
  const sslTone = ssl?.skipped
    ? 'idle'
    : ssl?.ok
      ? ssl?.daysLeft <= 14
        ? 'warn'
        : 'ok'
      : 'bad';

  return (
    <div className="space-y-6">
      <Card
        title="Health Wall"
        subtitle="Gateway health, token auth, SSL expiry, and recent failures (from local audit log)."
        right={
          <div className="flex items-center gap-2">
            <StatusChip tone={busy ? 'warn' : gatewayOk ? 'ok' : 'bad'}>
              {busy ? 'Checking…' : gatewayOk ? 'Online' : 'Offline'}
            </StatusChip>
            <Button variant="outline" onClick={load} disabled={busy}>
              Refresh
            </Button>
          </div>
        }
      >
        {error ? <Alert variant="error" title="Health Wall error" message={error} /> : null}

        {data ? (
          <div className="mt-2 grid gap-3 md:grid-cols-3 jc-cv">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)] p-4 shadow-sm jc-contain">
              <div className="text-xs font-semibold tracking-[0.16em] text-[var(--muted-2)]">GATEWAY</div>
              <div className="mt-2">
                <StatusChip tone={gatewayOk ? 'ok' : 'bad'}>{gatewayOk ? 'Reachable' : 'Unreachable'}</StatusChip>
              </div>
              <div className="mt-2 text-xs text-[var(--muted)]">
                {data?.gateway?.url?.set ? (
                  <span className="font-mono break-all">{data.gateway.url.value}</span>
                ) : (
                  'OPENCLAW_GATEWAY_URL not set'
                )}
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)] p-4 shadow-sm jc-contain">
              <div className="text-xs font-semibold tracking-[0.16em] text-[var(--muted-2)]">TOKEN CHECK</div>
              <div className="mt-2">
                <StatusChip tone={data?.tokenCheck?.ok ? 'ok' : 'bad'}>
                  {data?.tokenCheck?.ok ? 'Authorized' : 'Unauthorized / Failed'}
                </StatusChip>
              </div>
              {data?.gateway?.statusError ? (
                <div className="mt-2 text-xs text-[var(--muted)]">{String(data.gateway.statusError.error || 'error')}</div>
              ) : (
                <div className="mt-2 text-xs text-[var(--muted)]">session_status invocation</div>
              )}
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)] p-4 shadow-sm jc-contain">
              <div className="text-xs font-semibold tracking-[0.16em] text-[var(--muted-2)]">SSL</div>
              <div className="mt-2">
                <StatusChip tone={sslTone as any}>
                  {ssl?.skipped
                    ? `Skipped (${ssl?.reason})`
                    : ssl?.ok
                      ? `${ssl?.daysLeft} days left`
                      : `Error (${ssl?.reason || 'failed'})`}
                </StatusChip>
              </div>
              {ssl?.ok ? (
                <div className="mt-2 text-xs text-[var(--muted)]">
                  validTo: <span className="font-mono">{ssl.validTo}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : busy ? (
          <Alert variant="info" message="Loading…" />
        ) : null}
      </Card>

      <Card title="Recent failures" subtitle="Most recent audit entries with result.ok=false.">
        {busy && !data ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !data ? (
          <EmptyState title="No data" description="Refresh to fetch healthwall." action={<Button variant="outline" onClick={load}>Refresh</Button>} />
        ) : (data?.recentFailures?.length || 0) === 0 ? (
          <EmptyState title="No recent failures" description="Audit trail has no failed actions in the last batch." />
        ) : (
          <RawJsonPanel data={data.recentFailures} label="FAILURES" filename="recent-failures.json" defaultOpen={false} maxChars={2200} maxArrayItems={25} />
        )}
      </Card>

      <Card title="Raw health payload" subtitle="Debug payload returned by /api/healthwall (collapsed by default).">
        {!data && busy ? (
          <Skeleton className="h-44 w-full" />
        ) : (
          <RawJsonPanel data={data} label="HEALTHWALL" filename="healthwall.json" defaultOpen={false} maxChars={2200} maxArrayItems={25} />
        )}
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, EmptyState, Skeleton, StatusChip, TextArea, TextInput } from '@/components/ui';

type Reminder = {
  id: string;
  createdAt: number;
  cron: string;
  title: string;
  message: string;
  enabled: boolean;
};

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

export default function SchedulerPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [cron, setCron] = useState('0 9 * * *');
  const [message, setMessage] = useState('');

  const canCreate = useMemo(
    () => !busy && !!title.trim() && !!message.trim() && !!cron.trim(),
    [busy, title, message, cron]
  );

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/scheduler', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Failed to load');
      setReminders(j.reminders || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title, message, cron }),
      });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Create failed');
      setReminders(j.reminders || []);
      setTitle('');
      setMessage('');
    } catch (e: any) {
      setError(e?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id, enabled }),
      });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Toggle failed');
      setReminders(j.reminders || []);
    } catch (e: any) {
      setError(e?.message || 'Toggle failed');
    } finally {
      setBusy(false);
    }
  }

  async function runNow(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/scheduler/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Run failed');
    } catch (e: any) {
      setError(e?.message || 'Run failed');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <Card
        title="Scheduler"
        subtitle="Create, list, and run reminders. MVP stores reminders in memory (resets on deploy)."
        right={
          <div className="flex items-center gap-2">
            <StatusChip tone={busy ? 'warn' : 'info'}>{busy ? 'Syncing…' : `${reminders.length} reminders`}</StatusChip>
            <Button variant="outline" onClick={load} disabled={busy}>
              Refresh
            </Button>
          </div>
        }
      >
        {error ? <Alert variant="error" title="Scheduler error" message={error} /> : <Alert variant="info" message="Run now triggers a gateway message. Cron is stored as a string in MVP." />}
      </Card>

      <Card title="Create reminder" subtitle="Keep it short, explicit, and action-oriented.">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold tracking-[0.16em] text-[var(--muted-2)]">TITLE</div>
              <div className="mt-1">
                <TextInput value={title} onChange={setTitle} placeholder="Daily check-in" />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-[0.16em] text-[var(--muted-2)]">CRON</div>
              <div className="mt-1">
                <TextInput value={cron} onChange={setCron} placeholder="0 9 * * *" />
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold tracking-[0.16em] text-[var(--muted-2)]">MESSAGE</div>
            <div className="mt-1">
              <TextArea value={message} onChange={setMessage} placeholder="What should the reminder say?" rows={6} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={create} disabled={!canCreate}>
              {busy ? 'Saving…' : 'Create'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Reminders" subtitle="Enable/disable and run tasks on demand.">
        {busy && reminders.length === 0 ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : reminders.length === 0 ? (
          <EmptyState title="No reminders yet" description="Create your first reminder above (e.g. daily standup, healthcheck, or digest)." />
        ) : (
          <div className="space-y-3">
            {reminders.map((r) => (
              <div
                key={r.id}
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)] p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold tracking-[-0.01em]">{r.title}</div>
                      <StatusChip tone={r.enabled ? 'ok' : 'idle'}>{r.enabled ? 'Enabled' : 'Disabled'}</StatusChip>
                      <StatusChip tone="info" title={r.id}>
                        id: {r.id.slice(0, 8)}…
                      </StatusChip>
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      cron: <span className="font-mono">{r.cron}</span>
                      {r.createdAt ? <span className="ml-2 text-[var(--muted-2)]">created {formatDate(r.createdAt)}</span> : null}
                    </div>
                    <div className="mt-3 whitespace-pre-wrap text-sm text-[var(--fg)]">{r.message}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button variant="outline" onClick={() => toggle(r.id, !r.enabled)} disabled={busy}>
                      {r.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button onClick={() => runNow(r.id)} disabled={busy || !r.enabled}>
                      Run now
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

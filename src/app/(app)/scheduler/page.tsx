'use client';

import { useEffect, useState } from 'react';
import { Button, Card, TextArea, TextInput } from '@/components/ui';

type Reminder = {
  id: string;
  createdAt: number;
  cron: string;
  title: string;
  message: string;
  enabled: boolean;
};

export default function SchedulerPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [cron, setCron] = useState('0 9 * * *');
  const [message, setMessage] = useState('');

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/scheduler');
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <Card
        title="Scheduler (MVP)"
        subtitle="Create/list/run reminders. This MVP stores reminders in memory (resets on deploy). Wire this to your gateway scheduler or a DB for production."
        right={
          <Button variant="outline" onClick={load} disabled={busy}>
            {busy ? 'Loading…' : 'Refresh'}
          </Button>
        }
      >
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </Card>

      <Card title="Create reminder" subtitle="cron is stored as a string in MVP (not parsed).">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs text-slate-400">Title</div>
              <div className="mt-1">
                <TextInput value={title} onChange={setTitle} placeholder="Daily check-in" />
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Cron</div>
              <div className="mt-1">
                <TextInput value={cron} onChange={setCron} placeholder="0 9 * * *" />
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Message</div>
            <div className="mt-1">
              <TextArea value={message} onChange={setMessage} placeholder="What should the reminder say?" rows={5} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={create} disabled={busy || !title.trim() || !message.trim() || !cron.trim()}>
              {busy ? 'Saving…' : 'Create'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Reminders" subtitle="Run now triggers a gateway message.">
        <div className="space-y-2">
          {reminders.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-800 bg-black/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{r.title}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">cron: {r.cron}</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm text-[var(--fg)]">{r.message}</div>
                </div>
                <div className="flex shrink-0 gap-2">
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
          {!reminders.length ? <div className="text-sm text-[var(--muted)]">No reminders yet.</div> : null}
        </div>
      </Card>
    </div>
  );
}

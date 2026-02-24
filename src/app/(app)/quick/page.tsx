'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Card, CodeBlock, StatusChip, TextInput, TextArea } from '@/components/ui';
import { useSafeMode } from '@/components/SafeModeClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useDiagnostics } from '@/components/useDiagnostics';

export default function QuickActionsPage() {
  const { enabled: safeMode } = useSafeMode();
  const diag = useDiagnostics();
  const consoleReady = diag.pass('console.env_target');
  const schedulerRunReady = diag.pass('scheduler.run');

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [consoleMsg, setConsoleMsg] = useState('📊 session_status');
  const [runReminderId, setRunReminderId] = useState('');
  const [runConfirmOpen, setRunConfirmOpen] = useState(false);

  const canSendConsole = useMemo(() => !busy && !safeMode && consoleReady && !!consoleMsg.trim(), [busy, safeMode, consoleReady, consoleMsg]);
  const canRunReminder = useMemo(() => !busy && !safeMode && schedulerRunReady && !!runReminderId.trim(), [busy, safeMode, schedulerRunReady, runReminderId]);

  async function call(path: string, init?: RequestInit) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(path, init);
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.message || j?.error || 'Request failed');
      setResult(j);
    } catch (e: any) {
      setError(e?.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title="Quick Actions"
        subtitle="Operator templates for common flows. (Safe Mode blocks mutating actions.)"
        right={<StatusChip tone={busy ? 'warn' : safeMode ? 'warn' : 'info'}>{busy ? 'Working…' : safeMode ? 'Safe Mode' : 'Ready'}</StatusChip>}
      >
        {safeMode ? <Alert variant="warning" title="Safe Mode" message="Read-only mode is enabled; quick actions that mutate state are disabled." /> : null}
        {error ? <Alert variant="error" title="Quick action failed" message={error} /> : null}
      </Card>

      <Card title="Diagnostics" subtitle="Read-only actions.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => call('/api/ops/status', { cache: 'no-store' })} disabled={busy}>
            Get session_status
          </Button>
          <Button variant="outline" onClick={() => call('/api/ops/diag', { cache: 'no-store' })} disabled={busy}>
            Run diag
          </Button>
          <Button variant="outline" onClick={() => call('/api/healthwall', { cache: 'no-store' })} disabled={busy}>
            Health Wall snapshot
          </Button>
        </div>
      </Card>

      <Card title="Console template" subtitle="Sends a message (capability-gated).">
        {!consoleReady ? (
          <Alert
            variant="info"
            title="Unavailable in current gateway mode"
            message="Console send requires DEFAULT_MESSAGE_TARGET/OWNER_TARGET to be set (and message tool permissions)."
          />
        ) : null}
        <div className="space-y-3">
          <TextArea value={consoleMsg} onChange={setConsoleMsg} rows={5} />
          <div className="flex justify-end">
            <Button
              onClick={() =>
                call('/api/console/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: consoleMsg.trim() }),
                })
              }
              disabled={!canSendConsole}
            >
              Send console message
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Run reminder by id" subtitle="Executes /api/scheduler/run (capability-gated).">
        {!schedulerRunReady ? (
          <Alert
            variant="info"
            title="Unavailable in current gateway mode"
            message="Scheduler run is disabled because message-send capability is not verified/exposed in this gateway mode."
          />
        ) : null}
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <TextInput value={runReminderId} onChange={setRunReminderId} placeholder="Reminder id…" />
          <Button variant="danger" onClick={() => setRunConfirmOpen(true)} disabled={!canRunReminder}>
            Run now
          </Button>
        </div>
      </Card>

      <Card title="Last result" subtitle="Raw JSON response.">
        <CodeBlock label={busy ? 'WORKING…' : 'RESULT'}>{result ? JSON.stringify(result, null, 2) : '—'}</CodeBlock>
      </Card>

      <ConfirmDialog
        open={runConfirmOpen}
        title="Run reminder now?"
        description="This will send the reminder message immediately via the gateway." 
        confirmText={busy ? 'Running…' : 'Run reminder'}
        danger
        onClose={() => setRunConfirmOpen(false)}
        onConfirm={async () => {
          setRunConfirmOpen(false);
          await call('/api/scheduler/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: runReminderId.trim() }),
          });
        }}
      />
    </div>
  );
}

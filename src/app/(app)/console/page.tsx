'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Card, EmptyState, StatusChip, TextArea } from '@/components/ui';
import { useSafeMode } from '@/components/SafeModeClient';
import { RawJsonPanel } from '@/components/RawJsonPanel';
import { useDiagnostics } from '@/components/useDiagnostics';

export default function ConsolePage() {
  const { enabled: safeMode } = useSafeMode();
  const diag = useDiagnostics();
  const envTargetOk = diag.pass('console.env_target');

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  const canSend = useMemo(() => message.trim().length > 0 && !busy && !safeMode && envTargetOk, [message, busy, safeMode, envTargetOk]);

  async function send() {
    const text = message.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setShowDiagnostic(false);
    try {
      const res = await fetch('/api/console/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        // Surface anything the server gave us.
        setResult(j);
        const msgParts: string[] = [];
        if (j?.error) msgParts.push(String(j.error));
        if (j?.details?.hint) msgParts.push(String(j.details.hint));
        if (!msgParts.length) msgParts.push(`Send failed (HTTP ${res.status})`);
        setError(msgParts.join('\n'));
        return;
      }
      setResult(j);
      setMessage('');
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || 'Send failed' });
      setError(e?.message || 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title="Console"
        subtitle="Send a message to the main OpenClaw session (server-side gateway call)."
        right={<StatusChip tone={busy ? 'warn' : safeMode ? 'warn' : 'info'}>{busy ? 'Sending…' : safeMode ? 'Safe Mode' : 'Ready'}</StatusChip>}
      >
        {safeMode ? <Alert variant="warning" title="Safe Mode" message="Read-only mode is enabled; sending is blocked server-side." /> : null}
        {!envTargetOk ? (
          <Alert
            variant="info"
            title="Unavailable in current gateway mode"
            message="Console send requires DEFAULT_MESSAGE_TARGET (or OWNER_TARGET) in env. Set it and re-run Diagnostics probes."
          />
        ) : null}
        <div className="space-y-3">
          <TextArea
            value={message}
            onChange={setMessage}
            placeholder="Type a message… (Ctrl/Cmd+Enter to send)"
            rows={7}
            onKeyDown={(e) => {
              const mac = navigator.platform.includes('Mac');
              const accel = mac ? e.metaKey : e.ctrlKey;
              if (accel && e.key === 'Enter') {
                e.preventDefault();
                if (canSend) void send();
              }
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--muted)]">
              Tip: keep messages operational and explicit. The gateway call happens server-side.
            </div>
            <Button onClick={send} disabled={!canSend}>
              {busy ? 'Sending…' : 'Send'}
            </Button>
          </div>

          {error ? <Alert variant="error" title="Send failed" message={error} /> : null}
        </div>
      </Card>

      <Card title="Last send" subtitle="Delivery status. Relay is treated as success; diagnostics are hidden by default.">
        {!result && !busy ? (
          <EmptyState title="No result yet" description="Send a console message to see the server response here." />
        ) : (
          <div className="space-y-3">
            {result?.ok ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="text-sm">
                  Delivery:{' '}
                  <span className="font-medium">
                    {result?.mode === 'relay' ? 'Delivered via relay' : 'Delivered'}
                  </span>
                </div>

                {/* Mobile: keep diagnostics collapsed by default and avoid cramped button rows. */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    onClick={() => setShowDiagnostic((v) => !v)}
                    disabled={!result?.diagnostic}
                    variant="outline"
                  >
                    {showDiagnostic ? 'Hide diagnostics' : 'Show diagnostics'}
                  </Button>
                </div>
              </div>
            ) : null}

            {result?.ok && result?.mode === 'relay' ? (
              <Alert
                variant="success"
                title="Delivered via relay"
                message="Direct message delivery is unavailable in this deployment; the request was successfully relayed to the main assistant session."
              />
            ) : null}

            <RawJsonPanel
              data={result?.result ?? result}
              label={busy ? 'WORKING…' : result?.ok ? 'RESULT' : 'ERROR'}
              filename="console-result.json"
              emptyText={busy ? '…' : '—'}
            />

            {showDiagnostic ? (
              <RawJsonPanel
                data={{ note: result?.note, diagnostic: result?.diagnostic }}
                label="DIAGNOSTICS"
                filename="console-diagnostics.json"
                emptyText="—"
              />
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

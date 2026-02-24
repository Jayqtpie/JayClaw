'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Card, CodeBlock, EmptyState, StatusChip, TextArea } from '@/components/ui';
import { useSafeMode } from '@/components/SafeModeClient';

export default function ConsolePage() {
  const { enabled: safeMode } = useSafeMode();

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(() => message.trim().length > 0 && !busy && !safeMode, [message, busy, safeMode]);

  async function send() {
    const text = message.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/console/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setError(j?.error || 'Send failed');
        return;
      }
      setResult(j?.result ?? j);
      setMessage('');
    } catch (e: any) {
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

      <Card title="Last result" subtitle="Raw gateway response.">
        {!result && !busy ? (
          <EmptyState title="No result yet" description="Send a console message to see the gateway response here." />
        ) : (
          <CodeBlock label={busy ? 'WORKING…' : 'RESULT'}>{result ? JSON.stringify(result, null, 2) : '…'}</CodeBlock>
        )}
      </Card>
    </div>
  );
}

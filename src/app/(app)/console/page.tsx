'use client';

import { useState } from 'react';
import { Button, Card, TextArea } from '@/components/ui';

export default function ConsolePage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
      <Card title="Console" subtitle="Send a message to the main OpenClaw session (via server-side gateway call).">
        <div className="space-y-3">
          <TextArea value={message} onChange={setMessage} placeholder="Type a message…" rows={6} />
          <div className="flex justify-end">
            <Button onClick={send} disabled={busy || !message.trim()}>
              {busy ? 'Sending…' : 'Send'}
            </Button>
          </div>
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
        </div>
      </Card>

      <Card title="Last result" subtitle="Raw gateway response.">
        <pre className="max-h-[420px] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-[var(--fg)]">
          {result ? JSON.stringify(result, null, 2) : '—'}
        </pre>
      </Card>
    </div>
  );
}

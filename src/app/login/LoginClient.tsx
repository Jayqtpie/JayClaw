'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, TextInput } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/console';

  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => key.trim().length > 0 && !busy, [key, busy]);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as any;
        setError(j?.error || 'Login failed');
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--fg)]">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="flex items-center justify-between rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
          <div>
            <div className="text-xs font-semibold tracking-[0.26em] text-[var(--muted-2)]">JAYCLAW CONTROL CENTER</div>
            <div className="mt-1 text-lg font-semibold">Login</div>
            <p className="mt-2 text-sm text-[var(--muted)]">Enter the APP_ACCESS_KEY to unlock this control panel.</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="mt-6">
          <Card title="Access key" subtitle="Validated on the server; stored only as an httpOnly session cookie.">
            <div className="space-y-3">
              <TextInput value={key} onChange={setKey} placeholder="APP_ACCESS_KEY" type="password" />
              {error ? <div className="text-sm text-red-600">{error}</div> : null}
              <div className="flex justify-end">
                <Button disabled={!canSubmit} onClick={onSubmit}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6 text-xs text-[var(--muted)]">
          Tip: set <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">APP_ACCESS_KEY</code> in your Vercel project.
        </div>
      </div>
    </div>
  );
}

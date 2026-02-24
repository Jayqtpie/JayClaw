'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Card, StatusChip, TextInput } from '@/components/ui';
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
    if (!canSubmit) return;
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
    <div className="min-h-dvh text-[var(--fg)]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            aria-hidden="true"
            style={{
              background:
                'radial-gradient(900px 260px at 18% 0%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 60%), radial-gradient(800px 240px at 88% 10%, color-mix(in oklab, var(--primary-3) 24%, transparent), transparent 60%)',
            }}
          />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-[0.26em] text-[var(--muted-2)]">JAYCLAW CONTROL CENTER</div>
              <div className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Sign in</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Enter the <span className="font-mono">APP_ACCESS_KEY</span> to unlock the control center.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip tone="info">Secure cookie session</StatusChip>
              <ThemeToggle />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Card title="Access key" subtitle="Validated on the server; stored only as an httpOnly session cookie." tone="raised">
            <div className="space-y-3">
              <TextInput
                value={key}
                onChange={setKey}
                placeholder="APP_ACCESS_KEY"
                type="password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void onSubmit();
                  }
                }}
              />

              {error ? <Alert variant="error" title="Login failed" message={error} /> : null}

              <div className="flex justify-end">
                <Button disabled={!canSubmit} onClick={onSubmit}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)] p-4 text-xs text-[var(--muted)] shadow-sm">
          Tip: set <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono">APP_ACCESS_KEY</code> in your deployment
          environment (e.g. Vercel).
        </div>
      </div>
    </div>
  );
}

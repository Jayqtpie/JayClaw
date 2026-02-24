'use client';

import type { ReactNode } from 'react';
import { Button, NavPill, RailItem } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';
import { useRouter } from 'next/navigation';

function Icon({ name }: { name: 'console' | 'agents' | 'ops' | 'sched' | 'mem' }) {
  // Tiny inline SVGs to keep deps minimal
  if (name === 'console')
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 6.5h16M7.5 10.5l2 2-2 2M11.5 14.5h5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (name === 'agents')
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 20v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (name === 'ops')
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  if (name === 'sched')
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 2v3M16 2v3M4 7h16M6 11h4M6 15h4M14 11h4M14 15h4M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5h16v14H4zM8 9h8M8 13h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--fg)]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Top bar */}
        <header className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-[0.26em] text-[var(--muted-2)]">JAYCLAW CONTROL CENTER</div>
            <div className="mt-1 text-lg font-semibold">OpenClaw Gateway</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={logout}>
              Logout
            </Button>
          </div>
        </header>

        {/* Workspace layout */}
        <div className="mt-6 grid gap-6 md:grid-cols-[76px_minmax(0,1fr)]">
          {/* Mini rail */}
          <aside className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow)] md:sticky md:top-6 md:h-fit">
            <div className="flex flex-row gap-2 overflow-auto md:flex-col md:overflow-visible">
              <RailItem href="/console" label="Console" icon={<Icon name="console" />} />
              <RailItem href="/subagents" label="Subagents" icon={<Icon name="agents" />} />
              <RailItem href="/ops" label="Ops" icon={<Icon name="ops" />} />
              <RailItem href="/scheduler" label="Scheduler" icon={<Icon name="sched" />} />
              <RailItem href="/memory" label="Memory" icon={<Icon name="mem" />} />
            </div>
          </aside>

          <div className="space-y-6">
            {/* Secondary nav (pills) */}
            <nav className="flex flex-wrap gap-2" aria-label="Workspace">
              <NavPill href="/console">Console</NavPill>
              <NavPill href="/subagents">Subagents</NavPill>
              <NavPill href="/ops">Ops</NavPill>
              <NavPill href="/scheduler">Scheduler</NavPill>
              <NavPill href="/memory">Memory</NavPill>
            </nav>

            <main>{children}</main>

            <footer className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs text-[var(--muted)] shadow-[var(--shadow)]">
              Gateway token stays server-side. Browser calls Next.js API routes only.
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

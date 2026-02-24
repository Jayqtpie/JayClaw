'use client';

import type { ReactNode } from 'react';
import { Button, NavPill, RailItem, StatusChip } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';
import CommandPalette, { type CommandItem } from '@/components/CommandPalette';
import { useOpsStatus } from '@/lib/useOpsStatus';
import { useRouter } from 'next/navigation';
import { SafeModeProvider } from '@/components/SafeModeClient';
import TopSafetyControls from '@/components/TopSafetyControls';

function Icon({ name }: { name: 'console' | 'agents' | 'ops' | 'sched' | 'mem' | 'spark' | 'search' | 'health' | 'audit' | 'quick' }) {
  // Tiny inline SVGs to keep deps minimal
  if (name === 'search')
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M16.2 16.2 21 21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  if (name === 'spark')
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2l1.5 6.2L20 10l-6.5 1.8L12 18l-1.5-6.2L4 10l6.5-1.8L12 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );

  if (name === 'health')
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 13.5 9.2 13.5 11 6.5 13 17.5 14.8 10.5 20 10.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 4h16v16H4z"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.25"
        />
      </svg>
    );

  if (name === 'audit')
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 4h10v16H7z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M9 8h6M9 12h6M9 16h4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );

  if (name === 'quick')
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3v6l4 2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );

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
  const ops = useOpsStatus({ refreshMs: 30000 });

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const statusTone = ops.loading ? 'idle' : ops.data?.ok ? 'ok' : 'bad';
  const statusText = ops.loading
    ? 'Gateway: checking…'
    : ops.data?.ok
      ? 'Gateway: online'
      : `Gateway: offline`;

  const paletteItems: CommandItem[] = [
    { id: 'nav-console', label: 'Console', hint: 'Send a message to the main session', group: 'Navigate', href: '/console', keywords: ['message', 'send'] },
    { id: 'nav-subagents', label: 'Subagents', hint: 'List / spawn / steer', group: 'Navigate', href: '/subagents', keywords: ['agents', 'spawn'] },
    { id: 'nav-ops', label: 'Ops', hint: 'Status + restart + diagnostics', group: 'Navigate', href: '/ops', keywords: ['status', 'restart'] },
    { id: 'nav-scheduler', label: 'Scheduler', hint: 'List + run scheduled tasks', group: 'Navigate', href: '/scheduler', keywords: ['jobs', 'cron'] },
    { id: 'nav-memory', label: 'Memory', hint: 'Search + fetch memories', group: 'Navigate', href: '/memory', keywords: ['search', 'notes'] },
    { id: 'nav-health', label: 'Health Wall', hint: 'Gateway health + token + SSL + recent failures', group: 'Navigate', href: '/health', keywords: ['health', 'ssl', 'diag'] },
    { id: 'nav-audit', label: 'Audit Trail', hint: 'Recent actions + outcomes', group: 'Navigate', href: '/audit', keywords: ['audit', 'logs'] },
    { id: 'nav-quick', label: 'Quick Actions', hint: 'Common operator flows', group: 'Navigate', href: '/quick', keywords: ['templates', 'macros'] },

    {
      id: 'act-theme',
      label: 'Toggle theme',
      hint: 'Switch between light and dark',
      group: 'Actions',
      action: () => {
        window.dispatchEvent(new Event('jc:toggle-theme'));
      },
      keywords: ['dark', 'light'],
      shortcut: 'T',
    },
    {
      id: 'act-refresh-status',
      label: 'Refresh gateway status',
      hint: 'Re-check session_status',
      group: 'Diagnostics',
      action: () => ops.refresh(),
      keywords: ['ping', 'health'],
    },
    {
      id: 'act-logout',
      label: 'Logout',
      hint: 'End session (server-side cookie)',
      group: 'Account',
      action: logout,
      keywords: ['sign out'],
    },
  ];

  return (
    <SafeModeProvider>
      <div className="min-h-dvh text-[var(--fg)]">
      <div className="mx-auto max-w-[1280px] px-4 py-6">
        {/* Top bar */}
        <header className="relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            aria-hidden="true"
            style={{
              background:
                'radial-gradient(900px 240px at 16% 0%, color-mix(in oklab, var(--primary) 26%, transparent), transparent 60%), radial-gradient(780px 240px at 86% 10%, color-mix(in oklab, var(--primary-3) 22%, transparent), transparent 60%)',
            }}
          />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,var(--primary)_0%,var(--primary-3)_100%)] text-[var(--primary-fg)] shadow-sm">
                  <span className="h-5 w-5">
                    <Icon name="spark" />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold tracking-[0.26em] text-[var(--muted-2)]">JAYCLAW CONTROL CENTER</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <div className="text-lg font-semibold tracking-[-0.02em]">Gateway Command Deck</div>
                    <StatusChip tone={statusTone} title={ops.data?.error ?? undefined}>
                      {statusText}
                    </StatusChip>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Premium operator UI. All browser actions call Next.js API routes only; gateway token stays server-side.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <TopSafetyControls />
              <CommandPalette items={paletteItems} />
              <ThemeToggle />
              <Button variant="outline" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* Workspace layout */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[96px_minmax(0,1fr)]">
          {/* Rail */}
          <aside className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow)] backdrop-blur-xl lg:sticky lg:top-6 lg:h-fit">
            <div className="flex flex-row gap-2 overflow-auto lg:flex-col lg:overflow-visible">
              <RailItem href="/console" label="Console" icon={<Icon name="console" />} />
              <RailItem href="/subagents" label="Subagents" icon={<Icon name="agents" />} />
              <RailItem href="/ops" label="Ops" icon={<Icon name="ops" />} />
              <RailItem href="/scheduler" label="Scheduler" icon={<Icon name="sched" />} />
              <RailItem href="/memory" label="Memory" icon={<Icon name="mem" />} />
              <RailItem href="/health" label="Health" icon={<Icon name="health" />} />
              <RailItem href="/audit" label="Audit" icon={<Icon name="audit" />} />
              <RailItem href="/quick" label="Quick" icon={<Icon name="quick" />} />
            </div>

            <div className="mt-2 hidden rounded-[22px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)] p-3 text-xs text-[var(--muted)] shadow-sm lg:block">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 text-[var(--muted-2)]">
                  <Icon name="search" />
                </span>
                <span className="font-semibold">Tip</span>
              </div>
              <div className="mt-1">Press Ctrl/Cmd+K to jump pages & run actions.</div>
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
              <NavPill href="/health">Health</NavPill>
              <NavPill href="/audit">Audit</NavPill>
              <NavPill href="/quick">Quick</NavPill>
            </nav>

            <main className="space-y-6">{children}</main>

            <footer className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 text-xs text-[var(--muted)] shadow-[var(--shadow)] backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Gateway token stays server-side. Browser calls Next.js API routes only.</span>
                <span className="text-[var(--muted-2)]">JayClaw v0.1</span>
              </div>
            </footer>
          </div>
        </div>
      </div>
      </div>
    </SafeModeProvider>
  );
}

'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { Button, RailItem, StatusChip } from '@/components/ui';
import dynamic from 'next/dynamic';
import ThemeToggle from '@/components/ThemeToggle';
import { type CommandItem } from '@/components/CommandPalette';

const CommandPalette = dynamic(() => import('@/components/CommandPalette'), {
  ssr: false,
  loading: () => (
    <button
      type="button"
      className="inline-flex min-w-[240px] items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_70%,transparent)] px-3 py-2 text-left text-sm text-[var(--muted)] shadow-sm"
      aria-label="Command palette loading"
      disabled
    >
      <span className="truncate">Search commands…</span>
      <span className="text-xs">…</span>
    </button>
  ),
});
import { useOpsStatus } from '@/lib/useOpsStatus';
import { useRouter } from 'next/navigation';
import { SafeModeProvider } from '@/components/SafeModeClient';
import { LowPowerModeProvider } from '@/components/LowPowerModeClient';
import TopSafetyControls from '@/components/TopSafetyControls';

function Icon({ name }: { name: 'chat' | 'console' | 'agents' | 'ops' | 'sched' | 'mem' | 'spark' | 'search' | 'health' | 'audit' | 'quick' }) {
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

  if (name === 'chat')
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 6.5A4.5 4.5 0 0 1 9.5 2h5A4.5 4.5 0 0 1 19 6.5V12a4.5 4.5 0 0 1-4.5 4.5H11l-4.3 3a.75.75 0 0 1-1.2-.61V16.5A4.5 4.5 0 0 1 5 12V6.5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M8 7.75h8M8 11h6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
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

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }, [router]);

  const statusTone = ops.loading ? 'idle' : ops.data?.ok ? 'ok' : 'bad';
  const statusText = ops.loading ? 'LINKING…' : ops.data?.ok ? 'ONLINE' : 'OFFLINE';

  const paletteItems: CommandItem[] = useMemo(
    () => [
      { id: 'nav-chat', label: 'Chat', hint: 'Native dashboard chat (assistant replies)', group: 'Navigate', href: '/chat', keywords: ['assistant', 'talk'] },
      { id: 'nav-console', label: 'Console', hint: 'Message routing / outbound sends', group: 'Navigate', href: '/console', keywords: ['message', 'send'] },
      { id: 'nav-subagents', label: 'Subagents', hint: 'List / spawn / steer', group: 'Navigate', href: '/subagents', keywords: ['agents', 'spawn'] },
      { id: 'nav-ops', label: 'Ops', hint: 'Status + restart + diagnostics', group: 'Navigate', href: '/ops', keywords: ['status', 'restart'] },
      { id: 'nav-scheduler', label: 'Scheduler', hint: 'List + run scheduled tasks', group: 'Navigate', href: '/scheduler', keywords: ['jobs', 'cron'] },
      { id: 'nav-health', label: 'Health Wall', hint: 'Gateway health + token + SSL', group: 'Navigate', href: '/health', keywords: ['health', 'ssl', 'diag'] },
      { id: 'nav-audit', label: 'Audit Trail', hint: 'Recent actions + outcomes', group: 'Navigate', href: '/audit', keywords: ['audit', 'logs'] },
      { id: 'nav-memory', label: 'Memory', hint: 'Search + fetch memories', group: 'Navigate', href: '/memory', keywords: ['search', 'notes'] },
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
        id: 'act-low-power',
        label: 'Toggle low power mode',
        hint: 'Reduce visual FX for smoother scrolling',
        group: 'Actions',
        action: () => {
          window.dispatchEvent(new Event('jc:toggle-low-power'));
        },
        keywords: ['perf', 'performance', 'jank', 'effects'],
        shortcut: 'P',
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
    ],
    [logout, ops.refresh]
  );

  const fxEnabled = process.env.NEXT_PUBLIC_JC_FX === '1';

  useEffect(() => {
    // FX mode is opt-in (NEXT_PUBLIC_JC_FX=1). Default: off for smooth scroll + route transitions.
    const root = document.documentElement;
    if (fxEnabled) root.dataset.jcFx = '1';
    else delete root.dataset.jcFx;
    return () => {
      delete root.dataset.jcFx;
    };
  }, [fxEnabled]);

  useEffect(() => {
    // Optional: force a lighter visual mode for low-power devices / remote sessions.
    // Set NEXT_PUBLIC_JC_PERF_MODE=1
    if (process.env.NEXT_PUBLIC_JC_PERF_MODE === '1') {
      document.documentElement.classList.add('jc-perf');
      return () => document.documentElement.classList.remove('jc-perf');
    }
    return;
  }, []);

  useEffect(() => {
    if (!fxEnabled) return;

    // Perf (FX-only): pause heavy backdrop motion while scrolling (especially on low/medium devices).
    let raf = 0;
    let t: any = null;
    const root = document.documentElement;

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        root.classList.add('jc-scrolling');
        if (t) window.clearTimeout(t);
        t = window.setTimeout(() => root.classList.remove('jc-scrolling'), 160);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
      if (t) window.clearTimeout(t);
      root.classList.remove('jc-scrolling');
    };
  }, [fxEnabled]);

  return (
    <SafeModeProvider>
      <LowPowerModeProvider>
        <div className="min-h-dvh text-[var(--fg)]">
        {/* Full-bleed flagship backdrop (FX mode only) */}
        {fxEnabled ? <div className="jc-vortex" aria-hidden="true" /> : null}

        <div className="relative mx-auto max-w-[1440px] px-3 pt-4 pb-28 sm:px-4 sm:pt-5 md:px-6 md:pt-6 lg:pb-6">
          {/* HUD bar */}
          <header className="jc-hud">
            <div className="jc-hud__left">
              <div className="jc-sigil" aria-hidden="true">
                <span className="h-5 w-5">
                  <Icon name="spark" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="jc-eyebrow">JAYCLAW • FLAGSHIP DECK</div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="jc-title">CONTROL CENTER</div>
                  <StatusChip tone={statusTone} title={ops.data?.error ?? undefined}>
                    GATEWAY {statusText}
                  </StatusChip>
                </div>
              </div>
            </div>

            <div className="jc-hud__right">
              <TopSafetyControls />
              <CommandPalette items={paletteItems} />
              <ThemeToggle />
              <Button variant="outline" onClick={logout}>
                Logout
              </Button>
            </div>
          </header>

          {/* Shell grid: Dock + Stage */}
          <div className="mt-4 grid gap-4 lg:mt-5 lg:gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* Dock */}
            <aside className="jc-dock hidden lg:block" aria-label="Primary">
              <div className="jc-dock__section">
                <div className="jc-dock__label">LIVE</div>
                <div className="jc-dock__grid">
                  <RailItem href="/chat" label="Chat" icon={<Icon name="chat" />} />
                  <RailItem href="/console" label="Console" icon={<Icon name="console" />} />
                </div>
              </div>

              <div className="jc-dock__section">
                <div className="jc-dock__label">ORCHESTRATE</div>
                <div className="jc-dock__grid">
                  <RailItem href="/subagents" label="Subagents" icon={<Icon name="agents" />} />
                  <RailItem href="/scheduler" label="Scheduler" icon={<Icon name="sched" />} />
                  <RailItem href="/quick" label="Quick" icon={<Icon name="quick" />} />
                </div>
              </div>

              <div className="jc-dock__section">
                <div className="jc-dock__label">OBSERVE</div>
                <div className="jc-dock__grid">
                  <RailItem href="/ops" label="Ops" icon={<Icon name="ops" />} />
                  <RailItem href="/health" label="Health" icon={<Icon name="health" />} />
                  <RailItem href="/audit" label="Audit" icon={<Icon name="audit" />} />
                </div>
              </div>

              <div className="jc-dock__section">
                <div className="jc-dock__label">KNOW</div>
                <div className="jc-dock__grid">
                  <RailItem href="/memory" label="Memory" icon={<Icon name="mem" />} />
                </div>
              </div>

              <div className="jc-dock__tip">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 text-[var(--muted-2)]">
                    <Icon name="search" />
                  </span>
                  <span className="font-semibold">Command</span>
                </div>
                <div className="mt-1">Ctrl/Cmd+K → jump modules & execute actions.</div>
              </div>
            </aside>

            {/* Stage */}
            <div className="jc-stage">
              <main className="jc-stage__main">{children}</main>

              <footer className="jc-footer">
                <span>All browser actions hit Next.js API routes only. Gateway token stays server-side.</span>
                <span className="text-[var(--muted-2)]">JayClaw Flagship</span>
              </footer>
            </div>
          </div>

          {/* Mobile bottom nav */}
          <nav className="jc-bottom" aria-label="Bottom navigation">
            <RailItem href="/chat" label="Chat" icon={<Icon name="chat" />} />
            <RailItem href="/console" label="Console" icon={<Icon name="console" />} />
            <RailItem href="/subagents" label="Subagents" icon={<Icon name="agents" />} />
            <RailItem href="/ops" label="Ops" icon={<Icon name="ops" />} />
            <RailItem href="/memory" label="Memory" icon={<Icon name="mem" />} />
          </nav>
        </div>
      </div>
      </LowPowerModeProvider>
    </SafeModeProvider>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Kbd } from '@/components/ui';

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  keywords?: string[];
  shortcut?: string; // display only
  href?: string;
  action?: () => void | Promise<void>;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function isMac() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export default function CommandPalette({ items }: { items: CommandItem[] }) {
  const router = useRouter();
  const pathname = usePathname();

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = items
      .filter((it) => {
        if (!query) return true;
        const hay = `${it.label} ${it.hint ?? ''} ${(it.keywords ?? []).join(' ')}`.toLowerCase();
        return hay.includes(query);
      })
      // keep current route near top
      .sort((a, b) => {
        const aOn = a.href && pathname === a.href;
        const bOn = b.href && pathname === b.href;
        if (aOn && !bOn) return -1;
        if (bOn && !aOn) return 1;
        return a.label.localeCompare(b.label);
      });

    // group into a stable order
    const groups = new Map<string, CommandItem[]>();
    for (const it of base) {
      const g = it.group || 'General';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(it);
    }

    const orderedGroups = ['Navigate', 'Actions', 'General', 'Diagnostics', 'Account'];
    const result: Array<{ group: string; items: CommandItem[] }> = [];

    for (const g of orderedGroups) {
      if (groups.has(g)) result.push({ group: g, items: groups.get(g)! });
      groups.delete(g);
    }
    for (const [g, its] of groups.entries()) result.push({ group: g, items: its });

    return result;
  }, [items, pathname, q]);

  const flat = useMemo(() => filtered.flatMap((g) => g.items), [filtered]);

  function show() {
    setOpen(true);
    setQ('');
    setActive(0);
    dialogRef.current?.showModal();
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function hide() {
    setOpen(false);
    setQ('');
    setActive(0);
    dialogRef.current?.close();
  }

  async function run(item: CommandItem | undefined) {
    if (!item) return;
    hide();
    if (item.href) {
      router.push(item.href);
      return;
    }
    await item.action?.();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mac = isMac();
      const cmdK = mac ? e.metaKey && e.key.toLowerCase() === 'k' : e.ctrlKey && e.key.toLowerCase() === 'k';
      if (cmdK) {
        e.preventDefault();
        if (!open) show();
        else hide();
      }
      if (open && e.key === 'Escape') {
        e.preventDefault();
        hide();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    // close on route change
    hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="group inline-flex min-w-[240px] items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_70%,transparent)] px-3 py-2 text-left text-sm text-[var(--muted)] shadow-sm transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        aria-label="Open command palette"
      >
        <span className="truncate">Search commands…</span>
        <span className="flex items-center gap-1">
          <Kbd>{isMac() ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className="w-[min(860px,calc(100vw-24px))] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_72%,transparent)] p-0 text-[var(--fg)] shadow-[var(--shadow-lg)] backdrop:bg-black/30 backdrop:backdrop-blur-sm"
        onClose={() => setOpen(false)}
      >
        <div className="border-b border-[var(--border)] p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-[14px] bg-[linear-gradient(135deg,var(--primary)_0%,var(--primary-3)_100%)] shadow-sm" aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-[0.22em] text-[var(--muted-2)]">COMMAND PALETTE</div>
              <div className="text-sm font-semibold tracking-[-0.01em]">Jump anywhere. Run actions instantly.</div>
            </div>
          </div>
          <div className="mt-4">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((v) => Math.min(v + 1, Math.max(0, flat.length - 1)));
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((v) => Math.max(0, v - 1));
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void run(flat[active]);
                }
              }}
              placeholder="Type to search…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_65%,transparent)] px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
          </div>
        </div>

        <div className="max-h-[52vh] overflow-auto p-2">
          {flat.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-sm font-semibold">No matches</div>
              <div className="mt-1 text-sm text-[var(--muted)]">Try a different query (e.g. “restart”, “memory”, “ops”).</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((g) => (
                <div key={g.group}>
                  <div className="px-3 py-2 text-xs font-semibold tracking-[0.22em] text-[var(--muted-2)]">{g.group.toUpperCase()}</div>
                  <div className="space-y-1">
                    {g.items.map((it) => {
                      const idx = flat.findIndex((x) => x.id === it.id);
                      const selected = idx === active;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          className={cx(
                            'flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                            selected
                              ? 'bg-[color-mix(in_oklab,var(--primary)_12%,var(--surface-solid))] text-[var(--fg)]'
                              : 'hover:bg-[color-mix(in_oklab,var(--surface-solid)_58%,transparent)] text-[var(--fg)]'
                          )}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => void run(it)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{it.label}</span>
                            {it.hint ? <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{it.hint}</span> : null}
                          </span>
                          {it.shortcut ? (
                            <span className="shrink-0 text-xs text-[var(--muted-2)]">{it.shortcut}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-2)_70%,transparent)] px-4 py-3 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <span>Navigate</span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span className="ml-2">Run</span>
            <Kbd>Enter</Kbd>
          </div>
          <div className="flex items-center gap-2">
            <span>Close</span>
            <Kbd>Esc</Kbd>
          </div>
        </div>
      </dialog>
    </>
  );
}

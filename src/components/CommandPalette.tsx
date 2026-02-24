'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
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

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const MAX_VISIBLE_ITEMS = 80;

export default function CommandPalette({ items }: { items: CommandItem[] }) {
  const router = useRouter();
  const pathname = usePathname();

  const titleId = useId();
  const descId = useId();

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const [open, setOpen] = useState(false);
  const [qRaw, setQRaw] = useState('');
  const q = useDebouncedValue(qRaw, 120);
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
      })
      .slice(0, MAX_VISIBLE_ITEMS);

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

  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < flat.length; i++) m.set(flat[i]!.id, i);
    return m;
  }, [flat]);

  function show() {
    setOpen(true);
    setQRaw('');
    setActive(0);
    document.documentElement.classList.add('jc-modal-open');
    dialogRef.current?.showModal();
    // next tick so the dialog is actually visible before focusing
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function hide() {
    setOpen(false);
    setQRaw('');
    setActive(0);
    document.documentElement.classList.remove('jc-modal-open');
    dialogRef.current?.close();
    requestAnimationFrame(() => triggerRef.current?.focus());
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

  useEffect(() => {
    // safety: if the dialog gets closed by browser UI, keep state consistent
    function onClose() {
      setOpen(false);
      document.documentElement.classList.remove('jc-modal-open');
    }
    const el = dialogRef.current;
    if (!el) return;
    el.addEventListener('close', onClose);
    return () => el.removeEventListener('close', onClose);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={show}
        className="group inline-flex min-w-[240px] items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_70%,transparent)] px-3 py-2 text-left text-sm text-[var(--muted)] shadow-sm transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="jc-command-palette"
        aria-label="Open command palette"
      >
        <span className="truncate">Search commands…</span>
        <span className="flex items-center gap-1">
          <Kbd>{isMac() ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <dialog
        id="jc-command-palette"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-[min(860px,calc(100vw-24px))] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_72%,transparent)] p-0 text-[var(--fg)] shadow-[var(--shadow-lg)] backdrop:bg-black/35"
        onCancel={(e) => {
          // keep ESC behavior but route through our close so we can restore focus/class.
          e.preventDefault();
          hide();
        }}
        onMouseDown={(e) => {
          // Click outside closes (backdrop click). In <dialog>, backdrop clicks land on the dialog element.
          if (e.target === dialogRef.current) hide();
        }}
      >
        <div className="relative border-b border-[var(--border)] p-4">
          <button
            type="button"
            onClick={hide}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_66%,transparent)] text-[var(--muted)] shadow-sm transition hover:bg-[var(--surface-2)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Close command palette"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </button>

          <div className="flex items-center gap-3 pr-12">
            <div
              className="h-9 w-9 rounded-[14px] bg-[linear-gradient(135deg,var(--primary)_0%,var(--primary-3)_100%)] shadow-sm"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-[0.22em] text-[var(--muted-2)]" id={titleId}>
                COMMAND PALETTE
              </div>
              <div className="text-sm font-semibold tracking-[-0.01em]" id={descId}>
                Jump anywhere. Run actions instantly.
              </div>
            </div>
          </div>
          <div className="mt-4">
            <input
              ref={inputRef}
              value={qRaw}
              onChange={(e) => {
                setQRaw(e.target.value);
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
                      const idx = indexById.get(it.id) ?? 0;
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
                          {it.shortcut ? <span className="shrink-0 text-xs text-[var(--muted-2)]">{it.shortcut}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {items.length > MAX_VISIBLE_ITEMS ? (
                <div className="px-3 pb-3 text-xs text-[var(--muted-2)]">
                  Showing first {MAX_VISIBLE_ITEMS} results. Refine your search to narrow further.
                </div>
              ) : null}
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

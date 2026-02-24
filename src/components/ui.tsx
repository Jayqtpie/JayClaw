'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type,
}: {
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
}) {
  const base =
    'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60 disabled:cursor-not-allowed';
  const styles =
    variant === 'primary'
      ? 'bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-2)]'
      : variant === 'danger'
        ? 'bg-[var(--danger)] text-[var(--danger-fg)] hover:brightness-95'
        : variant === 'outline'
          ? 'border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-2)]'
          : 'text-[var(--fg)] hover:bg-[var(--surface-2)]';

  return (
    <button type={type ?? 'button'} className={`${base} ${styles}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--muted-2)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      value={value}
      type={type ?? 'text'}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--muted-2)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      value={value}
      placeholder={placeholder}
      rows={rows ?? 6}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--fg)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p> : null}
        </div>
        {right}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function NavPill({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
        active
          ? 'bg-[var(--surface)] text-[var(--fg)] shadow-sm border border-[var(--border)]'
          : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)]'
      }`}
    >
      {children}
    </Link>
  );
}

export function RailItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`group flex items-center justify-center rounded-2xl p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
        active ? 'bg-[var(--primary)] text-[var(--primary-fg)]' : 'bg-transparent text-[var(--muted)] hover:bg-[var(--surface-2)]'
      }`}
      aria-label={label}
      title={label}
    >
      <span className="h-5 w-5">{icon}</span>
    </Link>
  );
}

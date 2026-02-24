'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode, KeyboardEventHandler } from 'react';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--muted)] shadow-sm">
      {children}
    </kbd>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type,
  leftIcon,
  rightIcon,
}: {
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}) {
  const base =
    'group inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 py-2 text-sm font-medium transition will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-solid)] disabled:cursor-not-allowed';

  const styles =
    variant === 'primary'
      ? 'bg-[linear-gradient(180deg,var(--primary)_0%,var(--primary-2)_100%)] text-[var(--primary-fg)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow)] hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:saturate-0 disabled:shadow-none'
      : variant === 'danger'
        ? 'bg-[linear-gradient(180deg,var(--danger)_0%,color-mix(in_oklab,var(--danger)_86%,black)_100%)] text-[var(--danger-fg)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow)] hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:saturate-0 disabled:shadow-none'
        : variant === 'outline'
          ? 'border border-[var(--border-strong)] bg-[color-mix(in_oklab,var(--surface-solid)_88%,transparent)] text-[var(--fg)] shadow-sm hover:bg-[color-mix(in_oklab,var(--surface-solid)_82%,var(--primary-3)_8%)] hover:border-[color-mix(in_oklab,var(--primary)_22%,var(--border-strong))] hover:-translate-y-[1px] active:translate-y-0 disabled:bg-[color-mix(in_oklab,var(--surface-solid)_82%,transparent)] disabled:text-[var(--muted-2)] disabled:border-[var(--border)] disabled:shadow-none'
          : 'text-[var(--fg)] hover:bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)] disabled:text-[var(--muted-2)] disabled:bg-transparent';

  return (
    <button type={type ?? 'button'} className={cx(base, styles)} onClick={onClick} disabled={disabled}>
      {leftIcon ? <span className="h-4 w-4 opacity-90">{leftIcon}</span> : null}
      <span className="truncate">{children}</span>
      {rightIcon ? <span className="h-4 w-4 opacity-80">{rightIcon}</span> : null}
    </button>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[color-mix(in_oklab,var(--surface-solid)_88%,transparent)] text-[var(--fg)] shadow-sm transition hover:bg-[color-mix(in_oklab,var(--surface-solid)_82%,var(--primary-3)_8%)] hover:border-[color-mix(in_oklab,var(--primary)_22%,var(--border-strong))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-solid)] disabled:bg-[color-mix(in_oklab,var(--surface-solid)_82%,transparent)] disabled:text-[var(--muted-2)] disabled:border-[var(--border)] disabled:shadow-none disabled:cursor-not-allowed"
      aria-label={label}
      title={label}
    >
      <span className="h-5 w-5">{children}</span>
    </button>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}) {
  return (
    <input
      className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_65%,transparent)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--muted-2)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      value={value}
      type={type ?? 'text'}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_65%,transparent)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--muted-2)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      value={value}
      placeholder={placeholder}
      rows={rows ?? 6}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Alert({
  title,
  message,
  variant = 'info',
  right,
}: {
  title?: string;
  message: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
  right?: ReactNode;
}) {
  const tone =
    variant === 'success'
      ? 'border-[color-mix(in_oklab,var(--success)_45%,var(--border))] bg-[color-mix(in_oklab,var(--success)_9%,var(--surface-solid))]'
      : variant === 'warning'
        ? 'border-[color-mix(in_oklab,var(--warning)_45%,var(--border))] bg-[color-mix(in_oklab,var(--warning)_10%,var(--surface-solid))]'
        : variant === 'error'
          ? 'border-[color-mix(in_oklab,var(--danger)_45%,var(--border))] bg-[color-mix(in_oklab,var(--danger)_9%,var(--surface-solid))]'
          : 'border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_55%,transparent)]';

  return (
    <div className={cx('flex items-start justify-between gap-3 rounded-[var(--radius-md)] border p-4 shadow-sm', tone)} role={variant === 'error' ? 'alert' : 'status'}>
      <div className="min-w-0">
        {title ? <div className="text-sm font-semibold text-[var(--fg)]">{title}</div> : null}
        <div className={cx('text-sm', title ? 'mt-1 text-[var(--muted)]' : 'text-[var(--muted)]')}>{message}</div>
      </div>
      {right}
    </div>
  );
}

export function StatusChip({
  tone,
  children,
  title,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'info' | 'idle';
  children: ReactNode;
  title?: string;
}) {
  const c =
    tone === 'ok'
      ? 'bg-[color-mix(in_oklab,var(--success)_16%,var(--surface-solid))] text-[color-mix(in_oklab,var(--success)_70%,var(--fg))] border-[color-mix(in_oklab,var(--success)_40%,var(--border))]'
      : tone === 'warn'
        ? 'bg-[color-mix(in_oklab,var(--warning)_16%,var(--surface-solid))] text-[color-mix(in_oklab,var(--warning)_85%,var(--fg))] border-[color-mix(in_oklab,var(--warning)_40%,var(--border))]'
        : tone === 'bad'
          ? 'bg-[color-mix(in_oklab,var(--danger)_14%,var(--surface-solid))] text-[color-mix(in_oklab,var(--danger)_78%,var(--fg))] border-[color-mix(in_oklab,var(--danger)_38%,var(--border))]'
          : tone === 'info'
            ? 'bg-[color-mix(in_oklab,var(--primary)_14%,var(--surface-solid))] text-[color-mix(in_oklab,var(--primary)_82%,var(--fg))] border-[color-mix(in_oklab,var(--primary)_34%,var(--border))]'
            : 'bg-[color-mix(in_oklab,var(--surface-2)_65%,transparent)] text-[var(--muted)] border-[var(--border)]';

  const dot =
    tone === 'ok'
      ? 'bg-[var(--success)]'
      : tone === 'warn'
        ? 'bg-[var(--warning)]'
        : tone === 'bad'
          ? 'bg-[var(--danger)]'
          : tone === 'info'
            ? 'bg-[var(--primary)]'
            : 'bg-[var(--muted-2)]';

  return (
    <span title={title} className={cx('inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shadow-sm sm:px-3 sm:py-1 sm:text-xs', c)}>
      <span className={cx('h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2', dot)} aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('jc-skeleton rounded-[var(--radius-sm)]', className)} aria-hidden="true" />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_62%,transparent)] p-8 text-center shadow-sm">
      <div className="mx-auto max-w-md">
        <div className="text-base font-semibold tracking-[-0.01em]">{title}</div>
        {description ? <p className="mt-2 text-sm text-[var(--muted)]">{description}</p> : null}
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

export function CodeBlock({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="relative min-w-0">
      {label ? (
        <div className="mb-2 text-xs font-semibold tracking-[0.18em] text-[var(--muted-2)]">{label}</div>
      ) : null}
      <pre className="w-full max-w-full min-w-0 max-h-[560px] overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--code)_92%,black)] p-4 text-xs text-[var(--code-fg)] shadow-sm">
        {children}
      </pre>
    </div>
  );
}

export function Card({
  title,
  subtitle,
  right,
  children,
  tone = 'default',
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'raised';
}) {
  return (
    <section
      className={cx(
        'min-w-0 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]',
        tone === 'raised' && 'shadow-[var(--shadow-lg)]'
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--fg)] tracking-[-0.01em]">{title}</h2>
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
      className={cx(
        'rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        active
          ? 'bg-[color-mix(in_oklab,var(--surface-solid)_65%,transparent)] text-[var(--fg)] shadow-sm border border-[var(--border)]'
          : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[color-mix(in_oklab,var(--surface-solid)_55%,transparent)]'
      )}
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
      className={cx(
        'group relative flex flex-col items-center justify-center gap-1 rounded-[22px] border px-2.5 py-2.5 text-center transition will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:px-3 sm:py-3',
        active
          ? 'border-[color-mix(in_oklab,var(--primary)_40%,var(--border))] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_40%,var(--surface-solid)),color-mix(in_oklab,var(--primary-3)_28%,var(--surface-solid)))] text-[var(--fg)] shadow-[var(--shadow)]'
          : 'border-[color-mix(in_oklab,var(--border)_75%,transparent)] bg-[color-mix(in_oklab,var(--surface-solid)_40%,transparent)] text-[var(--muted)] shadow-sm hover:-translate-y-[1px] hover:bg-[color-mix(in_oklab,var(--surface-solid)_56%,transparent)]'
      )}
      aria-label={label}
      title={label}
    >
      <span className={cx('h-5 w-5 transition', active ? '' : 'group-hover:scale-[1.06]')}>{icon}</span>
      <span className={cx('text-[10px] font-semibold tracking-[-0.01em] sm:text-[11px]', active ? 'text-[var(--fg)]' : 'text-[var(--muted)]')}>
        {label}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute -inset-px rounded-[22px] opacity-0 blur-[10px] transition-opacity duration-300',
          active
            ? 'opacity-70 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--primary)_60%,transparent),transparent_58%),radial-gradient(circle_at_70%_40%,color-mix(in_oklab,var(--primary-3)_50%,transparent),transparent_58%)]'
            : 'group-hover:opacity-50 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--primary)_45%,transparent),transparent_58%),radial-gradient(circle_at_70%_40%,color-mix(in_oklab,var(--primary-3)_40%,transparent),transparent_58%)]'
        )}
      />
    </Link>
  );
}

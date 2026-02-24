'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Confirm',
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (open) {
      // Focus the confirm action for keyboard users.
      const t = setTimeout(() => {
        const btn = confirmRef.current?.querySelector('button');
        if (btn instanceof HTMLButtonElement) btn.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)]">
        <div className="text-sm font-semibold text-[var(--fg)]">{title}</div>
        {description ? <div className="mt-2 text-sm text-[var(--muted)]">{description}</div> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <span
            ref={(el) => {
              confirmRef.current = el;
            }}
          >
            <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
              {confirmText}
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button, CodeBlock } from '@/components/ui';

function safeJsonStringify(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (e: any) {
    return `<<unserializable: ${e?.message || 'unknown error'}>>`;
  }
}

export function RawJsonPanel({
  data,
  label = 'RAW',
  filename = 'payload.json',
  defaultOpen = false,
  maxChars = 2000,
  emptyText = '—',
}: {
  data: any;
  label?: string;
  filename?: string;
  defaultOpen?: boolean;
  maxChars?: number;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const preview = useMemo(() => {
    if (!open) return '';
    if (!data) return emptyText;
    const full = safeJsonStringify(data);
    if (full.length <= maxChars) return full;
    const clipped = full.slice(0, maxChars);
    return `${clipped}\n\n… [truncated to ${maxChars} chars; use Copy/Download for full payload]`;
  }, [open, data, maxChars, emptyText]);

  const copyFull = useCallback(async () => {
    const full = data ? safeJsonStringify(data) : emptyText;
    try {
      await navigator.clipboard.writeText(full);
    } catch {
      // ignore; no clipboard permission
    }
  }, [data, emptyText]);

  const downloadFull = useCallback(() => {
    const full = data ? safeJsonStringify(data) : emptyText;
    const blob = new Blob([full], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [data, emptyText, filename]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-[var(--muted)]">
          {open ? 'Showing a truncated preview to keep the UI fast.' : 'Collapsed to keep the UI fast.'}
        </div>
        <div className="flex items-center gap-2">
          {open ? (
            <>
              <Button variant="outline" onClick={copyFull} disabled={!data}>
                Copy JSON
              </Button>
              <Button variant="outline" onClick={downloadFull} disabled={!data}>
                Download
              </Button>
            </>
          ) : null}
          <Button variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide raw' : 'Show raw'}
          </Button>
        </div>
      </div>

      {open ? <CodeBlock label={label}>{preview}</CodeBlock> : null}
    </div>
  );
}

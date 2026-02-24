'use client';

import { useState } from 'react';
import { Button, StatusChip } from '@/components/ui';
import { useSafeMode } from '@/components/SafeModeClient';
import { useLowPowerMode } from '@/components/LowPowerModeClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function TopSafetyControls() {
  const { enabled, loading, setEnabled } = useSafeMode();
  const lowPower = useLowPowerMode();
  const [cooperOpen, setCooperOpen] = useState(false);
  const [cooperBusy, setCooperBusy] = useState(false);
  const [cooperResult, setCooperResult] = useState<string | null>(null);

  async function toggle() {
    await setEnabled(!enabled);
  }

  async function cooperKill() {
    setCooperBusy(true);
    setCooperResult(null);
    try {
      const res = await fetch('/api/cooper/kill', { method: 'POST' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Kill switch failed');
      const okCount = (j?.results || []).filter((r: any) => r?.ok).length;
      setCooperResult(`Cooper attempted ${j?.attempted ?? 0}; ok=${okCount}`);
    } catch (e: any) {
      setCooperResult(e?.message || 'Kill switch failed');
    } finally {
      setCooperBusy(false);
      setCooperOpen(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <StatusChip tone={enabled ? 'warn' : 'ok'} title={enabled ? 'Read-only mode: mutating actions blocked server-side' : 'Mutations allowed'}>
          Safe Mode: {enabled ? 'ON' : 'OFF'}
        </StatusChip>
        <Button variant={enabled ? 'outline' : 'outline'} disabled={loading} onClick={toggle}>
          {loading ? '…' : enabled ? 'Disable' : 'Enable'}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <StatusChip tone={lowPower.enabled ? 'idle' : 'info'} title="Low Power reduces visual FX to avoid scroll jank; persisted locally.">
          Low Power: {lowPower.enabled ? 'ON' : 'OFF'}
        </StatusChip>
        <Button variant="outline" disabled={lowPower.loading} onClick={() => void lowPower.toggle()}>
          {lowPower.loading ? '…' : lowPower.enabled ? 'Disable' : 'Enable'}
        </Button>
      </div>

      <Button variant="danger" onClick={() => setCooperOpen(true)} disabled={cooperBusy}>
        Cooper
      </Button>

      {cooperResult ? <span className="text-xs text-[var(--muted)]">{cooperResult}</span> : null}

      <ConfirmDialog
        open={cooperOpen}
        title="Emergency stop (Cooper)"
        description="Best-effort: attempts to kill active subagents via the gateway. Use if the system is spiraling."
        confirmText={cooperBusy ? 'Stopping…' : 'Stop all subagents'}
        danger
        onClose={() => (cooperBusy ? null : setCooperOpen(false))}
        onConfirm={cooperKill}
      />
    </div>
  );
}

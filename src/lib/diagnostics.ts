import 'server-only';

import fs from 'fs/promises';
import path from 'path';
import { invokeTool } from '@/lib/openclaw';
import { getSafeModeEnabled } from '@/lib/safeMode';
import { resolveMemoryFsConfig } from '@/lib/memoryFs';

export type ProbeStatus = 'pass' | 'fail' | 'skip';

export type ProbeResult = {
  id: string;
  label: string;
  module: string;
  status: ProbeStatus;
  ts: string; // ISO
  details?: any;
};

export type DiagnosticsState = {
  generatedAt: string;
  safeModeEnabled: boolean;
  results: Record<string, ProbeResult>;
};

type StoreMode = 'fs' | 'memory';

declare global {
  // eslint-disable-next-line no-var
  var __jayclawDiagnostics: { mode: StoreMode; state: DiagnosticsState | null } | undefined;
}

function memStore() {
  if (!globalThis.__jayclawDiagnostics) globalThis.__jayclawDiagnostics = { mode: 'memory', state: null };
  return globalThis.__jayclawDiagnostics;
}

let fsMode: StoreMode | null = null;

function dataDir() {
  const base = process.env.JAYCLAW_DATA_DIR ? path.resolve(process.env.JAYCLAW_DATA_DIR) : path.resolve(process.cwd(), '.jayclaw-data');
  return base;
}

function diagPath() {
  return process.env.JAYCLAW_DIAGNOSTICS_PATH
    ? path.resolve(process.env.JAYCLAW_DIAGNOSTICS_PATH)
    : path.join(dataDir(), 'diagnostics.json');
}

async function detectFsWritable(): Promise<boolean> {
  if (fsMode) return fsMode === 'fs';
  const forced = (process.env.JAYCLAW_PERSISTENCE || '').toLowerCase();
  if (forced === 'memory') {
    fsMode = 'memory';
    return false;
  }
  try {
    await fs.mkdir(path.dirname(diagPath()), { recursive: true });
    await fs.writeFile(diagPath(), JSON.stringify({ ok: true }) + '\n', { encoding: 'utf8', flag: 'a' });
    fsMode = 'fs';
    return true;
  } catch {
    fsMode = 'memory';
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function pass(id: string, label: string, module: string, details?: any): ProbeResult {
  return { id, label, module, status: 'pass', ts: nowIso(), ...(details ? { details } : null) };
}

function fail(id: string, label: string, module: string, error: any): ProbeResult {
  const summary = {
    status: typeof error?.status === 'number' ? error.status : undefined,
    code: typeof error?.code === 'string' ? error.code : undefined,
    message: typeof error?.message === 'string' ? error.message : undefined,
    details: error?.details,
  };
  return { id, label, module, status: 'fail', ts: nowIso(), details: summary };
}

function skip(id: string, label: string, module: string, reason: string, details?: any): ProbeResult {
  return { id, label, module, status: 'skip', ts: nowIso(), details: { reason, ...(details ? { details } : null) } };
}

async function runSingleToolProbe(id: string, label: string, module: string, req: Parameters<typeof invokeTool<any>>[0]): Promise<ProbeResult> {
  try {
    const result = await invokeTool<any>(req);
    // Keep payload light.
    const summary = typeof result === 'object' ? { keys: Object.keys(result || {}).slice(0, 12) } : { type: typeof result };
    return pass(id, label, module, summary);
  } catch (e: any) {
    return fail(id, label, module, e);
  }
}

export async function runDiagnosticsProbes(): Promise<DiagnosticsState> {
  const safeModeEnabled = await getSafeModeEnabled();

  const results: Record<string, ProbeResult> = {};

  // ---- Core gateway probe (read-only) ----
  if (process.env.OPENCLAW_GATEWAY_URL && process.env.OPENCLAW_GATEWAY_TOKEN && !safeModeEnabled) {
    results['gateway.session_status'] = await runSingleToolProbe(
      'gateway.session_status',
      'session_status (gateway reachable + tool invoke works)',
      'Ops',
      { namespace: 'session_status' }
    );
  } else {
    results['gateway.session_status'] = skip(
      'gateway.session_status',
      'session_status (gateway reachable + tool invoke works)',
      'Ops',
      safeModeEnabled ? 'safe_mode_enabled' : 'missing_gateway_env'
    );
  }

  // ---- Subagents ----
  if (results['gateway.session_status']?.status === 'pass' && !safeModeEnabled) {
    results['subagents.list'] = await runSingleToolProbe(
      'subagents.list',
      'subagents.list',
      'Subagents',
      { namespace: 'subagents', action: 'list', params: { recentMinutes: 120 } }
    );
  } else {
    results['subagents.list'] = skip('subagents.list', 'subagents.list', 'Subagents', 'gateway_unavailable_or_safe_mode');
  }

  // Mutating/unsafe to probe automatically (would create or steer agents).
  results['subagents.steer'] = skip(
    'subagents.steer',
    'subagents.steer (spawn/steer)',
    'Subagents',
    'not_probed_automatically',
    { note: 'Requires a live target session + mutates state. Enable only after manual verification.' }
  );

  // ---- Memory ----
  try {
    const cfg = await resolveMemoryFsConfig();
    const hasLocal = Boolean(cfg.rootFile || cfg.dailyDir);
    if (hasLocal) {
      results['memory.local_fs'] = pass('memory.local_fs', 'Local memory filesystem configured', 'Memory', {
        warnings: cfg.warnings,
        resolved: { rootFile: cfg.rootFile, dailyDir: cfg.dailyDir },
      });
      results['memory.search'] = pass('memory.search', 'memory.search (local)', 'Memory');
    } else if (results['gateway.session_status']?.status === 'pass' && !safeModeEnabled) {
      results['memory.local_fs'] = skip('memory.local_fs', 'Local memory filesystem configured', 'Memory', 'not_configured');
      results['memory.search'] = await runSingleToolProbe('memory.search', 'memory.search (gateway)', 'Memory', {
        namespace: 'memory',
        action: 'search',
        params: { query: '', limit: 1 },
      });
    } else {
      results['memory.local_fs'] = skip('memory.local_fs', 'Local memory filesystem configured', 'Memory', 'not_configured');
      results['memory.search'] = skip('memory.search', 'memory.search (gateway)', 'Memory', 'gateway_unavailable_or_safe_mode');
    }
  } catch (e: any) {
    results['memory.local_fs'] = fail('memory.local_fs', 'Local memory filesystem configured', 'Memory', e);
    results['memory.search'] = skip('memory.search', 'memory.search', 'Memory', 'dependency_failed');
  }

  // ---- Console / Messaging ----
  const hasDefaultTarget = Boolean((process.env.DEFAULT_MESSAGE_TARGET || process.env.OWNER_TARGET || '').trim());
  results['console.env_target'] = hasDefaultTarget
    ? pass('console.env_target', 'DEFAULT_MESSAGE_TARGET/OWNER_TARGET set', 'Console')
    : fail('console.env_target', 'DEFAULT_MESSAGE_TARGET/OWNER_TARGET set', 'Console', {
        status: 400,
        code: 'missing_default_target',
        message: 'Set DEFAULT_MESSAGE_TARGET (or OWNER_TARGET) to enable console sends.',
      });

  // We do NOT probe message.send automatically (mutating).
  results['message.send'] = skip('message.send', 'message.send (mutating)', 'Console', 'not_probed_automatically', {
    note: 'Would send a message. Console send remains available but may fail if the gateway blocks message tool.' ,
  });

  // ---- Scheduler ----
  results['scheduler.list'] = pass('scheduler.list', 'Scheduler list (local in-memory store)', 'Scheduler');
  results['scheduler.create_toggle'] = safeModeEnabled
    ? skip('scheduler.create_toggle', 'Scheduler create/toggle (local)', 'Scheduler', 'safe_mode_enabled')
    : pass('scheduler.create_toggle', 'Scheduler create/toggle (local)', 'Scheduler');

  // Scheduler run requires messaging; still unsafe to probe.
  results['scheduler.run'] = skip('scheduler.run', 'Scheduler run (sends message)', 'Scheduler', 'not_probed_automatically');

  // ---- Ops restart ----
  results['ops.restart'] = skip('ops.restart', 'Gateway restart', 'Ops', 'unavailable_in_public_gateway_mode');

  // ---- Audit ----
  results['audit.list'] = pass('audit.list', 'Audit log read (local)', 'Audit');

  // ---- Health wall ----
  results['health.snapshot'] = pass('health.snapshot', 'Health wall snapshot (server-side)', 'Health');

  const state: DiagnosticsState = {
    generatedAt: nowIso(),
    safeModeEnabled,
    results,
  };

  // Persist / cache
  const canFs = await detectFsWritable();
  if (!canFs) {
    const mem = memStore();
    mem.state = state;
    return state;
  }

  try {
    await fs.mkdir(path.dirname(diagPath()), { recursive: true });
    await fs.writeFile(diagPath(), JSON.stringify(state, null, 2), 'utf8');
  } catch {
    fsMode = 'memory';
    const mem = memStore();
    mem.state = state;
  }

  return state;
}

export async function getDiagnosticsState(): Promise<DiagnosticsState | null> {
  const canFs = await detectFsWritable();
  if (!canFs) {
    return memStore().state;
  }

  try {
    const content = await fs.readFile(diagPath(), 'utf8');
    return JSON.parse(content) as DiagnosticsState;
  } catch {
    return memStore().state;
  }
}

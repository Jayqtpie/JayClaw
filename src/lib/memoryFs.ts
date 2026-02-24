import fs from 'fs/promises';
import path from 'path';

export type MemoryFsConfig = {
  rootFile: string | null;
  dailyDir: string | null;
  warnings: string[];
  usedFallback: boolean;
};

async function isFile(p: string) {
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

async function isDir(p: string) {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function firstFile(candidates: Array<string | null | undefined>) {
  for (const c of candidates) {
    if (!c) continue;
    const full = path.resolve(c);
    if (await isFile(full)) return full;
  }
  return null;
}

async function firstDir(candidates: Array<string | null | undefined>) {
  for (const c of candidates) {
    if (!c) continue;
    const full = path.resolve(c);
    if (await isDir(full)) return full;
  }
  return null;
}

export async function resolveMemoryFsConfig(): Promise<MemoryFsConfig> {
  const memoryDirEnv = (process.env.OPENCLAW_MEMORY_DIR || '').trim() || null;
  const rootFileEnv = (process.env.OPENCLAW_MEMORY_ROOT_FILE || '').trim() || null;

  const cwd = process.cwd();

  const dailyDir = await firstDir([
    memoryDirEnv,
    path.join(cwd, 'memory'),
    path.join(cwd, '..', 'memory'),
    path.join(cwd, '..', '..', 'memory'),
  ]);

  const rootFile = await firstFile([
    rootFileEnv,
    dailyDir ? path.join(dailyDir, '..', 'MEMORY.md') : null,
    path.join(cwd, 'MEMORY.md'),
    path.join(cwd, '..', 'MEMORY.md'),
    path.join(cwd, '..', '..', 'MEMORY.md'),
  ]);

  const warnings: string[] = [];
  const usedFallback = Boolean(!memoryDirEnv && !rootFileEnv);

  if (!dailyDir && !rootFile) {
    warnings.push(
      'Memory paths could not be resolved. Set OPENCLAW_MEMORY_DIR to the directory containing daily memory docs (memory/*.md) and optionally OPENCLAW_MEMORY_ROOT_FILE to your MEMORY.md.'
    );
  } else {
    if (!dailyDir) {
      warnings.push(
        'Daily memory directory not found. Set OPENCLAW_MEMORY_DIR to the directory containing memory/*.md (daily logs).'
      );
    }
    if (!rootFile) {
      warnings.push(
        'Root MEMORY.md not found. Set OPENCLAW_MEMORY_ROOT_FILE to the full path of MEMORY.md (optional, but recommended).'
      );
    }
  }

  if (memoryDirEnv && !dailyDir) {
    warnings.unshift(`OPENCLAW_MEMORY_DIR was set but is not a readable directory: ${memoryDirEnv}`);
  }
  if (rootFileEnv && !rootFile) {
    warnings.unshift(`OPENCLAW_MEMORY_ROOT_FILE was set but is not a readable file: ${rootFileEnv}`);
  }

  return { rootFile, dailyDir, warnings, usedFallback };
}

export function normalizeDateParam(input: string): string {
  const s = (input || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

export type ResolvedDoc = { kind: 'root' | 'memory'; full: string };

export async function safeResolveDoc(id: string): Promise<ResolvedDoc | null> {
  const clean = (id || '').replace(/^\/+/, '');
  const cfg = await resolveMemoryFsConfig();

  if (clean === 'MEMORY.md') {
    if (!cfg.rootFile) return null;
    return { kind: 'root', full: cfg.rootFile };
  }

  if (clean.startsWith('memory/')) {
    if (!cfg.dailyDir) return null;
    const rel = clean.slice('memory/'.length);
    if (!/^[a-zA-Z0-9._-]+\.md$/.test(rel)) return null;
    const full = path.resolve(cfg.dailyDir, rel);
    const base = path.resolve(cfg.dailyDir);
    if (!full.startsWith(base + path.sep) && full !== base) return null;
    return { kind: 'memory', full };
  }

  return null;
}

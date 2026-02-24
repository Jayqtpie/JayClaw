#!/usr/bin/env node
/*
  perf-check.mjs
  Synthetic local perf sanity checks.

  What it does:
  - Starts `next start` on an ephemeral port (requires `npm run build` first)
  - Measures TTFB (time to first byte) for a few key routes
  - Performs a lightweight "no horizontal overflow" guard by ensuring the global
    CSS hardens overflow-x and long payload wrapping (static heuristic).

  Notes:
  - We intentionally avoid heavy browser automation dependencies.
*/

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

async function pickPort() {
  return await new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : null;
      srv.close(() => resolve(port));
    });
  });
}

function httpTtfb(url) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.request(url, { method: 'GET' }, (res) => {
      let firstByte = null;
      res.once('data', () => {
        firstByte = performance.now();
      });
      res.on('data', () => {});
      res.on('end', () => {
        const end = performance.now();
        resolve({
          status: res.statusCode,
          ttfbMs: firstByte ? Math.round(firstByte - start) : null,
          totalMs: Math.round(end - start),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitForHealthy(baseUrl, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await httpTtfb(`${baseUrl}/`);
      if (r.status && r.status >= 200 && r.status < 500) return true;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function checkNoHorizontalOverflowHeuristic() {
  const globalsPath = path.join(projectRoot, 'src', 'app', 'globals.css');
  const css = fs.readFileSync(globalsPath, 'utf8');

  const checks = [
    {
      name: 'global overflow-x hidden',
      ok: css.includes('overflow-x: hidden'),
      hint: 'Expected `html, body { ... overflow-x: hidden; }` guard in globals.css',
    },
    {
      name: 'pre/code wrap guard',
      ok: css.includes('pre, code') && css.includes('white-space: pre-wrap') && css.includes('word-break: break-word'),
      hint: 'Expected `pre, code { white-space: pre-wrap; word-break: break-word; }` guard in globals.css',
    },
  ];

  const failed = checks.filter((c) => !c.ok);
  return { checks, failed };
}

async function main() {
  const port = await pickPort();
  if (!port) throw new Error('Failed to allocate a port');

  const nextDir = path.join(projectRoot, '.next');
  if (!fs.existsSync(nextDir)) {
    log('ERROR: .next/ not found. Run `npm run build` first.');
    process.exitCode = 2;
    return;
  }

  const overflow = checkNoHorizontalOverflowHeuristic();

  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['next', 'start', '-p', String(port)],
    {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let stderr = '';
  child.stderr.on('data', (d) => {
    stderr += String(d);
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const healthy = await waitForHealthy(baseUrl);
  if (!healthy) {
    log('ERROR: server did not become healthy in time');
    if (stderr.trim()) log(`--- next start stderr ---\n${stderr}`);
    child.kill('SIGTERM');
    process.exitCode = 3;
    return;
  }

  const paths = ['/chat', '/subagents', '/ops'];
  const results = [];
  for (const p of paths) {
    const r = await httpTtfb(`${baseUrl}${p}`);
    results.push({ path: p, ...r });
  }

  child.kill('SIGTERM');

  log('');
  log('perf-check summary');
  log('------------------');

  for (const r of results) {
    log(`${r.path}: status=${r.status} ttfbMs=${r.ttfbMs ?? 'n/a'} totalMs=${r.totalMs}`);
  }

  log('');
  log('layout guard (heuristic)');
  for (const c of overflow.checks) {
    log(`- ${c.ok ? 'PASS' : 'FAIL'}: ${c.name}${c.ok ? '' : ` — ${c.hint}`}`);
  }

  if (overflow.failed.length) {
    process.exitCode = 4;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export type ChatRole = 'user' | 'assistant' | 'system';
export type ChatStatus = 'sent' | 'sending' | 'error';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  ts: number; // epoch ms
  status?: ChatStatus;
};

export type ChatThread = {
  v: 1;
  updatedAt: number;
  messages: ChatMessage[];
};

type StoreMode = 'fs' | 'memory';

declare global {
  // eslint-disable-next-line no-var
  var __jayclawChat: { mode: StoreMode; thread: ChatThread } | undefined;
}

function memStore() {
  if (!globalThis.__jayclawChat) {
    globalThis.__jayclawChat = {
      mode: 'memory',
      thread: { v: 1, updatedAt: Date.now(), messages: [] },
    };
  }
  return globalThis.__jayclawChat;
}

let fsMode: StoreMode | null = null;

function dataDir() {
  // Deploy-friendly, but may be ephemeral / read-only on serverless.
  // Override with JAYCLAW_DATA_DIR if you have a writable mount.
  return process.env.JAYCLAW_DATA_DIR ? path.resolve(process.env.JAYCLAW_DATA_DIR) : path.resolve(process.cwd(), '.jayclaw-data');
}

function threadPath() {
  return path.join(dataDir(), 'chat-thread.json');
}

async function detectFsWritable(): Promise<boolean> {
  if (fsMode) return fsMode === 'fs';

  const forced = (process.env.JAYCLAW_PERSISTENCE || '').toLowerCase();
  if (forced === 'memory') {
    fsMode = 'memory';
    return false;
  }

  try {
    await fs.mkdir(dataDir(), { recursive: true });
    // Try a minimal write to detect EROFS.
    const probe = path.join(dataDir(), '.write-probe');
    await fs.writeFile(probe, 'ok', 'utf8');
    await fs.unlink(probe).catch(() => null);
    fsMode = 'fs';
    return true;
  } catch {
    fsMode = 'memory';
    return false;
  }
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(9).toString('hex')}`;
}

function capMessages(messages: ChatMessage[], cap = 200) {
  if (messages.length <= cap) return messages;
  return messages.slice(-cap);
}

export async function readThread(): Promise<ChatThread> {
  const canFs = await detectFsWritable();
  if (!canFs) return memStore().thread;

  try {
    const raw = await fs.readFile(threadPath(), 'utf8');
    const json = JSON.parse(raw) as ChatThread;
    if (json?.v !== 1 || !Array.isArray(json.messages)) throw new Error('bad_thread');
    return json;
  } catch {
    // If the file is missing/corrupt, return empty; if FS is broken, degrade to memory.
    return { v: 1, updatedAt: Date.now(), messages: [] };
  }
}

async function writeThread(thread: ChatThread) {
  const canFs = await detectFsWritable();
  if (!canFs) {
    const mem = memStore();
    mem.thread = thread;
    return;
  }

  try {
    await fs.mkdir(dataDir(), { recursive: true });
    const tmp = threadPath() + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(thread, null, 2), 'utf8');
    await fs.rename(tmp, threadPath());
  } catch {
    // FS not writable after all; fall back.
    fsMode = 'memory';
    const mem = memStore();
    mem.thread = thread;
  }
}

export async function appendMessage(msg: Omit<ChatMessage, 'id' | 'ts'> & { id?: string; ts?: number }): Promise<ChatMessage> {
  const thread = await readThread();
  const full: ChatMessage = {
    id: msg.id ?? newId(msg.role),
    role: msg.role,
    text: msg.text,
    ts: msg.ts ?? Date.now(),
    status: msg.status,
  };
  thread.messages.push(full);
  thread.messages = capMessages(thread.messages);
  thread.updatedAt = Date.now();
  await writeThread(thread);
  return full;
}

export async function updateMessage(id: string, patch: Partial<ChatMessage>): Promise<ChatMessage | null> {
  const thread = await readThread();
  const idx = thread.messages.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  thread.messages[idx] = { ...thread.messages[idx], ...patch };
  thread.updatedAt = Date.now();
  await writeThread(thread);
  return thread.messages[idx] ?? null;
}

export async function clearThread(): Promise<void> {
  await writeThread({ v: 1, updatedAt: Date.now(), messages: [] });
}

export async function chatStoreInfo(): Promise<{ mode: StoreMode; persistent: boolean; path?: string }> {
  const canFs = await detectFsWritable();
  return canFs ? { mode: 'fs', persistent: true, path: threadPath() } : { mode: 'memory', persistent: false };
}

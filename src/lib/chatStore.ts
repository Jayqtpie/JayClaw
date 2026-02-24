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

function dataDir() {
  // Keep it inside the app folder (deploy-friendly) but outside /public.
  // If your host uses ephemeral FS, swap this for a DB.
  return process.env.JAYCLAW_DATA_DIR
    ? path.resolve(process.env.JAYCLAW_DATA_DIR)
    : path.resolve(process.cwd(), '.jayclaw-data');
}

function threadPath() {
  return path.join(dataDir(), 'chat-thread.json');
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(9).toString('hex')}`;
}

export async function readThread(): Promise<ChatThread> {
  await ensureDir();
  try {
    const raw = await fs.readFile(threadPath(), 'utf8');
    const json = JSON.parse(raw) as ChatThread;
    if (json?.v !== 1 || !Array.isArray(json.messages)) throw new Error('bad_thread');
    return json;
  } catch {
    return { v: 1, updatedAt: Date.now(), messages: [] };
  }
}

async function writeThread(thread: ChatThread) {
  await ensureDir();
  const tmp = threadPath() + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(thread, null, 2), 'utf8');
  await fs.rename(tmp, threadPath());
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
  thread.updatedAt = Date.now();
  // cap to last 200 to keep perf sane
  if (thread.messages.length > 200) thread.messages = thread.messages.slice(-200);
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

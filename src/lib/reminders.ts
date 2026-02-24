import 'server-only';

import crypto from 'crypto';

export type Reminder = {
  id: string;
  createdAt: number;
  cron: string;
  title: string;
  message: string;
  enabled: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __occ_reminders: Reminder[] | undefined;
}

function store() {
  if (!globalThis.__occ_reminders) globalThis.__occ_reminders = [];
  return globalThis.__occ_reminders;
}

export function listReminders() {
  return store().slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function addReminder(r: Omit<Reminder, 'id' | 'createdAt'>) {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const reminder: Reminder = { id, createdAt, ...r };
  store().push(reminder);
  return reminder;
}

export function setReminderEnabled(id: string, enabled: boolean) {
  const s = store();
  const idx = s.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  s[idx] = { ...s[idx], enabled };
  return s[idx];
}

export function getReminder(id: string) {
  return store().find((x) => x.id === id) ?? null;
}

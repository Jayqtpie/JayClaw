'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Skeleton, TextArea, StatusChip } from '@/components/ui';

type ChatMsg = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  ts: number;
  status?: 'sent' | 'sending' | 'error';
};

type Thread = { v: 1; updatedAt: number; messages: ChatMsg[] };

function fmt(ts: number) {
  try {
    return new Date(ts).toLocaleString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function Bubble({ msg }: { msg: ChatMsg }) {
  const mine = msg.role === 'user';
  const assistant = msg.role === 'assistant';

  const frame = mine
    ? 'border-[color-mix(in_oklab,var(--primary)_34%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary)_18%,var(--surface-solid)),color-mix(in_oklab,var(--primary-3)_10%,var(--surface-solid)))]'
    : assistant
      ? 'border-[color-mix(in_oklab,var(--border)_70%,transparent)] bg-[color-mix(in_oklab,var(--surface-solid)_60%,transparent)]'
      : 'border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_55%,transparent)]';

  const statusTone = msg.status === 'error' ? 'bad' : msg.status === 'sending' ? 'warn' : 'idle';

  return (
    <div className={mine ? 'flex justify-end' : 'flex justify-start'}>
      <div className={mine ? 'max-w-[92%] md:max-w-[76%]' : 'max-w-[92%] md:max-w-[78%]'}>
        <div
          className={`relative rounded-[22px] border p-4 shadow-[var(--shadow-sm)] backdrop-blur-xl ${frame}`}
        >
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--fg)]">{msg.text}</div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-[11px] font-medium tracking-[0.12em] text-[var(--muted-2)]">
              {assistant ? 'ASSISTANT' : mine ? 'YOU' : msg.role.toUpperCase()} • {fmt(msg.ts)}
            </div>
            {msg.status && msg.status !== 'sent' ? (
              <StatusChip tone={statusTone}>{msg.status === 'sending' ? 'SENDING' : 'ERROR'}</StatusChip>
            ) : null}
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-px rounded-[22px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [thread, setThread] = useState<Thread | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<any | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);
  const [relayMode, setRelayMode] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const hasErrors = useMemo(() => (thread?.messages || []).some((m) => m.status === 'error'), [thread]);

  async function load() {
    setError(null);
    try {
      const res = await fetch('/api/chat/thread', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(j?.error || 'Failed to load');
      setThread(j.thread);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    }
  }

  async function loadDiag() {
    setDiagBusy(true);
    try {
      const res = await fetch('/api/chat/diag', { cache: 'no-store' });
      const j = (await res.json().catch(() => null)) as any;
      setDiagnostic(j);
      setShowDiagnostics(false);
    } catch (e: any) {
      setDiagnostic({ ok: false, error: e?.message || 'Failed to load diagnostics' });
      setShowDiagnostics(false);
    } finally {
      setDiagBusy(false);
    }
  }

  async function copyDiag() {
    try {
      if (!diagnostic) return;
      await navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 2));
    } catch {
      // ignore
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    setDiagnostic(null);
    setShowDiagnostics(false);
    setRelayMode(false);

    // optimistic UI (client-side)
    const optimistic: ChatMsg = {
      id: `optimistic_${Date.now()}`,
      role: 'user',
      text: trimmed,
      ts: Date.now(),
      status: 'sending',
    };

    setThread((t) => ({ v: 1, updatedAt: Date.now(), messages: [...(t?.messages || []), optimistic] }));
    setDraft('');

    try {
      const res = await fetch('/api/chat/send', { method: 'POST', body: JSON.stringify({ message: trimmed }) });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        if (j?.diagnostic) {
          setDiagnostic(j.diagnostic);
          setShowDiagnostics(false);
        }
        throw new Error(j?.error || 'Send failed');
      }
      setRelayMode(j?.result?.mode === 'relay');
      if (j?.result?.mode === 'relay' && j?.result?.diagnostic) {
        setDiagnostic(j.result.diagnostic);
        setShowDiagnostics(false);
      }
      setThread(j.thread);
    } catch (e: any) {
      setError(e?.message || 'Send failed');
      // keep the optimistic message but mark it as error
      setThread((t) => {
        const msgs = (t?.messages || []).map((m) => (m.id === optimistic.id ? { ...m, status: 'error' as const } : m));
        return { v: 1, updatedAt: Date.now(), messages: msgs };
      });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread?.messages?.length]);

  return (
    <div className="space-y-6">
      <Card
        title="Chat"
        subtitle="Native dashboard chat. Messages are persisted server-side and routed through the gateway tool invoke API (tokens never hit the browser)."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={load} disabled={busy}>
              Refresh
            </Button>
            <Button variant="outline" onClick={loadDiag} disabled={busy || diagBusy}>
              {diagBusy ? 'Diag…' : 'Diagnostics'}
            </Button>
            {relayMode ? <StatusChip tone="warn">RELAY MODE</StatusChip> : null}
            <StatusChip tone={busy ? 'warn' : error ? 'bad' : 'ok'}>{busy ? 'LIVE' : error ? 'ERROR' : 'READY'}</StatusChip>
          </div>
        }
      >
        {error ? (
          <Alert
            variant="error"
            title="Chat error"
            message={error}
            right={
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={load}>
                  Retry
                </Button>
                <Button variant="outline" onClick={loadDiag} disabled={diagBusy}>
                  {diagBusy ? 'Diag…' : 'Diag'}
                </Button>
              </div>
            }
          />
        ) : null}

        {relayMode && !diagnostic ? (
          <Alert
            variant="warning"
            title="Relay mode"
            message="Relay mode: gateway tools unavailable; routing via relay."
          />
        ) : null}

        {diagnostic ? (
          <Alert
            variant={diagnostic?.ok === false ? 'warning' : 'info'}
            title="Diagnostics captured"
            message={
              relayMode
                ? 'Relay mode: routing via relay. Open diagnostics for the attempt trace.'
                : 'Use diagnostics only when debugging gateway_error/chat_no_reply.'
            }
            right={
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowDiagnostics((v) => !v)}>
                  {showDiagnostics ? 'Hide diagnostics' : 'Show diagnostics'}
                </Button>
                <Button variant="outline" onClick={copyDiag}>
                  Copy JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDiagnostic(null);
                    setShowDiagnostics(false);
                  }}
                >
                  Clear
                </Button>
              </div>
            }
          />
        ) : null}

        {diagnostic && showDiagnostics ? (
          <pre className="max-h-[240px] overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_55%,transparent)] p-4 text-[11px] leading-relaxed text-[var(--muted)]">
            {JSON.stringify(diagnostic, null, 2)}
          </pre>
        ) : null}

        {hasErrors ? (
          <Alert
            variant="warning"
            title="Some messages failed"
            message="One or more messages are marked ERROR. You can retry by re-sending the text."
          />
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_55%,transparent)] shadow-[var(--shadow)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
              <div className="text-xs font-semibold tracking-[0.28em] text-[var(--muted-2)]">THREAD</div>
              <div className="text-xs text-[var(--muted)]">{thread?.messages?.length ?? 0} messages</div>
            </div>
            <div ref={scrollerRef} className="max-h-[60dvh] overflow-auto px-5 py-4">
              {!thread ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-3/4" />
                  <Skeleton className="h-16 w-2/3" />
                  <Skeleton className="h-16 w-3/4" />
                </div>
              ) : thread.messages.length ? (
                <div className="space-y-3">
                  {thread.messages.map((m) => (
                    <Bubble key={m.id} msg={m} />
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-[var(--muted)]">Start the thread with a message.</div>
              )}
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] backdrop-blur-xl">
            <div className="text-xs font-semibold tracking-[0.28em] text-[var(--muted-2)]">COMPOSE</div>
            <div className="mt-3">
              <TextArea
                value={draft}
                onChange={setDraft}
                rows={7}
                placeholder="Ask the assistant… (Shift+Enter for newline)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-[var(--muted)]">
                  This calls <span className="font-mono">/api/chat/send</span> (server-side gateway invoke).
                </div>
                <Button onClick={() => send(draft)} disabled={busy || !draft.trim()}>
                  {busy ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </div>

            <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-solid)_55%,transparent)] p-4 text-xs text-[var(--muted)]">
              <div className="font-semibold text-[var(--fg)]">Backend notes</div>
              <div className="mt-1">
                Replies come from the OpenClaw session chat pipeline (<span className="font-mono">sessions_send</span> + <span className="font-mono">sessions_history</span>).
                If you get <span className="font-mono">chat_no_reply</span>, verify <span className="font-mono">CHAT_SESSION_KEY</span> (or <span className="font-mono">CHAT_SESSION_LABEL</span> on deployments that route by label).
                If your gateway deployment does not expose the sessions tools, set <span className="font-mono">CHAT_TOOL_NAMESPACE</span> / <span className="font-mono">CHAT_TOOL_ACTION</span>.
                Use <span className="font-mono">/api/chat/diag</span> for a safe, read-only probe of which path is available.
              </div>
            </div>
          </section>
        </div>
      </Card>
    </div>
  );
}

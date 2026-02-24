import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';
import { requireNotSafeMode } from '@/lib/safeMode';
import { appendAudit } from '@/lib/audit';
import { appendMessage, updateMessage, readThread } from '@/lib/chatStore';

function extractAssistantText(result: any): string | null {
  if (!result) return null;
  if (typeof result === 'string') return result;
  // common shapes
  const candidates = [
    result?.reply,
    result?.message,
    result?.text,
    result?.content,
    result?.result?.reply,
    result?.result?.message,
    result?.result?.text,
    result?.result?.content,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }

  // Sometimes the tool returns an array of messages.
  const arr = result?.messages ?? result?.result?.messages;
  if (Array.isArray(arr)) {
    const last = [...arr].reverse().find((m) => (m?.role === 'assistant' || m?.type === 'assistant') && typeof m?.text === 'string');
    if (last?.text?.trim()) return last.text.trim();
  }

  return null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message)
    return NextResponse.json(
      {
        ok: false,
        error: 'missing_message',
        code: 'missing_message',
        hint: 'POST JSON: { "message": "..." }',
      },
      { status: 400 }
    );

  const userMsg = await appendMessage({ role: 'user', text: message, status: 'sending' });

  try {
    await requireNotSafeMode();

    // IMPORTANT: This endpoint is intentionally flexible because gateway deployments vary.
    // Default behavior: try a chat-capable tool if present; otherwise, operators can configure it.
    const namespace = process.env.CHAT_TOOL_NAMESPACE || 'subagents';
    const action = process.env.CHAT_TOOL_ACTION || 'steer';

    const result = await invokeTool<any>({
      namespace,
      action,
      params: {
        message,
        // Provide context in a safe, minimal way.
        // Gateways that ignore these fields will simply drop them.
        channel: 'dashboard',
        thread: 'jayclaw',
        returnTranscript: true,
      },
    });

    const assistantText = extractAssistantText(result);
    if (!assistantText) {
      throw Object.assign(new Error('chat_no_reply'), {
        status: 502,
        code: 'chat_no_reply',
        details: {
          hint:
            'Gateway returned no assistant text. Configure CHAT_TOOL_NAMESPACE/CHAT_TOOL_ACTION to a tool that returns a reply, or update extractAssistantText() to match your gateway response shape.',
          namespace,
          action,
        },
      });
    }

    await updateMessage(userMsg.id, { status: 'sent' });
    await appendMessage({ role: 'assistant', text: assistantText, status: 'sent' });

    await appendAudit({
      action: 'chat.send',
      summary: message.length > 180 ? message.slice(0, 180) + '…' : message,
      payload: { messageLen: message.length, tool: { namespace, action } },
      result: { ok: true, status: 200 },
    });

    const thread = await readThread();
    return NextResponse.json({ ok: true, result, thread });
  } catch (e: any) {
    await updateMessage(userMsg.id, { status: 'error' });

    await appendAudit({
      action: 'chat.send',
      summary: message.length > 180 ? message.slice(0, 180) + '…' : message,
      payload: { messageLen: message.length },
      result: { ok: false, status: e?.status || 500, error: e?.code || e?.message || 'failed' },
    });

    return NextResponse.json(
      {
        ok: false,
        error: e?.code || e?.message || 'Failed to send chat message',
        details: e?.details,
        status: e?.status || 500,
      },
      { status: e?.status || 500 }
    );
  }
}

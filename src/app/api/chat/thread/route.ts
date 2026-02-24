import { NextResponse } from 'next/server';
import { readThread, chatStoreInfo } from '@/lib/chatStore';

export async function GET() {
  try {
    const thread = await readThread();
    const store = await chatStoreInfo();
    return NextResponse.json({ ok: true, thread, store });
  } catch (e: any) {
    // Graceful empty state for serverless/readonly FS.
    return NextResponse.json({
      ok: true,
      thread: { v: 1, updatedAt: Date.now(), messages: [] },
      store: { mode: 'memory', persistent: false },
      warning: {
        code: 'chat_thread_unavailable',
        hint: 'Chat thread persistence is unavailable in this runtime. Set JAYCLAW_DATA_DIR to a writable path or use external storage.',
        error: e?.message,
      },
    });
  }
}

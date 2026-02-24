import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';

export async function GET() {
  try {
    const result = await invokeTool<any>({
      namespace: 'subagents',
      action: 'list',
      params: { recentMinutes: 120 },
    });
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.code || e?.message || 'Failed to load subagents', details: e?.details },
      { status: e?.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ ok: false, error: 'missing_message' }, { status: 400 });

  try {
    const result = await invokeTool<any>({
      namespace: 'subagents',
      action: 'steer',
      params: {
        // For spawning, your gateway may expose a dedicated action.
        // This MVP uses 'steer' as a placeholder. Update as needed.
        message,
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.code || e?.message || 'Failed to send subagent message', details: e?.details },
      { status: e?.status || 500 }
    );
  }
}

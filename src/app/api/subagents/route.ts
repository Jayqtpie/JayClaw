import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';

export async function GET() {
  const result = await invokeTool<any>({
    namespace: 'subagents',
    action: 'list',
    params: { recentMinutes: 120 },
  });
  return NextResponse.json({ ok: true, result });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ ok: false, error: 'missing_message' }, { status: 400 });

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
}

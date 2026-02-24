import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ ok: false, error: 'missing_message' }, { status: 400 });

  // Assumption: gateway supports a tool-style invoke endpoint.
  // Update src/lib/openclaw.ts if your gateway uses different paths.
  const result = await invokeTool<any>({
    namespace: 'message',
    action: 'send',
    params: {
      message,
      // Optionally include target/channel info if your gateway expects it.
      // target: 'agent:main:main',
    },
  });

  return NextResponse.json({ ok: true, result });
}

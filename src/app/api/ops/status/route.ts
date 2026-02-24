import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';

export async function GET() {
  try {
    const result = await invokeTool<any>({ namespace: 'session_status' });
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to load ops status', details: e?.details },
      { status: e?.status || 500 }
    );
  }
}

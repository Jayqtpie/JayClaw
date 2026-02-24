import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';

export async function GET() {
  const result = await invokeTool<any>({ namespace: 'gateway', action: 'status' });
  return NextResponse.json({ ok: true, result });
}

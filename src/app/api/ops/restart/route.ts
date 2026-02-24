import { NextResponse } from 'next/server';
import { invokeTool } from '@/lib/openclaw';

export async function POST() {
  const result = await invokeTool<any>({ namespace: 'gateway', action: 'restart' });
  return NextResponse.json({ ok: true, result });
}

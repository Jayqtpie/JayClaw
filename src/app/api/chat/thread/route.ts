import { NextResponse } from 'next/server';
import { readThread } from '@/lib/chatStore';

export async function GET() {
  const thread = await readThread();
  return NextResponse.json({ ok: true, thread });
}

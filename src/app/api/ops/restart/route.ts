import { NextResponse } from 'next/server';

export async function POST() {
  // The hosted gateway currently does not expose a public restart tool endpoint.
  // Keep this explicit so UI can show a clear message instead of generic failure.
  return NextResponse.json(
    {
      ok: false,
      error: 'restart_unavailable',
      message:
        'Gateway restart is not exposed via the public API in this deployment. Use server CLI: openclaw gateway restart',
    },
    { status: 501 }
  );
}

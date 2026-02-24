import { Suspense } from 'react';
import LoginClient from './LoginClient';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-black text-slate-200 p-8">Loading…</div>}>
      <LoginClient />
    </Suspense>
  );
}

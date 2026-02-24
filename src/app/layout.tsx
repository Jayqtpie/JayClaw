import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JayClaw Control Center',
  description: 'Secure control center for OpenClaw Gateway',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

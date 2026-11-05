import type { Metadata } from 'next';
import { AppProvider } from '@/components/AppProvider';
import { AppShell } from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = { title: { default: 'Bishamon — Ruang untuk rasa ingin tahu', template: '%s · Bishamon' }, description: 'Pustaka pengetahuan pribadi. Baca, simpan, dan evaluasi hasil AI dengan sadar.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body><AppProvider><AppShell>{children}</AppShell></AppProvider></body></html>;
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { GenerateDialog } from './GenerateDialog';
import { useApp } from './AppProvider';

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Jelajahi', icon: 'feed' },
  { href: '/saved', label: 'Simpanan', icon: 'bookmark' },
  { href: '/evaluations', label: 'Evaluasi', icon: 'evaluation' },
  { href: '/history', label: 'Riwayat', icon: 'history' },
  { href: '/settings', label: 'Pengaturan', icon: 'settings' },
];
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { config, authRequired } = useApp();
  const [generateOpen, setGenerateOpen] = useState(false);
  return <div className="app-shell"><a href="#main-content" className="skip-link">Langsung ke konten</a><aside className="sidebar"><Link href="/" className="brand" aria-label="Bishamon, beranda"><span className="brand-mark">毘</span><span>BISHAMON<small>Wise scrolling</small></span></Link><div className="sidebar-rule" /><span className="sidebar-label">Ruang pengetahuan</span><nav className="desktop-navigation" aria-label="Navigasi utama">{navigation.map(item => <Link key={item.href} href={item.href} className={`navigation-item ${pathname === item.href ? 'is-active' : ''}`} aria-current={pathname === item.href ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>)}</nav><button className="button button-generate" onClick={() => setGenerateOpen(true)}><Icon name="plus" size={19} />Buat pengetahuan</button><div className="sidebar-note"><span className="note-sun" aria-hidden="true" /><p>Lebih sedikit kebisingan.<br />Lebih banyak pemahaman.</p><span>Selembar ilmu, setiap waktu.</span></div><div className="workspace-label"><span className="status-dot" /><div>Pustaka pribadi<small>{authRequired ? 'Dilindungi kata sandi' : 'Tersimpan di instalasi Anda'}</small></div><Icon name="book" size={18} /></div></aside><div className="main-shell"><header className="topbar"><span>Jurnal pengetahuan pribadi</span><div><span className="status-dot" /><span>{config.providers.some(provider => provider.id !== 'demo' && provider.configured) ? 'Provider AI tersedia' : 'Demo lokal tersedia'}</span><span className="topbar-seal">学</span></div></header><main id="main-content" className="main-content">{children}</main><footer className="page-footer"><span>BISHAMON</span><p>Rasa ingin tahu yang dirawat, bukan sekadar digulir.</p><span>知ることを楽しむ</span></footer></div><button className="mobile-generate icon-button" aria-label="Buat pengetahuan" onClick={() => setGenerateOpen(true)}><Icon name="plus" size={24} /></button><nav className="mobile-navigation" aria-label="Navigasi seluler">{navigation.map(item => <Link href={item.href} key={item.href} className={pathname === item.href ? 'is-active' : ''} aria-current={pathname === item.href ? 'page' : undefined}><Icon name={item.icon} size={20} /><span>{item.label}</span></Link>)}</nav>{generateOpen && <GenerateDialog onClose={() => setGenerateOpen(false)} />}</div>;
}

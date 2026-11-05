'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { AppConfig, Domain } from '@/lib/types';
import { api, errorMessage } from '@/lib/client';
import { ErrorNotice, Loading } from './Feedback';
import { Icon } from './Icon';

type AppState = { config: AppConfig; domains: Domain[]; revision: number; refresh: () => void; authRequired: boolean; logout: () => Promise<void> };
const Context = createContext<AppState | null>(null);
export function useApp() { const value = useContext(Context); if (!value) throw new Error('AppProvider diperlukan.'); return value; }

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ authenticated: boolean; authRequired: boolean } | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    setError('');
    try {
      const current = await api<{ authenticated: boolean; authRequired: boolean }>('/api/session');
      setSession(current);
      if (current.authRequired && !current.authenticated) { setConfig(null); return; }
      const [settings, taxonomy] = await Promise.all([api<AppConfig>('/api/config'), api<{ data: Domain[] }>('/api/domains')]);
      setConfig(settings); setDomains(taxonomy.data);
    } catch (failure) { setError(errorMessage(failure)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const expired = () => { setSession({ authenticated: false, authRequired: true }); setConfig(null); };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/api/session', { method: 'POST', body: JSON.stringify({ password }) }); setPassword(''); await load(); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  async function logout() { await api('/api/session', { method: 'DELETE' }); setConfig(null); await load(); }
  if (session?.authRequired && !session.authenticated) return <main className="login-screen"><div className="login-art" aria-hidden="true"><span>毘</span><p>Ruang untuk<br />rasa ingin tahu.</p></div><form className="login-form" onSubmit={login}><span className="eyebrow">Bishamon · Ruang pribadi</span><h1>Selamat datang kembali.</h1><p>Masuk sebagai pemilik untuk membuka pustaka pengetahuan Anda.</p><label htmlFor="password">Kata sandi pemilik</label><input autoFocus id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />{error && <ErrorNotice message={error} />}<button className="button button-primary" disabled={busy}>{busy ? 'Memeriksa…' : 'Buka pustaka'}<Icon name="arrow" /></button></form></main>;
  if (!config) return <main className="boot-screen"><div className="brand-mark">毘</div>{error ? <ErrorNotice message={error} retry={() => void load()} /> : <Loading />}</main>;
  return <Context.Provider value={{ config, domains, revision, refresh: () => setRevision(value => value + 1), authRequired: session?.authRequired ?? false, logout }}>{children}</Context.Provider>;
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Card, CardType, GenerationInput, GenerationRun, Provider } from '@/lib/types';
import { api, cardLabels, errorMessage } from '@/lib/client';
import { useApp } from './AppProvider';
import { Modal } from './Modal';
import { ErrorNotice } from './Feedback';
import { Icon } from './Icon';

export function GenerateDialog({ onClose }: { onClose: () => void }) {
  const { domains, config, refresh } = useApp();
  const router = useRouter();
  const [domainId, setDomainId] = useState(domains.find(domain => domain.parentId)?.id || domains[0]?.id || '');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState<CardType>('EXPLAINER');
  const [provider, setProvider] = useState<Provider>(config.defaultProvider);
  const selected = config.providers.find(item => item.id === provider);
  const [model, setModel] = useState(selected?.model || '');
  const [useRag, setUseRag] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function generate(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const input: GenerationInput = { domainId, topic: topic.trim() || undefined, type, provider, model: model.trim() || undefined, useRag: provider !== 'demo' && useRag };
    try {
      const result = await api<{ card: Card; run: GenerationRun }>('/api/generate', { method: 'POST', body: JSON.stringify(input) });
      refresh(); onClose(); router.push(`/cards/${result.card.id}`);
    } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <Modal title="Tumbuhkan pengetahuan baru." onClose={onClose} busy={busy}><form onSubmit={generate} className="stack-form"><p className="muted">Pilih hal yang ingin Anda pahami. Hasil akan disimpan bersama model, sumber, dan riwayat prosesnya.</p><label>Bidang pengetahuan<select value={domainId} onChange={event => setDomainId(event.target.value)} required disabled={busy}>{domains.map(domain => <option key={domain.id} value={domain.id}>{domain.parentId ? '↳ ' : ''}{domain.name}</option>)}</select></label><label>Topik <span className="optional">opsional</span><input value={topic} onChange={event => setTopic(event.target.value)} placeholder="Misalnya, mengapa langit berwarna biru?" maxLength={500} disabled={busy} /></label><div className="form-columns"><label>Format<select value={type} onChange={event => setType(event.target.value as CardType)} disabled={busy}>{Object.entries(cardLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Provider<select value={provider} onChange={event => { const value = event.target.value as Provider; setProvider(value); setModel(config.providers.find(item => item.id === value)?.model || ''); }} disabled={busy}>{config.providers.map(item => <option key={item.id} value={item.id}>{item.label}{!item.configured ? ' · belum diatur' : ''}</option>)}</select></label></div><label>Model<input value={model} onChange={event => setModel(event.target.value)} placeholder={selected?.model} maxLength={150} disabled={busy || provider === 'demo'} /></label>{provider === 'demo' ? <div className="notice"><strong>Mode demo dipilih</strong><p>Konten contoh dibuat secara lokal tanpa panggilan AI. Hasil diberi label demo dan tidak masuk statistik evaluasi model.</p></div> : <><label className="checkbox-label"><input type="checkbox" checked={useRag} onChange={event => setUseRag(event.target.checked)} disabled={busy} /><span>Cari referensi arXiv <small>Referensi ditemukan, bukan verifikasi kebenaran klaim.</small></span></label>{!selected?.configured && <div className="notice notice-error">Provider ini belum siap. Atur API key di environment server, lalu mulai ulang aplikasi.</div>}</>}{error && <ErrorNotice message={error} />}{busy && <p className="generation-pending" role="status"><span className="loading-seal" />Sedang menyusun kartu. Proses dapat memerlukan beberapa menit.</p>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose} disabled={busy}>Batal</button><button className="button button-primary" disabled={busy || !domainId || !selected?.configured}>{busy ? 'Menyusun…' : provider === 'demo' ? 'Buat kartu demo' : 'Buat pengetahuan'}<Icon name="plus" size={18} /></button></div></form></Modal>;
}

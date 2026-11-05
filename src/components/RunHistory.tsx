'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { GenerationRun } from '@/lib/types';
import { api, errorMessage, formatDate, formatDuration } from '@/lib/client';
import { useApp } from './AppProvider';
import { EmptyState, ErrorNotice, Loading } from './Feedback';
import { Icon } from './Icon';

const statusLabels = { running: 'Sedang berjalan', completed: 'Selesai', failed: 'Gagal', interrupted: 'Terhenti' };
export function RunHistory() {
  const { revision, domains } = useApp();
  const [runs, setRuns] = useState<GenerationRun[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setError(''); try { setRuns((await api<{ data: GenerationRun[] }>('/api/runs')).data); } catch (failure) { setError(errorMessage(failure)); } }, []);
  useEffect(() => { void load(); }, [load, revision]);
  return <><section className="page-heading compact-heading"><div><span className="eyebrow">Jejak proses</span><h1>Setiap gagasan<br /><em>punya asal.</em></h1><p>Telusuri model, prompt, percobaan, dan hasil dari setiap proses generasi.</p></div></section><div className="section-heading"><h2>Riwayat generasi</h2><button className="text-button" onClick={() => void load()}>Perbarui <Icon name="history" size={16} /></button></div><p className="data-note">Menampilkan hingga 100 proses terbaru. Kegagalan tetap dicatat; demo diberi label terpisah.</p>{error && <ErrorNotice message={error} retry={() => void load()} />}{!runs && !error ? <Loading label="Menelusuri riwayat…" /> : runs && !runs.length ? <EmptyState title="Belum ada jejak generasi.">Mulai dari tombol Buat pengetahuan. Setiap proses akan tercatat di sini.</EmptyState> : <div className="run-list">{runs?.map(run => <details className="run-item" key={run.id}><summary><div className="run-symbol"><Icon name={run.status === 'completed' ? 'book' : 'history'} size={20} /></div><div className="run-summary"><span className="run-meta">{formatDate(run.startedAt)} · {domains.find(domain => domain.id === run.domainId)?.name || run.domainId}</span><h2>{run.topic || 'Eksplorasi bidang pengetahuan'}</h2><p>{run.provider === 'demo' ? 'DEMO LOKAL' : run.provider} / {run.model}</p></div><span className={`run-status ${run.status}`}>{statusLabels[run.status]}</span><span className="run-duration">{formatDuration(run.durationMs)}</span><Icon name="chevron" size={18} /></summary><div className="run-details">{run.error && <div className="notice notice-error">{run.error}</div>}{run.provider === 'demo' && <div className="notice">Proses demo lokal, tidak masuk statistik model AI.</div>}<dl className="run-properties"><div><dt>Versi prompt</dt><dd>{run.promptVersion}</dd></div><div><dt>Pencarian referensi</dt><dd>{run.useRag ? 'Diaktifkan' : 'Tidak digunakan'}</dd></div><div><dt>ID proses</dt><dd className="mono">{run.id}</dd></div></dl><h3>Percobaan provider</h3>{run.attempts.length ? <div className="attempt-list">{run.attempts.map((attempt, index) => <div key={attempt.id}><span className="attempt-number">{String(index + 1).padStart(2, '0')}</span><div><strong>{attempt.provider} / {attempt.model}</strong><p>{attempt.status === 'completed' ? 'Selesai' : 'Gagal'} · {formatDuration(attempt.durationMs)} · Token masuk {attempt.inputTokens ?? '—'} / keluar {attempt.outputTokens ?? '—'}</p>{attempt.error && <p className="bad-text">{attempt.error}</p>}</div></div>)}</div> : <p className="muted">Tidak ada percobaan provider yang tercatat.</p>}<details className="prompt-details"><summary>Lihat prompt tersimpan</summary><pre>{run.prompt}</pre></details>{run.cardId && <Link className="text-button" href={`/cards/${run.cardId}`}>Buka kartu hasil <Icon name="arrow" size={17} /></Link>}</div></details>)}</div>}</>;
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ModelStats } from '@/lib/types';
import { api, errorMessage, formatDuration } from '@/lib/client';
import { ErrorNotice, Loading } from './Feedback';
import { Feed } from './Feed';
import { Icon } from './Icon';
import { useApp } from './AppProvider';

type Stats = { models: ModelStats[]; totalCards: number; demoCards: number; evaluatedCards: number };
export function EvaluationOverview() {
  const { revision } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setError(''); try { setStats(await api<Stats>('/api/stats')); } catch (failure) { setError(errorMessage(failure)); } }, []);
  useEffect(() => { void load(); }, [load, revision]);
  useEffect(() => {
    const update = () => { void load(); };
    window.addEventListener('evaluation-updated', update);
    return () => window.removeEventListener('evaluation-updated', update);
  }, [load]);
  return <><section className="page-heading compact-heading"><div><span className="eyebrow">Laboratorium pribadi</span><h1>Kualitas yang<br /><em>bisa Anda telusuri.</em></h1><p>Penilaian Anda menjadi catatan, bukan klaim bahwa AI selalu benar.</p></div></section><div className="section-heading"><h2>Ringkasan evaluasi</h2><div className="export-actions"><a href="/api/export?format=json" className="text-button" download><Icon name="download" size={16} />JSON</a><a href="/api/export?format=csv" className="text-button" download><Icon name="download" size={16} />CSV</a><button className="text-button" onClick={() => void load()}>Perbarui</button></div></div>{error && <ErrorNotice message={error} retry={() => void load()} />}{!stats && !error && <Loading label="Membaca catatan evaluasi…" />}{stats && <><div className="stats-grid"><div><span>KARTU AI</span><strong>{stats.totalCards - stats.demoCards}</strong><p>Tersimpan di pustaka</p></div><div><span>SUDAH DINILAI</span><strong>{stats.evaluatedCards}</strong><p>Evaluasi pribadi pada kartu AI</p></div><div><span>KARTU DEMO</span><strong>{stats.demoCards}</strong><p>Dikecualikan dari statistik model</p></div></div><div className="table-wrap"><table className="stats-table"><caption>Perbandingan model — demo dikecualikan</caption><thead><tr><th scope="col">Provider / model</th><th scope="col">Kartu</th><th scope="col">Dinilai</th><th scope="col">Baik</th><th scope="col">Masalah</th><th scope="col">Proporsi baik</th><th scope="col">Percobaan gagal</th><th scope="col">Durasi rata-rata</th></tr></thead><tbody>{stats.models.length ? stats.models.map(model => <tr key={`${model.provider}-${model.model}`}><th scope="row"><strong>{model.model}</strong><small>{model.provider}</small></th><td>{model.cards}</td><td>{model.evaluated}</td><td className="good-text">{model.good}</td><td className="bad-text">{model.bad}</td><td>{model.approvalRate === null ? '—' : `${Math.round(model.approvalRate * 100)}%`}</td><td>{model.failures} / {model.attempts}</td><td>{formatDuration(model.averageDurationMs)}</td></tr>) : <tr><td colSpan={8} className="table-empty">Statistik model muncul setelah Anda menjalankan generasi AI.</td></tr>}</tbody></table></div><p className="data-note">Proporsi baik = kartu dinilai baik ÷ seluruh kartu yang sudah dinilai, per model. Kartu belum dinilai tidak masuk pembagi. Durasi dan kegagalan berasal dari percobaan provider.</p></>}<div className="evaluation-feed"><Feed evaluation /></div></>;
}

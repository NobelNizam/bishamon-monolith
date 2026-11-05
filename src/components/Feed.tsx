'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card } from '@/lib/types';
import { api, errorMessage } from '@/lib/client';
import { useApp } from './AppProvider';
import { KnowledgeCard } from './KnowledgeCard';
import { EmptyState, ErrorNotice, Loading } from './Feedback';
import { Icon } from './Icon';

type CardsResponse = { data: Card[]; nextCursor: string | null };
export function Feed({ saved = false, evaluation = false }: { saved?: boolean; evaluation?: boolean }) {
  const { domains, revision } = useApp();
  const [cards, setCards] = useState<Card[]>([]);
  const [domain, setDomain] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rating, setRating] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const queryString = useCallback(() => {
    const params = new URLSearchParams({ limit: '12' });
    if (domain) params.set('domain', domain);
    if (query) params.set('q', query);
    if (saved) params.set('bookmarked', '1');
    if (rating) params.set('rating', rating);
    return params;
  }, [domain, query, saved, rating]);
  const load = useCallback(async () => {
    const id = ++request.current; setLoading(true); setError(''); setCursor(null);
    try { const result = await api<CardsResponse>(`/api/cards?${queryString()}`); if (request.current === id) { setCards(result.data); setCursor(result.nextCursor); } }
    catch (failure) { if (request.current === id) setError(errorMessage(failure)); }
    finally { if (request.current === id) setLoading(false); }
  }, [queryString]);
  useEffect(() => { void load(); return () => { request.current++; }; }, [load, revision]);
  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    const id = request.current; const params = queryString(); params.set('cursor', cursor); setLoadingMore(true); setError('');
    try { const result = await api<CardsResponse>(`/api/cards?${params}`); if (request.current === id) { setCards(current => [...current, ...result.data.filter(card => !current.some(existing => existing.id === card.id))]); setCursor(result.nextCursor); } }
    catch (failure) { if (request.current === id) setError(errorMessage(failure)); }
    finally { setLoadingMore(false); }
  }, [cursor, loadingMore, queryString]);
  useEffect(() => {
    if (!cursor || loading || loadingMore || error || !sentinel.current) return;
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) void loadMore(); }, { rootMargin: '250px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [cursor, loading, loadingMore, error, loadMore]);
  function update(card: Card) { setCards(current => current.map(item => item.id === card.id ? card : item).filter(item => (!saved || item.bookmarked) && (!rating || (rating === 'unrated' ? !item.evaluation : item.evaluation?.rating === rating)))); }
  const rootDomains = domains.filter(item => !item.parentId);
  return <><section className={`page-heading ${!saved && !evaluation ? 'feed-heading' : ''}`}><div><span className="eyebrow">{saved ? 'Pustaka pilihan' : evaluation ? 'Tinjauan kartu' : 'Wise scrolling'}</span><h1>{saved ? <>Ilmu yang ingin<br />Anda kunjungi lagi.</> : evaluation ? 'Catatan penilaian Anda.' : <>Rawat rasa<br /><em>ingin tahu.</em></>}</h1><p>{saved ? 'Simpan gagasan yang berharga. Buka kembali saat Anda membutuhkannya.' : evaluation ? 'Baca kembali kartu dan perbaiki penilaian Anda kapan saja.' : 'Satu gagasan membawa Anda lebih jauh. Jelajahi pengetahuan, renungkan, lalu temukan perspektif baru.'}</p></div>{!saved && !evaluation && <div className="hero-emblem" aria-hidden="true"><span className="emblem-line" /><span className="emblem-character">知</span><span className="emblem-caption">Belajar dengan sadar</span><span className="emblem-stamp">日々<br />学ぶ</span></div>}</section><section className="feed-section" aria-label={saved ? 'Kartu simpanan' : 'Daftar pengetahuan'}><div className="section-heading"><h2>{saved ? 'Simpanan Anda' : evaluation ? 'Semua kartu' : 'Lembar pengetahuan'}</h2><span className="section-subtitle">{saved ? 'Dipilih dengan sadar' : 'Baca · Renungkan · Pahami'}</span></div><div className="feed-toolbar"><form className="search-field" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); }} role="search"><Icon name="search" size={18} /><input aria-label="Cari kartu pengetahuan" placeholder="Cari gagasan, topik, atau kata kunci…" value={search} onChange={event => setSearch(event.target.value)} /><button type="submit" aria-label="Jalankan pencarian"><Icon name="arrow" size={17} /></button></form><select aria-label="Filter bidang pengetahuan" value={domain} onChange={event => setDomain(event.target.value)}><option value="">Semua bidang</option>{domains.map(item => <option key={item.id} value={item.id}>{item.parentId ? '↳ ' : ''}{item.name}</option>)}</select><select aria-label="Filter penilaian" value={rating} onChange={event => setRating(event.target.value)}><option value="">Semua penilaian</option><option value="good">Dinilai baik</option><option value="bad">Bermasalah</option><option value="unrated">Belum dinilai</option></select></div>{!saved && !evaluation && <div className="domain-tabs" aria-label="Bidang utama"><button className={!domain ? 'active' : ''} onClick={() => setDomain('')}>Semua bidang</button>{rootDomains.map(item => <button key={item.id} onClick={() => setDomain(item.id)} className={domain === item.id ? 'active' : ''}>{item.name}</button>)}</div>}{query && <div className="search-summary">Hasil untuk “{query}”<button className="text-button" onClick={() => { setQuery(''); setSearch(''); }}>Hapus pencarian <Icon name="close" size={14} /></button></div>}{error && <ErrorNotice message={error} retry={() => void load()} />}{loading ? <Loading /> : cards.length ? <><div className="card-grid">{cards.map((card, index) => <KnowledgeCard key={card.id} card={card} featured={!saved && !evaluation && index === 0} onUpdate={update} />)}</div><div className="feed-end" ref={sentinel}>{cursor ? <button className="button button-outline" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Membuka lembar berikutnya…' : 'Buka lebih banyak'}<Icon name="arrow" size={17} /></button> : <><p>Anda telah sampai di lembar terakhir.<br /><span>Luangkan sejenak untuk mencerna yang baru Anda baca.</span></p></>}</div></> : !error && <EmptyState title={saved ? 'Pustaka pilihan Anda dimulai di sini.' : 'Belum ada lembar yang cocok.'}>{saved ? 'Tekan ikon simpan pada kartu untuk menemukannya kembali di sini.' : 'Coba bidang atau kata kunci lain, atau buat kartu pengetahuan pertama Anda.'}</EmptyState>}</section></>;
}

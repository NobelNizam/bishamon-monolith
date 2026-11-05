'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Card } from '@/lib/types';
import { api, cardLabels, errorMessage, formatDate, safeUrl } from '@/lib/client';
import { CardActions } from './KnowledgeCard';
import { ErrorNotice, Loading } from './Feedback';
import { Markdown } from './Markdown';
import { Icon } from './Icon';

const sourceOrigins = { arxiv: 'Ditemukan di arXiv', model: 'Disarankan model', demo: 'Contoh demo' };
export function CardReader({ id }: { id: string }) {
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setError(''); try { setCard(await api<Card>(`/api/cards/${encodeURIComponent(id)}`)); } catch (failure) { setError(errorMessage(failure)); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (!card) return error ? <ErrorNotice message={error} retry={() => void load()} /> : <Loading />;
  return <article className="reader"><Link href="/" className="back-link"><Icon name="arrow" size={17} />Kembali ke pengetahuan</Link><header className="reader-header"><div className="card-kicker"><span className="domain-label">{card.domainName}</span><span className="type-label">{cardLabels[card.type]}</span></div><h1>{card.title}</h1><p className="reader-abstract">{card.abstract}</p><div className="reader-metadata"><span className={card.isDemo ? 'demo-label' : ''}>{card.isDemo ? 'DEMO · CONTOH LOKAL' : `${card.provider} / ${card.model}`}</span><span>{formatDate(card.createdAt)}</span><span>Prompt {card.promptVersion}</span></div></header>{card.isDemo && <div className="notice"><strong>Kartu demo</strong><p>Konten contoh untuk mencoba aplikasi, bukan hasil panggilan AI. Tidak disertakan dalam statistik model.</p></div>}<div className="reader-paper"><Markdown content={card.content} /><div className="reader-endmark" aria-hidden="true">知</div></div>{card.hashtags.length > 0 && <div className="hashtags">{card.hashtags.map(tag => <span key={tag}>#{tag}</span>)}</div>}<section className="sources-section" aria-labelledby="sources-title"><div className="section-heading"><h2 id="sources-title">Jejak referensi</h2><Icon name="book" size={19} /></div><p className="muted">Asal referensi ditampilkan agar dapat ditelusuri. Keberadaan sumber tidak menjamin setiap klaim dalam kartu benar.</p>{card.sources.length ? <ol className="source-list">{card.sources.map((source, index) => { const url = safeUrl(source.url); return <li key={`${source.url}-${index}`}><span className="source-number">{String(index + 1).padStart(2, '0')}</span><div><span className={`source-origin ${source.origin}`}>{sourceOrigins[source.origin]}</span><h3>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{source.title}<Icon name="arrow" size={15} /></a> : source.title}</h3>{source.authors.length > 0 && <p>{source.authors.join(', ')}</p>}{url && <span className="source-url">{new URL(url).hostname}</span>}</div></li>; })}</ol> : <div className="notice">Tidak ada referensi yang disertakan pada kartu ini.</div>}</section><section className="reader-evaluation"><h2>Pengetahuan layak ditinjau.</h2><p>Catat kualitas penjelasan ini untuk membantu Anda membandingkan hasil model.</p><CardActions card={card} onUpdate={setCard} />{card.evaluation && <div className="evaluation-note"><strong>{card.evaluation.reason}</strong>{card.evaluation.note && <p>{card.evaluation.note}</p>}<small>Diperbarui {formatDate(card.evaluation.updatedAt)}</small></div>}</section>{card.runId && <Link href="/history" className="text-button">Telusuri riwayat generasi <Icon name="arrow" size={16} /></Link>}</article>;
}

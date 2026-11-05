'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Card, Evaluation } from '@/lib/types';
import { api, cardLabels, errorMessage, formatDate } from '@/lib/client';
import { Icon } from './Icon';
import { EvaluationDialog } from './EvaluationDialog';
import { ErrorNotice } from './Feedback';

export function CardActions({ card, onUpdate }: { card: Card; onUpdate: (card: Card) => void }) {
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [initialRating, setInitialRating] = useState<Evaluation['rating']>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function bookmark() {
    setBusy(true); setError('');
    try { onUpdate(await api<Card>(`/api/cards/${card.id}/bookmark`, { method: 'PUT', body: JSON.stringify({ bookmarked: !card.bookmarked }) })); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  function evaluate(rating?: Evaluation['rating']) { setInitialRating(rating); setEvaluationOpen(true); }
  return <><div className="card-actions"><div className="rating-actions">{card.evaluation ? <button className={`text-button evaluation-status ${card.evaluation.rating}`} onClick={() => evaluate()}><Icon name={card.evaluation.rating} size={16} />{card.evaluation.rating === 'good' ? 'Dinilai baik' : 'Bermasalah'}<span>· Ubah</span></button> : <><span className="rate-label">Nilai kartu</span><button className="icon-button" aria-label={`Nilai baik: ${card.title}`} title="Baik" onClick={() => evaluate('good')}><Icon name="good" size={17} /></button><button className="icon-button" aria-label={`Nilai bermasalah: ${card.title}`} title="Bermasalah" onClick={() => evaluate('bad')}><Icon name="bad" size={17} /></button></>}</div><button className={`icon-button bookmark-button ${card.bookmarked ? 'is-bookmarked' : ''}`} onClick={() => void bookmark()} disabled={busy} aria-pressed={card.bookmarked} aria-label={card.bookmarked ? `Hapus simpanan: ${card.title}` : `Simpan: ${card.title}`} title={card.bookmarked ? 'Hapus dari simpanan' : 'Simpan kartu'}><Icon name="bookmark" size={19} /></button></div>{error && <ErrorNotice message={error} />}{evaluationOpen && <EvaluationDialog card={card} initialRating={initialRating} onUpdate={updated => { onUpdate(updated); window.dispatchEvent(new Event('evaluation-updated')); }} onClose={() => setEvaluationOpen(false)} />}</>;
}
export function KnowledgeCard({ card, featured = false, onUpdate }: { card: Card; featured?: boolean; onUpdate: (card: Card) => void }) {
  return <article className={`knowledge-card ${featured ? 'featured-card' : ''}`}><div className="card-body"><div className="card-kicker"><span className="domain-label">{card.domainName}</span><span className="type-label">{cardLabels[card.type]}</span></div><h2><Link href={`/cards/${card.id}`}>{card.title}</Link></h2><p className="card-abstract">{card.abstract}</p><div className="card-metadata"><span className={card.isDemo ? 'demo-label' : 'model-label'}>{card.isDemo ? 'DEMO · CONTOH LOKAL' : `${card.provider} / ${card.model}`}</span><span>{formatDate(card.createdAt)}</span></div>{featured && <Link className="read-link" href={`/cards/${card.id}`}>Buka lembar pengetahuan <Icon name="arrow" size={18} /></Link>}</div>{featured && <div className="card-illustration" aria-hidden="true"><svg viewBox="0 0 260 230" fill="none"><circle cx="130" cy="115" r="80" /><circle cx="130" cy="115" r="53" /><circle cx="130" cy="115" r="25" /><ellipse cx="130" cy="115" rx="107" ry="35" transform="rotate(-35 130 115)" /><path d="M23 183 237 47M25 115h210M130 10v210" strokeDasharray="3 6" /><circle className="orbit-point" cx="192" cy="65" r="7" /><circle className="orbit-point" cx="80" cy="177" r="5" /></svg><span>探求</span><small>THE BEAUTY OF UNDERSTANDING</small></div>}<CardActions card={card} onUpdate={onUpdate} /></article>;
}

'use client';

import { useState } from 'react';
import type { Card, Evaluation } from '@/lib/types';
import { api, errorMessage } from '@/lib/client';
import { Modal } from './Modal';
import { ErrorNotice } from './Feedback';
import { Icon } from './Icon';

const reasons = ['Akurat dan mudah dipahami', 'Penjelasan bermanfaat', 'Referensi relevan', 'Klaim tidak akurat', 'Referensi bermasalah', 'Kurang jelas atau kurang lengkap', 'Tidak sesuai topik', 'Lainnya'];
export function EvaluationDialog({ card, initialRating, onClose, onUpdate }: { card: Card; initialRating?: Evaluation['rating']; onClose: () => void; onUpdate: (card: Card) => void }) {
  const [rating, setRating] = useState<Evaluation['rating']>(initialRating || card.evaluation?.rating || 'good');
  const [reason, setReason] = useState(card.evaluation?.reason || '');
  const [note, setNote] = useState(card.evaluation?.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { onUpdate(await api<Card>(`/api/cards/${card.id}/evaluation`, { method: 'PUT', body: JSON.stringify({ rating, reason: reason.trim(), note: note.trim() }) })); onClose(); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError('');
    try { onUpdate(await api<Card>(`/api/cards/${card.id}/evaluation`, { method: 'DELETE' })); onClose(); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <Modal title="Bagaimana kualitas kartu ini?" onClose={onClose} busy={busy}><form onSubmit={save} className="stack-form"><p className="muted">{card.title}</p>{card.isDemo && <div className="notice">Ini kartu demo. Penilaian disimpan, tetapi dikecualikan dari statistik model AI.</div>}<fieldset className="rating-options"><legend>Penilaian pribadi</legend><label className={rating === 'good' ? 'selected good' : ''}><input type="radio" name="rating" value="good" checked={rating === 'good'} onChange={() => setRating('good')} disabled={busy} /><Icon name="good" /><span>Baik</span></label><label className={rating === 'bad' ? 'selected bad' : ''}><input type="radio" name="rating" value="bad" checked={rating === 'bad'} onChange={() => setRating('bad')} disabled={busy} /><Icon name="bad" /><span>Bermasalah</span></label></fieldset><label>Alasan<select value={reason} onChange={event => setReason(event.target.value)} required disabled={busy}><option value="">Pilih alasan penilaian</option>{reason && !reasons.includes(reason) && <option value={reason}>{reason}</option>}{reasons.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label>Catatan <span className="optional">opsional</span><textarea rows={4} value={note} onChange={event => setNote(event.target.value)} placeholder="Bagian mana yang membantu atau perlu diperbaiki?" maxLength={4000} disabled={busy} /></label>{error && <ErrorNotice message={error} />}<div className="modal-actions">{card.evaluation && <button className="text-button danger" type="button" onClick={() => void remove()} disabled={busy}>Hapus penilaian</button>}<button type="button" className="button button-quiet" onClick={onClose} disabled={busy}>Batal</button><button className="button button-primary" disabled={busy || !reason}>{busy ? 'Menyimpan…' : card.evaluation ? 'Perbarui penilaian' : 'Simpan penilaian'}</button></div></form></Modal>;
}

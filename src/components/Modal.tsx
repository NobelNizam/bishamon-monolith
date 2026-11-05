'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); active?.focus(); };
  }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}><div className="modal-inner"><header className="modal-header"><div><span className="eyebrow">Bishamon / Ruang kerja</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="Tutup dialog" onClick={onClose} disabled={busy}><Icon name="close" /></button></header>{children}</div></dialog>;
}

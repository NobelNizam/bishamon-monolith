import Link from 'next/link';
export default function NotFound() { return <div className="empty-state"><span className="eyebrow">404 / LEMBAR TIDAK DITEMUKAN</span><h1>Lembar ini belum ada.</h1><p>Kembali ke pustaka untuk menemukan gagasan lainnya.</p><Link href="/" className="button button-primary">Kembali ke pengetahuan</Link></div>; }

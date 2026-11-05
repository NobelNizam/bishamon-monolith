export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(payload.error || 'Permintaan tidak berhasil. Coba kembali.', response.status);
  }
  return payload as T;
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Terjadi kesalahan. Coba kembali.';
export const formatDate = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value));
export const formatDuration = (value: number | null) => value === null ? '—' : value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} dtk`;
export const cardLabels = { ARTICLE: 'Artikel', FLASHCARD: 'Kartu ingatan', EXPLAINER: 'Penjelasan', THREAD: 'Utas' };
export function safeUrl(value: string): string | undefined {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { listCards } from '../../../lib/repository.ts';
import { authorize, json, jsonError, handleError } from '../../../lib/http.ts';
export function GET(request: Request): Response {
  const rejected = authorize(request); if (rejected) return rejected;
  const params = new URL(request.url).searchParams;
  const rating = params.get('rating');
  const limit = params.get('limit') ?? '12';
  if (rating && !['good', 'bad', 'unrated'].includes(rating)) return jsonError('Filter penilaian tidak valid.', 400);
  if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100) return jsonError('Limit harus antara 1 dan 100.', 400);
  if ((params.get('q')?.length ?? 0) > 500 || (params.get('cursor')?.length ?? 0) > 1000) return jsonError('Filter terlalu panjang.', 400);
  try { return json(listCards({ domain: params.get('domain') || undefined, q: params.get('q')?.trim() || undefined,
    bookmarked: params.get('bookmarked') === '1', rating: rating as 'good' | 'bad' | 'unrated' | undefined || undefined,
    cursor: params.get('cursor') || undefined, limit: Number(limit) })); }
  catch (error) { return error instanceof Error && error.message === 'Cursor tidak valid.' ? jsonError(error.message, 400) : handleError(error); }
}

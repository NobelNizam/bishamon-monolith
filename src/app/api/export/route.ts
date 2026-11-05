export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { allCards, exportCsv } from '../../../lib/repository.ts';
import { authorize, jsonError, handleError } from '../../../lib/http.ts';
export function GET(request: Request): Response {
  const rejected = authorize(request); if (rejected) return rejected;
  const format = new URL(request.url).searchParams.get('format') ?? 'json';
  if (!['json', 'csv'].includes(format)) return jsonError('Format ekspor harus json atau csv.', 400);
  try {
    const cards = allCards();
    const body = format === 'csv' ? exportCsv(cards) : JSON.stringify({ exportedAt: new Date().toISOString(), cards }, null, 2);
    return new Response(body, { headers: { 'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="bishamon-evaluasi.${format}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return handleError(error); }
}

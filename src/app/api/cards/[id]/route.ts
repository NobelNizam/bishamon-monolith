export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getCard } from '../../../../lib/repository.ts';
import { authorize, json, jsonError, handleError } from '../../../../lib/http.ts';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const rejected = authorize(request); if (rejected) return rejected;
  try { const card = getCard((await context.params).id); return card ? json(card) : jsonError('Kartu tidak ditemukan.', 404); }
  catch (error) { return handleError(error); }
}

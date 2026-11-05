export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { setEvaluation, deleteEvaluation } from '../../../../../lib/repository.ts';
import { authorize, json, jsonError, handleError, readJson, isObject } from '../../../../../lib/http.ts';
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context): Promise<Response> {
  const rejected = authorize(request, true); if (rejected) return rejected;
  let input: unknown;
  try { input = await readJson(request); } catch (error) { return jsonError((error as Error).message, 400); }
  if (!isObject(input) || (input.rating !== 'good' && input.rating !== 'bad') || typeof input.reason !== 'string' || input.reason.length > 200 || typeof input.note !== 'string' || input.note.length > 5000)
    return jsonError('Penilaian tidak valid. Alasan maksimal 200 karakter dan catatan maksimal 5000 karakter.', 400);
  try { const card = setEvaluation((await context.params).id, { rating: input.rating, reason: input.reason.trim(), note: input.note.trim() });
    return card ? json(card) : jsonError('Kartu tidak ditemukan.', 404); }
  catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, context: Context): Promise<Response> {
  const rejected = authorize(request, true); if (rejected) return rejected;
  try { const card = deleteEvaluation((await context.params).id); return card ? json(card) : jsonError('Kartu tidak ditemukan.', 404); }
  catch (error) { return handleError(error); }
}

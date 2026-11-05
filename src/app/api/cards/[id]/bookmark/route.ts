export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { setBookmark } from '../../../../../lib/repository.ts';
import { authorize, json, jsonError, handleError, readJson, isObject } from '../../../../../lib/http.ts';
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const rejected = authorize(request, true); if (rejected) return rejected;
  let input: unknown;
  try { input = await readJson(request); } catch (error) { return jsonError((error as Error).message, 400); }
  if (!isObject(input) || typeof input.bookmarked !== 'boolean') return jsonError('bookmarked harus berupa boolean.', 400);
  try { const card = setBookmark((await context.params).id, input.bookmarked); return card ? json(card) : jsonError('Kartu tidak ditemukan.', 404); }
  catch (error) { return handleError(error); }
}

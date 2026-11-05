import { generateCard, GenerationError } from '../../../lib/ai/generation.ts';
import { authorize, jsonError, readJson } from '../../../lib/http.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Three provider attempts plus one bounded arXiv retrieval; deployment must allow this duration.
export const maxDuration = 600;

async function readInput(request: Request): Promise<unknown> {
  try { return await readJson(request); }
  catch { throw new GenerationError('Gunakan body application/json yang valid dengan ukuran maksimal 16 KiB.', 400); }
}

export async function POST(request: Request) {
  const denied = authorize(request, true);
  if (denied) return denied;
  try {
    return Response.json(await generateCard(await readInput(request)), { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return error instanceof GenerationError ? jsonError(error.message, error.status) : jsonError('Generasi tidak dapat diselesaikan.', 500);
  }
}

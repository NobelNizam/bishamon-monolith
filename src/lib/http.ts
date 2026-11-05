import { authRequired, isAuthenticated, isLoopback } from './auth.ts';

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function sameOrigin(request: Request): Response | null {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (!origin || origin !== expected || request.headers.get('sec-fetch-site') === 'cross-site')
    return jsonError('Permintaan harus berasal dari aplikasi yang sama.', 403);
  return null;
}
export function authorize(request: Request, mutation = false): Response | null {
  if (mutation) { const rejected = sameOrigin(request); if (rejected) return rejected; }
  if (authRequired()) return isAuthenticated(request) ? null : jsonError('Masuk dengan kata sandi pemilik terlebih dahulu.', 401);
  if (!isLoopback(new URL(request.url).hostname)) return jsonError('Atur APP_PASSWORD sebelum membuka akses jaringan.', 403);
  return null;
}
export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('Gunakan Content-Type application/json.');
  if (Number(request.headers.get('content-length')) > 16384) throw new Error('Isi permintaan terlalu besar.');
  // Bound even chunked input without relying on an optional Content-Length.
  if (!request.body) throw new Error('Isi JSON diperlukan.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 16384) { await reader.cancel(); throw new Error('Isi permintaan terlalu besar.'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('JSON tidak valid.');
    throw error;
  } finally { reader.releaseLock(); }
}
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function handleError(error: unknown): Response {
  // Database, paths and upstream configuration must not leak through HTTP errors.
  console.error('Permintaan API gagal:', error instanceof Error ? error.name : 'UnknownError');
  return jsonError('Permintaan gagal diproses. Silakan coba lagi.', 500);
}

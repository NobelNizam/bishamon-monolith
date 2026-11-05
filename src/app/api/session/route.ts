export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { authRequired, isAuthenticated, createSessionToken, passwordMatches, sessionCookie, isLoopback } from '../../../lib/auth.ts';
import { json, jsonError, sameOrigin, readJson, isObject } from '../../../lib/http.ts';
let failed = 0;
let resetAt = 0;
export function GET(request: Request): Response {
  return json({ authenticated: authRequired() ? isAuthenticated(request) : isLoopback(new URL(request.url).hostname), authRequired: authRequired() });
}
export async function POST(request: Request): Promise<Response> {
  const rejected = sameOrigin(request); if (rejected) return rejected;
  if (!authRequired()) return isLoopback(new URL(request.url).hostname) ? json({ authenticated: true }) : jsonError('Atur APP_PASSWORD sebelum membuka akses jaringan.', 403);
  const at = Date.now();
  if (at > resetAt) { failed = 0; resetAt = at + 60_000; }
  if (failed >= 10) return jsonError('Terlalu banyak percobaan. Coba lagi dalam satu menit.', 429);
  let input: unknown;
  try { input = await readJson(request); } catch (error) { return jsonError((error as Error).message, 400); }
  if (!isObject(input) || typeof input.password !== 'string' || input.password.length > 1000) return jsonError('Kata sandi tidak valid.', 400);
  if (!passwordMatches(input.password)) { failed++; return jsonError('Kata sandi salah.', 401); }
  failed = 0;
  const response = json({ authenticated: true });
  response.headers.set('Set-Cookie', sessionCookie(request, createSessionToken()));
  return response;
}
export function DELETE(request: Request): Response {
  const rejected = sameOrigin(request); if (rejected) return rejected;
  const response = json({ authenticated: false });
  response.headers.set('Set-Cookie', sessionCookie(request, null));
  response.headers.set('Clear-Site-Data', '"cache", "cookies", "storage"');
  return response;
}

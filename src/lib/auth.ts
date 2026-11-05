import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'bishamon_owner';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export function authRequired(): boolean { return Boolean(process.env.APP_PASSWORD); }
function signingKey(): Buffer {
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error('Kata sandi pemilik belum diatur.');
  return createHmac('sha256', password).update(process.env.SESSION_SECRET || 'bishamon-owner-session-v1').digest();
}
export function passwordMatches(candidate: string): boolean {
  if (!authRequired()) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(candidate), digest(process.env.APP_PASSWORD!));
}
export function createSessionToken(at = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ issued: at, expires: at + SESSION_TTL_SECONDS * 1000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${payload}.${createHmac('sha256', signingKey()).update(payload).digest('base64url')}`;
}
export function verifySessionToken(token: string, at = Date.now()): boolean {
  if (!authRequired() || token.length > 1000) return false;
  try {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return false;
    const expected = createHmac('sha256', signingKey()).update(payload).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof value.issued === 'number' && typeof value.expires === 'number' && value.issued <= at && value.expires > at && value.expires - value.issued <= SESSION_TTL_SECONDS * 1000;
  } catch { return false; }
}
export function isAuthenticated(request: Request): boolean {
  const token = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
  return Boolean(token && verifySessionToken(token));
}
export function sessionCookie(request: Request, token: string | null): string {
  const secure = new URL(request.url).protocol === 'https:' || process.env.COOKIE_SECURE === 'true';
  return `${SESSION_COOKIE}=${token ?? ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? SESSION_TTL_SECONDS : 0}${secure ? '; Secure' : ''}`;
}
export function isLoopback(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname.toLowerCase());
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getStats } from '../../../lib/repository.ts';
import { authorize, json, handleError } from '../../../lib/http.ts';
export function GET(request: Request): Response {
  const rejected = authorize(request); if (rejected) return rejected;
  try { return json(getStats()); } catch (error) { return handleError(error); }
}

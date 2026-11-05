export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getAppConfig } from '../../../lib/ai/config.ts';
import { authorize, json, handleError } from '../../../lib/http.ts';
export function GET(request: Request): Response {
  const rejected = authorize(request); if (rejected) return rejected;
  try { return json(getAppConfig()); } catch (error) { return handleError(error); }
}

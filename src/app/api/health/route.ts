export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getDatabase } from '../../../lib/database.ts';
import { json, jsonError } from '../../../lib/http.ts';
export function GET(): Response {
  try { getDatabase().prepare('SELECT 1').get(); return json({ status: 'ok', database: 'ok' }); }
  catch { return jsonError('Database tidak tersedia.', 503); }
}

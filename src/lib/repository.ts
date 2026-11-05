import { randomUUID } from 'node:crypto';
import type { SQLInputValue } from 'node:sqlite';
import { getDatabase } from './database.ts';
import type { Attempt, Card, Domain, Evaluation, GenerationRun, ModelStats, Provider } from './types.ts';

type Row = Record<string, string | number | null>;
const now = () => new Date().toISOString();
const cardSelect = `SELECT c.*,d.name AS domain_name,e.rating,e.reason,e.note,e.updated_at AS evaluated_at
  FROM cards c JOIN domains d ON d.id=c.domain_id LEFT JOIN evaluations e ON e.card_id=c.id`;

function mapDomain(row: Row): Domain {
  return { id: String(row.id), slug: String(row.slug), name: String(row.name), description: String(row.description), parentId: row.parent_id as string | null };
}
function mapCard(row: Row): Card {
  return {
    id: String(row.id), slug: String(row.slug), title: String(row.title), content: String(row.content),
    abstract: String(row.abstract), type: row.type as Card['type'], domainId: String(row.domain_id),
    domainName: String(row.domain_name), provider: row.provider as Provider, model: String(row.model),
    promptVersion: String(row.prompt_version), isDemo: Boolean(row.is_demo), createdAt: String(row.created_at),
    bookmarked: Boolean(row.bookmarked), sources: JSON.parse(String(row.sources)), hashtags: JSON.parse(String(row.hashtags)),
    runId: row.run_id as string | null,
    evaluation: row.rating ? { rating: row.rating as Evaluation['rating'], reason: String(row.reason), note: String(row.note), updatedAt: String(row.evaluated_at) } : null,
  };
}
function mapAttempt(row: Row): Attempt {
  return { id: String(row.id), runId: String(row.run_id), provider: row.provider as Provider, model: String(row.model),
    status: row.status as Attempt['status'], durationMs: Number(row.duration_ms), inputTokens: row.input_tokens as number | null,
    outputTokens: row.output_tokens as number | null, error: row.error as string | null, createdAt: String(row.created_at) };
}

export function listDomains(): Domain[] {
  return (getDatabase().prepare('SELECT * FROM domains ORDER BY name').all() as Row[]).map(mapDomain);
}
export function getDomain(id: string): Domain | null {
  const row = getDatabase().prepare('SELECT * FROM domains WHERE id=? OR slug=?').get(id, id) as Row | undefined;
  return row ? mapDomain(row) : null;
}
export function getCard(id: string): Card | null {
  const row = getDatabase().prepare(`${cardSelect} WHERE c.id=? OR c.slug=?`).get(id, id) as Row | undefined;
  return row ? mapCard(row) : null;
}

export interface CardFilters { domain?: string; q?: string; bookmarked?: boolean; rating?: 'good' | 'bad' | 'unrated'; cursor?: string; limit?: number }
export function listCards(filters: CardFilters = {}): { data: Card[]; nextCursor: string | null } {
  const conditions: string[] = [];
  const params: SQLInputValue[] = [];
  const limit = Math.max(1, Math.min(100, Math.trunc(filters.limit ?? 12)));
  if (filters.domain) {
    conditions.push(`c.domain_id IN (WITH RECURSIVE subtree(id) AS (
      SELECT id FROM domains WHERE id=? OR slug=? UNION ALL SELECT d.id FROM domains d JOIN subtree s ON d.parent_id=s.id
    ) SELECT id FROM subtree)`);
    params.push(filters.domain, filters.domain);
  }
  if (filters.q) {
    const q = '%' + filters.q.replace(/[\\%_]/g, '\\$&') + '%';
    conditions.push("(c.title LIKE ? ESCAPE '\\' OR c.abstract LIKE ? ESCAPE '\\' OR c.content LIKE ? ESCAPE '\\')");
    params.push(q, q, q);
  }
  if (filters.bookmarked) conditions.push('c.bookmarked=1');
  if (filters.rating === 'unrated') conditions.push('e.card_id IS NULL');
  else if (filters.rating) { conditions.push('e.rating=?'); params.push(filters.rating); }
  if (filters.cursor) {
    let cursor: unknown;
    try { cursor = JSON.parse(Buffer.from(filters.cursor, 'base64url').toString('utf8')); }
    catch { throw new Error('Cursor tidak valid.'); }
    if (!Array.isArray(cursor) || cursor.length !== 2 || cursor.some(v => typeof v !== 'string') || !Number.isFinite(Date.parse(cursor[0])) || cursor[1].length > 100)
      throw new Error('Cursor tidak valid.');
    conditions.push('(c.created_at < ? OR (c.created_at = ? AND c.id < ?))');
    params.push(cursor[0], cursor[0], cursor[1]);
  }
  const rows = getDatabase().prepare(`${cardSelect} ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''} ORDER BY c.created_at DESC,c.id DESC LIMIT ?`).all(...params, limit + 1) as Row[];
  const data = rows.slice(0, limit).map(mapCard);
  const last = data.at(-1);
  return { data, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify([last.createdAt, last.id])).toString('base64url') : null };
}
export function allCards(): Card[] {
  return (getDatabase().prepare(`${cardSelect} ORDER BY c.created_at DESC,c.id DESC`).all() as Row[]).map(mapCard);
}
export function createCard(input: Omit<Card, 'id' | 'slug' | 'createdAt' | 'domainName' | 'bookmarked' | 'evaluation'>): Card {
  const id = randomUUID();
  const prefix = input.title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'kartu';
  getDatabase().prepare(`INSERT INTO cards(id,slug,title,content,abstract,type,domain_id,provider,model,prompt_version,is_demo,created_at,sources,hashtags,run_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, `${prefix}-${id}`, input.title, input.content, input.abstract, input.type,
    input.domainId, input.provider, input.model, input.promptVersion, Number(input.isDemo || input.provider === 'demo'), now(), JSON.stringify(input.sources), JSON.stringify(input.hashtags), input.runId);
  return getCard(id)!;
}
export function setBookmark(id: string, bookmarked: boolean): Card | null {
  const card = getCard(id);
  if (!card) return null;
  getDatabase().prepare('UPDATE cards SET bookmarked=? WHERE id=?').run(Number(bookmarked), card.id);
  return getCard(card.id);
}
export function setEvaluation(id: string, evaluation: Pick<Evaluation, 'rating' | 'reason' | 'note'>): Card | null {
  const card = getCard(id);
  if (!card) return null;
  getDatabase().prepare(`INSERT INTO evaluations(card_id,rating,reason,note,updated_at) VALUES (?,?,?,?,?)
    ON CONFLICT(card_id) DO UPDATE SET rating=excluded.rating,reason=excluded.reason,note=excluded.note,updated_at=excluded.updated_at`)
    .run(card.id, evaluation.rating, evaluation.reason, evaluation.note, now());
  return getCard(card.id);
}
export function deleteEvaluation(id: string): Card | null {
  const card = getCard(id);
  if (!card) return null;
  getDatabase().prepare('DELETE FROM evaluations WHERE card_id=?').run(card.id);
  return getCard(card.id);
}

export function getRun(id: string): GenerationRun | null {
  const row = getDatabase().prepare('SELECT * FROM runs WHERE id=?').get(id) as Row | undefined;
  if (!row) return null;
  const attempts = (getDatabase().prepare('SELECT * FROM attempts WHERE run_id=? ORDER BY created_at,id').all(id) as Row[]).map(mapAttempt);
  return { id: String(row.id), domainId: String(row.domain_id), topic: String(row.topic), provider: row.provider as Provider,
    model: String(row.model), status: row.status as GenerationRun['status'], promptVersion: String(row.prompt_version), prompt: String(row.prompt),
    useRag: Boolean(row.use_rag), startedAt: String(row.started_at), finishedAt: row.finished_at as string | null,
    durationMs: row.duration_ms as number | null, error: row.error as string | null, cardId: row.card_id as string | null, attempts };
}
export function listRuns(): GenerationRun[] {
  return (getDatabase().prepare('SELECT id FROM runs ORDER BY started_at DESC,id DESC LIMIT 100').all() as Row[]).map(r => getRun(String(r.id))!);
}
export function createRun(input: Omit<GenerationRun, 'id' | 'startedAt' | 'finishedAt' | 'durationMs' | 'error' | 'cardId' | 'attempts'>): GenerationRun {
  const id = randomUUID();
  getDatabase().prepare(`INSERT INTO runs(id,domain_id,topic,provider,model,status,prompt_version,prompt,use_rag,started_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, input.domainId, input.topic, input.provider, input.model, input.status, input.promptVersion, input.prompt, Number(input.useRag), now());
  return getRun(id)!;
}
export function finishRun(id: string, patch: { status: 'completed' | 'failed' | 'interrupted'; provider?: Provider; model?: string; durationMs: number; error?: string | null; cardId?: string | null }): GenerationRun {
  const run = getRun(id);
  if (!run) throw new Error('Generasi tidak ditemukan.');
  getDatabase().prepare('UPDATE runs SET status=?,provider=?,model=?,duration_ms=?,error=?,card_id=?,finished_at=? WHERE id=?')
    .run(patch.status, patch.provider ?? run.provider, patch.model ?? run.model, patch.durationMs, patch.error ?? null, patch.cardId ?? null, now(), id);
  return getRun(id)!;
}
export function updateRunPrompt(id: string, prompt: string): GenerationRun {
  const result = getDatabase().prepare("UPDATE runs SET prompt=? WHERE id=? AND status='running'").run(prompt, id);
  if (!result.changes) throw new Error('Generasi aktif tidak ditemukan.');
  return getRun(id)!;
}
export function addAttempt(input: Omit<Attempt, 'id' | 'createdAt'>): Attempt {
  const attempt = { ...input, id: randomUUID(), createdAt: now() };
  getDatabase().prepare('INSERT INTO attempts(id,run_id,provider,model,status,duration_ms,input_tokens,output_tokens,error,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(attempt.id, input.runId, input.provider, input.model, input.status, input.durationMs, input.inputTokens, input.outputTokens, input.error, attempt.createdAt);
  return attempt;
}

export function getStats(): { models: ModelStats[]; totalCards: number; demoCards: number; evaluatedCards: number } {
  const db = getDatabase();
  const summary = db.prepare(`SELECT COUNT(*) AS total, SUM(is_demo) AS demo,
    SUM(CASE WHEN is_demo=0 AND EXISTS(SELECT 1 FROM evaluations e WHERE e.card_id=c.id) THEN 1 ELSE 0 END) AS evaluated FROM cards c`).get() as Row;
  const cards = db.prepare(`SELECT c.provider,c.model,COUNT(*) AS cards,COUNT(e.card_id) AS evaluated,
    SUM(CASE WHEN e.rating='good' THEN 1 ELSE 0 END) AS good,SUM(CASE WHEN e.rating='bad' THEN 1 ELSE 0 END) AS bad
    FROM cards c LEFT JOIN evaluations e ON e.card_id=c.id WHERE c.is_demo=0 AND c.provider!='demo' GROUP BY c.provider,c.model`).all() as Row[];
  const attempts = db.prepare(`SELECT provider,model,COUNT(*) AS attempts,SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failures,
    AVG(duration_ms) AS duration,COALESCE(SUM(input_tokens),0) AS input,COALESCE(SUM(output_tokens),0) AS output
    FROM attempts WHERE provider!='demo' GROUP BY provider,model`).all() as Row[];
  const models = new Map<string, ModelStats>();
  const get = (row: Row) => {
    const key = JSON.stringify([row.provider, row.model]);
    if (!models.has(key)) models.set(key, { provider: row.provider as Provider, model: String(row.model), cards: 0, evaluated: 0, good: 0, bad: 0,
      approvalRate: null, attempts: 0, failures: 0, averageDurationMs: null, inputTokens: 0, outputTokens: 0 });
    return models.get(key)!;
  };
  for (const row of cards) Object.assign(get(row), { cards: Number(row.cards), evaluated: Number(row.evaluated), good: Number(row.good), bad: Number(row.bad),
    approvalRate: Number(row.evaluated) ? Number(row.good) / Number(row.evaluated) : null });
  for (const row of attempts) Object.assign(get(row), { attempts: Number(row.attempts), failures: Number(row.failures), averageDurationMs: Number(row.duration), inputTokens: Number(row.input), outputTokens: Number(row.output) });
  return { models: [...models.values()].sort((a, b) => b.cards - a.cards || a.model.localeCompare(b.model)), totalCards: Number(summary.total), demoCards: Number(summary.demo ?? 0), evaluatedCards: Number(summary.evaluated ?? 0) };
}

export function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  const safe = /^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export function exportCsv(cards: Card[]): string {
  const columns = ['id','title','domain','type','provider','model','promptVersion','isDemo','createdAt','rating','reason','note','evaluatedAt','bookmarked','abstract','content','sources','hashtags','runId'];
  return '\uFEFF' + [columns, ...cards.map(c => [c.id,c.title,c.domainName,c.type,c.provider,c.model,c.promptVersion,c.isDemo,c.createdAt,c.evaluation?.rating,c.evaluation?.reason,c.evaluation?.note,c.evaluation?.updatedAt,c.bookmarked,c.abstract,c.content,JSON.stringify(c.sources),JSON.stringify(c.hashtags),c.runId])]
    .map(row => row.map(csvCell).join(',')).join('\r\n');
}

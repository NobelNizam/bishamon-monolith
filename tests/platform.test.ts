import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { closeDatabases, getDatabase, recoverInterruptedRuns } from '../src/lib/database.ts';
import { addAttempt, allCards, createCard, createRun, csvCell, deleteEvaluation, exportCsv, finishRun, getCard, getDomain, getRun, getStats, listCards, listDomains, listRuns, setBookmark, setEvaluation } from '../src/lib/repository.ts';
import { authRequired, createSessionToken, isAuthenticated, passwordMatches, SESSION_TTL_SECONDS, sessionCookie, verifySessionToken } from '../src/lib/auth.ts';
import { authorize, readJson } from '../src/lib/http.ts';

const temporary = mkdtempSync(join(tmpdir(), 'bishamon-platform-'));
let sequence = 0;
beforeEach(() => {
  closeDatabases();
  process.env.BISHAMON_DB_PATH = join(temporary, `${sequence++}.sqlite`);
  delete process.env.APP_PASSWORD;
  delete process.env.SESSION_SECRET;
  delete process.env.APP_ORIGIN;
  delete process.env.COOKIE_SECURE;
});
after(() => { closeDatabases(); rmSync(temporary, { recursive: true, force: true }); });

function card(title: string, overrides: Partial<Parameters<typeof createCard>[0]> = {}) {
  return createCard({ title, content: 'Isi pengetahuan yang dapat dibaca.', abstract: 'Abstrak ringkas.', type: 'ARTICLE', domainId: 'dom_logic',
    provider: 'openai', model: 'test-model', promptVersion: 'test-v1', isDemo: false, sources: [], hashtags: ['uji'], runId: null, ...overrides });
}
function run() {
  return createRun({ domainId: 'dom_logic', topic: 'Validitas argumen', provider: 'openai', model: 'test-model', status: 'running', promptVersion: 'test-v1', prompt: 'Buat kartu.', useRag: false });
}

test('schema, taxonomy and insert-only seed survive reopening without resetting feedback', () => {
  assert.equal(listDomains().length, 129);
  assert.equal(listDomains().filter(d => d.parentId === null).length, 8);
  assert.equal(getDomain('logika')?.id, 'dom_logic');
  assert.equal(allCards().length, 3);
  setBookmark('sample-logika', true);
  setEvaluation('sample-logika', { rating: 'good', reason: 'jelas', note: 'catatan tetap' });
  closeDatabases();
  assert.equal(allCards().length, 3);
  assert.equal(getCard('sample-logika')?.bookmarked, true);
  assert.equal(getCard('sample-logika')?.evaluation?.note, 'catatan tetap');
  const db = getDatabase();
  assert.equal(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys, 1);
  assert.equal(db.prepare('PRAGMA user_version').get()?.user_version, 1);
  assert.throws(() => card('Domain palsu', { domainId: 'missing-domain' }), /FOREIGN KEY/);
});

test('cursor pagination remains stable with equal timestamps and filters include descendants', () => {
  const a = card('Paginator a'); const b = card('Paginator b'); const c = card('Paginator c');
  getDatabase().prepare("UPDATE cards SET created_at='2026-10-29T12:00:00.000Z' WHERE provider='openai'").run();
  const first = listCards({ domain: 'formal-sciences', q: 'Paginator', limit: 2 });
  assert.equal(first.data.length, 2); assert.ok(first.nextCursor);
  const second = listCards({ domain: 'dom_formal_sciences', q: 'Paginator', limit: 2, cursor: first.nextCursor! });
  assert.equal(second.data.length, 1); assert.equal(second.nextCursor, null);
  assert.deepEqual(new Set([...first.data, ...second.data].map(v => v.id)), new Set([a.id, b.id, c.id]));
  setBookmark(a.slug, true);
  setEvaluation(b.id, { rating: 'bad', reason: 'sumber', note: 'Perlu telaah.' });
  assert.deepEqual(listCards({ bookmarked: true }).data.map(v => v.id), [a.id]);
  assert.deepEqual(listCards({ rating: 'bad' }).data.map(v => v.id), [b.id]);
  assert.equal(listCards({ rating: 'unrated', q: 'Paginator' }).data.length, 2);
  assert.equal(listCards({ domain: 'no-such-domain' }).data.length, 0);
  assert.throws(() => listCards({ cursor: 'garbage' }), /Cursor tidak valid/);
});

test('search treats wildcard and SQL-like strings literally', () => {
  const literal = card('Progres 100%_tepat');
  assert.deepEqual(listCards({ q: '100%_' }).data.map(v => v.id), [literal.id]);
  assert.equal(listCards({ q: "' OR 1=1 --" }).data.length, 0);
  assert.equal(listCards({ q: '%' }).data.length, 1);
});

test('evaluations update once per card, delete, and do not inflate model statistics', () => {
  const a = card('Hasil dinilai'); card('Belum dinilai');
  setEvaluation(a.id, { rating: 'bad', reason: 'fakta', note: 'awal' });
  setEvaluation(a.slug, { rating: 'good', reason: 'jelas', note: 'diperbarui' });
  setEvaluation('sample-logika', { rating: 'bad', reason: 'demo', note: '' });
  const stats = getStats();
  assert.equal(stats.totalCards, 5); assert.equal(stats.demoCards, 3); assert.equal(stats.evaluatedCards, 1);
  assert.equal(stats.models.length, 1);
  assert.deepEqual([stats.models[0].cards, stats.models[0].evaluated, stats.models[0].good, stats.models[0].bad, stats.models[0].approvalRate], [2, 1, 1, 0, 1]);
  assert.equal(getCard(a.id)?.evaluation?.note, 'diperbarui');
  assert.equal(deleteEvaluation(a.id)?.evaluation, null);
  assert.equal(getStats().models[0].approvalRate, null);
  assert.equal(setEvaluation('missing', { rating: 'good', reason: '', note: '' }), null);
});

test('actual provider attempts and nullable token usage aggregate separately from card ratings', () => {
  const generated = run();
  addAttempt({ runId: generated.id, provider: 'nvidia', model: 'fallback-a', status: 'failed', durationMs: 100, inputTokens: null, outputTokens: null, error: 'provider unavailable' });
  addAttempt({ runId: generated.id, provider: 'openai', model: 'test-model', status: 'completed', durationMs: 300, inputTokens: 20, outputTokens: 40, error: null });
  const result = card('Hasil fallback', { runId: generated.id });
  finishRun(generated.id, { status: 'completed', provider: 'openai', model: 'test-model', durationMs: 400, cardId: result.id });
  assert.equal(getRun(generated.id)?.attempts.length, 2);
  assert.equal(listRuns()[0].cardId, result.id);
  const stats = getStats();
  const failed = stats.models.find(m => m.provider === 'nvidia')!;
  assert.deepEqual([failed.cards, failed.attempts, failed.failures, failed.averageDurationMs, failed.inputTokens], [0, 1, 1, 100, 0]);
  const completed = stats.models.find(m => m.provider === 'openai')!;
  assert.equal(completed.inputTokens, 20); assert.equal(completed.outputTokens, 40);
});

test('opening database connections cannot interrupt a run; recovery is explicit', () => {
  const generated = run();
  closeDatabases();
  assert.equal(getRun(generated.id)?.status, 'running');
  const second = new DatabaseSync(process.env.BISHAMON_DB_PATH!);
  assert.equal(second.prepare('SELECT status FROM runs WHERE id=?').get(generated.id)?.status, 'running');
  second.close();
  assert.equal(recoverInterruptedRuns(), 1);
  assert.equal(recoverInterruptedRuns(), 0);
  assert.equal(getRun(generated.id)?.status, 'interrupted');
});

test('demo attempts and demo cards never become model evaluation statistics', () => {
  const generated = createRun({ domainId: 'dom_logic', topic: 'demo', provider: 'demo', model: 'demo', status: 'running', promptVersion: 'demo-v1', prompt: 'demo', useRag: false });
  addAttempt({ runId: generated.id, provider: 'demo', model: 'demo', status: 'completed', durationMs: 1, inputTokens: null, outputTokens: null, error: null });
  const result = card('Contoh', { provider: 'demo', isDemo: false, runId: generated.id });
  assert.equal(result.isDemo, true);
  setEvaluation(result.id, { rating: 'good', reason: '', note: '' });
  assert.equal(getStats().models.length, 0);
  assert.equal(getStats().evaluatedCards, 0);
});

test('CSV quotes multiline metadata and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('=SUM(1,2)'), '"\'=SUM(1,2)"');
  assert.equal(csvCell('  @malicious'), '"\'  @malicious"');
  assert.equal(csvCell('\tformula'), '"\'\tformula"');
  const result = card('=1+1');
  setEvaluation(result.id, { rating: 'bad', reason: '-formula', note: 'catatan "berkutip"\nbaris kedua' });
  const csv = exportCsv(allCards());
  assert.ok(csv.startsWith('\uFEFF"id"'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('catatan ""berkutip""\nbaris kedua'));
});

test('signed owner session expires, rejects tampering, and rotates with password', () => {
  process.env.APP_PASSWORD = 'a-strong-private-password';
  assert.equal(authRequired(), true);
  assert.equal(passwordMatches('incorrect'), false); assert.equal(passwordMatches(process.env.APP_PASSWORD), true);
  const issued = 1_000_000;
  const token = createSessionToken(issued);
  assert.equal(verifySessionToken(token, issued + 1), true);
  assert.equal(verifySessionToken(token, issued - 1), false);
  assert.equal(verifySessionToken(token, issued + SESSION_TTL_SECONDS * 1000), false);
  assert.equal(verifySessionToken(token + 'x', issued + 1), false);
  process.env.APP_PASSWORD = 'rotated-password';
  assert.equal(verifySessionToken(token, issued + 1), false);
  const live = createSessionToken();
  const request = new Request('http://localhost/api/cards', { headers: { cookie: `bishamon_owner=${live}` } });
  assert.equal(isAuthenticated(request), true); assert.equal(authorize(request), null);
  assert.match(sessionCookie(new Request('https://example.test/api/session'), live), /HttpOnly; SameSite=Strict; Max-Age=604800; Secure/);
});

test('authorization blocks LAN without password and cross-origin or missing-origin mutations', () => {
  assert.equal(authorize(new Request('http://localhost/api/cards')), null);
  assert.equal(authorize(new Request('http://192.168.1.5/api/cards'))?.status, 403);
  assert.equal(authorize(new Request('http://localhost/api/cards', { method: 'PUT' }), true)?.status, 403);
  assert.equal(authorize(new Request('http://localhost/api/cards', { method: 'PUT', headers: { origin: 'https://evil.test' } }), true)?.status, 403);
  assert.equal(authorize(new Request('http://localhost/api/cards', { method: 'PUT', headers: { origin: 'http://localhost' } }), true), null);
  process.env.APP_PASSWORD = 'owner-password';
  assert.equal(authorize(new Request('http://localhost/api/cards'))?.status, 401);
});

test('request JSON parser bounds input and rejects malformed JSON', async () => {
  const request = (body: string) => new Request('http://localhost/api/cards', { method: 'PUT', headers: { 'content-type': 'application/json' }, body });
  assert.deepEqual(await readJson(request('{"bookmarked":true}')), { bookmarked: true });
  await assert.rejects(readJson(request('{bad}')), /JSON tidak valid/);
  await assert.rejects(readJson(request(JSON.stringify({ note: 'x'.repeat(17000) }))), /terlalu besar/);
});

test('backup script captures WAL data without interrupting runs and refuses an existing target', () => {
  const result = card('Data yang dibackup');
  const active = run();
  setEvaluation(result.id, { rating: 'good', reason: 'tepat', note: 'catatan di WAL' });
  const target = join(temporary, `backup-${sequence}.sqlite`);
  const script = fileURLToPath(new URL('../scripts/backup.ts', import.meta.url));
  const copied = spawnSync(process.execPath, ['--experimental-strip-types', script, target], { encoding: 'utf8', env: process.env });
  assert.equal(copied.status, 0, copied.stderr);
  assert.equal(getRun(active.id)?.status, 'running');
  const backup = new DatabaseSync(target);
  assert.equal(backup.prepare('SELECT note FROM evaluations WHERE card_id=?').get(result.id)?.note, 'catatan di WAL');
  assert.equal(backup.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
  backup.close();
  const duplicate = spawnSync(process.execPath, ['--experimental-strip-types', script, target], { encoding: 'utf8', env: process.env });
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /Tujuan backup sudah ada/);
});

test('launcher rejects LAN binding without password before starting a server', () => {
  const script = fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url));
  const rejected = spawnSync(process.execPath, [script, 'start'], { encoding: 'utf8', env: { ...process.env, HOST: '0.0.0.0', APP_PASSWORD: '' } });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Akses LAN memerlukan APP_PASSWORD/);
});

test('setup creates a private env once and preserves subsequent owner configuration', () => {
  const sandbox = mkdtempSync(join(temporary, 'setup-'));
  const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));
  symlinkSync(scripts, join(sandbox, 'scripts'), 'dir');
  writeFileSync(join(sandbox, '.env.example'), 'APP_PASSWORD=\nBISHAMON_DB_PATH=data/setup.sqlite\n');
  const script = fileURLToPath(new URL('../scripts/setup.mjs', import.meta.url));
  const env = { ...process.env };
  delete env.BISHAMON_DB_PATH;
  const first = spawnSync(process.execPath, [script], { cwd: sandbox, encoding: 'utf8', env });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(existsSync(join(sandbox, 'data/setup.sqlite')), true);
  const configured = 'APP_PASSWORD=owner-configured-password\nBISHAMON_DB_PATH=data/setup.sqlite\n';
  writeFileSync(join(sandbox, '.env'), configured);
  const second = spawnSync(process.execPath, [script], { cwd: sandbox, encoding: 'utf8', env });
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readFileSync(join(sandbox, '.env'), 'utf8'), configured);
});

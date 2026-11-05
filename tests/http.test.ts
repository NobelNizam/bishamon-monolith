import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { closeDatabases } from '../src/lib/database.ts';
import { GET as health } from '../src/app/api/health/route.ts';
import { GET as domains } from '../src/app/api/domains/route.ts';
import { GET as feed } from '../src/app/api/cards/route.ts';
import { GET as detail } from '../src/app/api/cards/[id]/route.ts';
import { POST as generate } from '../src/app/api/generate/route.ts';
import { PUT as bookmark } from '../src/app/api/cards/[id]/bookmark/route.ts';
import { PUT as evaluate, DELETE as deleteEvaluation } from '../src/app/api/cards/[id]/evaluation/route.ts';
import { GET as stats } from '../src/app/api/stats/route.ts';
import { GET as runs } from '../src/app/api/runs/route.ts';
import { GET as exportData } from '../src/app/api/export/route.ts';
import { GET as config } from '../src/app/api/config/route.ts';
import { GET as session, POST as login, DELETE as logout } from '../src/app/api/session/route.ts';
import type { Card, Domain, GenerationRun } from '../src/lib/types.ts';

const base = 'http://127.0.0.1:3000';
const originalFetch = globalThis.fetch;
const envKeys = ['BISHAMON_DB_PATH', 'APP_PASSWORD', 'APP_ORIGIN', 'COOKIE_SECURE', 'NVIDIA_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'LLM_FALLBACK_CHAIN'];
let savedEnv: Record<string, string | undefined>;
let directory: string;
beforeEach(() => {
  savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
  directory = mkdtempSync(join(tmpdir(), 'bishamon-http-'));
  process.env.BISHAMON_DB_PATH = join(directory, 'test.sqlite');
  globalThis.fetch = async () => { throw new Error('External network disabled in HTTP tests'); };
});
afterEach(() => {
  closeDatabases();
  rmSync(directory, { recursive: true, force: true });
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}, origin = base): Request {
  return new Request(origin + path, { method, headers: { ...(method !== 'GET' ? { origin, 'content-type': 'application/json' } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const context = (id: string) => ({ params: Promise.resolve({ id }) });
async function firstDomain(): Promise<Domain> {
  return ((await domains(request('/api/domains')).json()) as { data: Domain[] }).data[0];
}

test('HTTP handlers persist demo generation, bookmark, evaluation edits/deletion and export in real SQLite', async () => {
  assert.deepEqual(await health().json(), { status: 'ok', database: 'ok' });
  const domainResponse = domains(request('/api/domains'));
  assert.equal(domainResponse.status, 200);
  assert.ok(((await domainResponse.json()) as { data: Domain[] }).data.length >= 100);
  const domain = await firstDomain();
  const before = await stats(request('/api/stats')).json();
  const generated = await generate(request('/api/generate', 'POST', { domainId: domain.id, topic: 'HTTP smoke persistence', type: 'FLASHCARD', provider: 'demo', useRag: true }));
  assert.equal(generated.status, 201);
  assert.equal(generated.headers.get('cache-control'), 'no-store');
  const result = await generated.json() as { card: Card; run: GenerationRun };
  assert.equal(result.card.type, 'FLASHCARD');
  assert.equal(result.card.isDemo, true);
  assert.equal(result.run.status, 'completed');
  assert.equal(result.run.cardId, result.card.id);
  assert.equal(result.run.attempts[0].provider, 'demo');
  const id = result.card.id;
  assert.equal(((await (await detail(request(`/api/cards/${id}`), context(id))).json()) as Card).runId, result.run.id);
  const listedRuns = await runs(request('/api/runs')).json() as { data: GenerationRun[] };
  assert.equal(listedRuns.data[0].id, result.run.id);
  assert.match(listedRuns.data[0].prompt, /HTTP smoke persistence/);
  assert.equal((await bookmark(request(`/api/cards/${id}/bookmark`, 'PUT', { bookmarked: true }), context(id))).status, 200);
  const saved = await feed(request('/api/cards?bookmarked=1&q=HTTP%20smoke')).json() as { data: Card[] };
  assert.equal(saved.data[0].id, id);
  assert.equal(saved.data[0].bookmarked, true);
  const evaluated = await evaluate(request(`/api/cards/${id}/evaluation`, 'PUT', { rating: 'good', reason: 'jelas', note: 'catatan awal' }), context(id));
  assert.equal(((await evaluated.json()) as Card).evaluation!.rating, 'good');
  const edited = await evaluate(request(`/api/cards/${id}/evaluation`, 'PUT', { rating: 'bad', reason: 'perlu bukti', note: '=SUM(1,2)' }), context(id));
  assert.equal(((await edited.json()) as Card).evaluation!.rating, 'bad');
  const bad = await feed(request('/api/cards?rating=bad&q=HTTP%20smoke')).json() as { data: Card[] };
  assert.equal(bad.data.length, 1);
  const after = await stats(request('/api/stats')).json();
  assert.equal(after.totalCards, before.totalCards + 1);
  assert.equal(after.demoCards, before.demoCards + 1);
  assert.deepEqual(after.models, before.models);
  assert.equal(after.evaluatedCards, before.evaluatedCards);
  const jsonExport = exportData(request('/api/export?format=json'));
  assert.match(jsonExport.headers.get('content-disposition')!, /attachment/);
  const exported = await jsonExport.json() as { cards: Card[] };
  assert.equal(exported.cards.find(card => card.id === id)!.evaluation!.note, '=SUM(1,2)');
  const csv = await exportData(request('/api/export?format=csv')).text();
  assert.match(csv, /"'=SUM\(1,2\)"/);
  const deleted = await deleteEvaluation(request(`/api/cards/${id}/evaluation`, 'DELETE'), context(id));
  assert.equal(((await deleted.json()) as Card).evaluation, null);
  // Close and reopen the connection to prove that handlers persisted their changes to disk.
  closeDatabases();
  const reopened = await (await detail(request(`/api/cards/${id}`), context(id))).json() as Card;
  assert.equal(reopened.bookmarked, true);
  assert.equal(reopened.evaluation, null);
  assert.equal(reopened.runId, result.run.id);
  const firstPage = await feed(request('/api/cards?limit=1')).json() as { data: Card[]; nextCursor: string | null };
  assert.ok(firstPage.nextCursor);
  const secondPage = await feed(request(`/api/cards?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor!)}`)).json() as { data: Card[] };
  assert.notEqual(firstPage.data[0].id, secondPage.data[0].id);
});

test('HTTP validation and origin checks reject malformed mutations before generation', async () => {
  const domain = await firstDomain();
  const valid = { domainId: domain.id, type: 'ARTICLE', provider: 'demo', useRag: false };
  assert.equal((await generate(request('/api/generate', 'POST', valid, { origin: 'https://evil.example' }))).status, 403);
  assert.equal((await generate(request('/api/generate', 'POST', { ...valid, type: 'INVALID' }))).status, 400);
  assert.equal((await generate(new Request(base + '/api/generate', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: '{broken' }))).status, 400);
  assert.equal((await generate(request('/api/generate', 'POST', valid, { 'content-type': 'text/plain' }))).status, 400);
  assert.equal((await generate(request('/api/generate', 'POST', { ...valid, topic: 'x'.repeat(17000) }))).status, 400);
  assert.equal((await generate(request('/api/generate', 'POST', { ...valid, provider: 'openai' }))).status, 502);
  const history = await runs(request('/api/runs')).json() as { data: GenerationRun[] };
  assert.equal(history.data.length, 1);
  assert.equal(history.data[0].status, 'failed');
  assert.equal(history.data[0].attempts.length, 1);
  assert.equal(exportData(request('/api/export?format=xml')).status, 400);
});

test('HTTP owner login gates local/LAN access, sets protected cookie and rejects cross-origin writes', async () => {
  assert.equal(domains(request('/api/domains', 'GET', undefined, {}, 'http://192.168.1.2:3000')).status, 403);
  process.env.APP_PASSWORD = 'owner-test-password';
  assert.equal(health().status, 200);
  assert.equal(domains(request('/api/domains')).status, 401);
  assert.deepEqual(await session(request('/api/session')).json(), { authenticated: false, authRequired: true });
  assert.equal((await login(request('/api/session', 'POST', { password: 'wrong' }))).status, 401);
  const loggedIn = await login(request('/api/session', 'POST', { password: 'owner-test-password' }));
  assert.equal(loggedIn.status, 200);
  const setCookie = loggedIn.headers.get('set-cookie')!;
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];
  assert.equal(domains(request('/api/domains', 'GET', undefined, { cookie })).status, 200);
  assert.equal(domains(request('/api/domains', 'GET', undefined, { cookie }, 'http://192.168.1.2:3000')).status, 200);
  assert.deepEqual(await session(request('/api/session', 'GET', undefined, { cookie })).json(), { authenticated: true, authRequired: true });
  const appConfig = await config(request('/api/config', 'GET', undefined, { cookie })).json();
  assert.equal(appConfig.authRequired, true);
  assert.doesNotMatch(JSON.stringify(appConfig), /owner-test-password/);
  assert.equal((await generate(request('/api/generate', 'POST', {}, { cookie, origin: 'https://evil.example' }))).status, 403);
  const loggedOut = logout(request('/api/session', 'DELETE', undefined, { cookie }));
  assert.match(loggedOut.headers.get('set-cookie')!, /Max-Age=0/);
  assert.equal(domains(request('/api/domains', 'GET', undefined, { cookie: 'bishamon_owner=tampered' })).status, 401);
});

test('HTTP real-provider fake fetch persists actual attribution and evaluation model denominator', async () => {
  const domain = await firstDomain();
  process.env.OPENAI_API_KEY = 'not-a-real-key';
  globalThis.fetch = async () => Response.json({ model: 'actual-smoke-model', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ title: 'Kartu uji provider', abstract: 'Konten sintetis untuk menguji penyimpanan metadata provider.', type: 'EXPLAINER', content: '## Kartu uji\n\nKonten ini adalah fixture pengujian lokal dengan fetch tiruan. Tidak ada permintaan jaringan atau panggilan AI berbayar pada pengujian ini.', sources: [], hashtags: ['fixture'] }) } }], usage: { prompt_tokens: 22, completion_tokens: 33 } });
  const result = await (await generate(request('/api/generate', 'POST', { domainId: domain.id, type: 'EXPLAINER', provider: 'openai', model: 'requested-alias', useRag: false }))).json() as { card: Card; run: GenerationRun };
  assert.equal(result.card.model, 'actual-smoke-model');
  assert.equal(result.run.attempts[0].inputTokens, 22);
  await evaluate(request(`/api/cards/${result.card.id}/evaluation`, 'PUT', { rating: 'good', reason: 'fixture', note: '' }), context(result.card.id));
  closeDatabases();
  const modelStats = await stats(request('/api/stats')).json();
  const model = modelStats.models.find((value: { model: string }) => value.model === 'actual-smoke-model');
  assert.equal(model.cards, 1);
  assert.equal(model.attempts, 1);
  assert.equal(model.evaluated, 1);
  assert.equal(model.approvalRate, 1);
  assert.equal(model.inputTokens, 22);
  assert.equal(model.outputTokens, 33);
});

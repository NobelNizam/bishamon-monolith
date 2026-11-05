import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type { Attempt, Card, Domain, GenerationRun } from '../src/lib/types.ts';
import { generateCard, GenerationError, type GenerationStorage } from '../src/lib/ai/generation.ts';
import { getAppConfig } from '../src/lib/ai/config.ts';
import { parseArxiv } from '../src/lib/ai/arxiv.ts';
import { parseCardOutput } from '../src/lib/ai/schema.ts';

const originalFetch = globalThis.fetch;
const envKeys = ['NVIDIA_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'NVIDIA_MODEL', 'GEMINI_MODEL', 'OPENAI_MODEL', 'LLM_TIMEOUT_MS', 'LLM_FALLBACK_CHAIN', 'LLM_DEFAULT_PROVIDER'];
let originalEnv: Record<string, string | undefined>;
beforeEach(() => {
  originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

const domain: Domain = { id: 'science', slug: 'science', name: 'Sains', description: '', parentId: null };
const input = { domainId: domain.id, topic: 'Energi', type: 'ARTICLE', provider: 'openai', useRag: false };
const payload = {
  title: 'Memahami energi', abstract: 'Energi membantu kita menjelaskan perubahan fisik.', type: 'ARTICLE',
  content: '## Mengamati perubahan\n\nEnergi adalah besaran yang berguna dalam menjelaskan perubahan. Periksa batas sistem dan asumsi sebelum menarik kesimpulan.',
  sources: [], hashtags: ['energi'],
};
const response = (content: unknown = payload, model = 'actual-model', usage: unknown = { prompt_tokens: 123, completion_tokens: 45 }) => Response.json({ model, choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }], usage });

function storage(): GenerationStorage & { runs: GenerationRun[]; cards: Card[] } {
  const runs: GenerationRun[] = [];
  const cards: Card[] = [];
  return {
    runs, cards,
    getDomain: id => id === domain.id ? domain : null,
    createRun: value => {
      const run: GenerationRun = { ...value, id: `run-${runs.length}`, startedAt: new Date().toISOString(), finishedAt: null, durationMs: null, error: null, cardId: null, attempts: [] };
      runs.push(run);
      return run;
    },
    updateRunPrompt: (id, prompt) => {
      const run = runs.find(value => value.id === id)!;
      run.prompt = prompt;
      return run;
    },
    finishRun: (id, patch) => {
      const run = runs.find(value => value.id === id)!;
      Object.assign(run, patch, { finishedAt: new Date().toISOString() });
      return run;
    },
    addAttempt: value => {
      const run = runs.find(run => run.id === value.runId)!;
      const attempt: Attempt = { ...value, id: `attempt-${run.attempts.length}`, createdAt: new Date().toISOString() };
      run.attempts.push(attempt);
      return attempt;
    },
    createCard: value => {
      const card: Card = { ...value, id: `card-${cards.length}`, slug: `card-${cards.length}`, domainName: domain.name, bookmarked: false, evaluation: null, createdAt: new Date().toISOString() };
      cards.push(card);
      return card;
    },
    getRun: id => runs.find(value => value.id === id) || null,
  };
}

test('explicit demo performs no network even when RAG is requested and snapshots its prompt', async () => {
  globalThis.fetch = async () => { throw new Error('Network must never be called'); };
  const db = storage();
  const { card, run } = await generateCard({ ...input, provider: 'demo', useRag: true }, db);
  assert.equal(card.isDemo, true);
  assert.equal(card.provider, 'demo');
  assert.equal(card.model, 'demo-template-v1');
  assert.deepEqual(card.sources, []);
  assert.equal(card.domainId, input.domainId);
  assert.equal(run.topic, input.topic);
  assert.equal(run.status, 'completed');
  assert.match(run.prompt, /Energi/);
  assert.match(run.error!, /demo tidak mengakses arXiv/);
  assert.equal(run.attempts[0].inputTokens, null);
});

test('strict input validation rejects missing domain and arbitrary fields without starting a run', async () => {
  const db = storage();
  await assert.rejects(generateCard({ ...input, domainId: 'missing' }, db), (error: unknown) => error instanceof GenerationError && error.status === 400);
  await assert.rejects(generateCard({ ...input, overrideSecret: 'value' }, db), GenerationError);
  assert.equal(db.runs.length, 0);
});

test('fallback records failed attempts and actual successful provider, model and token usage', async () => {
  process.env.OPENAI_API_KEY = 'secret-openai';
  process.env.GEMINI_API_KEY = 'secret-gemini';
  process.env.LLM_FALLBACK_CHAIN = 'demo,gemini,openai';
  const urls: string[] = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    if (urls.length === 1) return new Response('secret-openai upstream credential dump', { status: 429 });
    return Response.json({ modelVersion: 'gemini-actual-001', candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 87, candidatesTokenCount: 30 } });
  };
  const db = storage();
  const { card, run } = await generateCard({ ...input, model: 'chosen-model' }, db);
  assert.equal(urls.length, 2);
  assert.equal(card.provider, 'gemini');
  assert.equal(card.model, 'gemini-actual-001');
  assert.equal(run.provider, 'gemini');
  assert.equal(run.model, card.model);
  assert.equal(run.attempts[0].model, 'chosen-model');
  assert.equal(run.attempts[0].status, 'failed');
  assert.equal(run.attempts[1].inputTokens, 87);
  assert.equal(run.attempts[1].outputTokens, 30);
  assert.doesNotMatch(JSON.stringify(run), /secret-openai|secret-gemini/);
});

test('malformed card output finalizes failed run and preserves actual model and known token usage', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = async () => response('{"title":"Incomplete"}');
  const db = storage();
  await assert.rejects(generateCard(input, db), (error: unknown) => error instanceof GenerationError && error.status === 502);
  assert.equal(db.cards.length, 0);
  assert.equal(db.runs[0].status, 'failed');
  assert.ok(db.runs[0].finishedAt);
  assert.equal(db.runs[0].attempts[0].model, 'actual-model');
  assert.equal(db.runs[0].attempts[0].inputTokens, 123);
  assert.match(db.runs[0].attempts[0].error!, /kontrak/);
  // Failure releases the app lock, allowing a later explicit demo.
  await generateCard({ ...input, provider: 'demo' }, db);
  assert.equal(db.cards.length, 1);
});

test('timeout is bounded and a configured real fallback can finish', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.NVIDIA_API_KEY = 'test-key';
  process.env.LLM_FALLBACK_CHAIN = 'nvidia';
  process.env.LLM_TIMEOUT_MS = '10';
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? new Promise<Response>(() => {}) : response(payload, 'nvidia-actual', null);
  const db = storage();
  const { run, card } = await generateCard(input, db);
  assert.equal(card.provider, 'nvidia');
  assert.match(run.attempts[0].error!, /waktu/);
  assert.equal(run.attempts[1].inputTokens, null);
});

test('a second in-flight request receives 409 and the original resolves normally', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  let resolve!: (value: Response) => void;
  globalThis.fetch = async () => new Promise<Response>(done => { resolve = done; });
  const db = storage();
  const pending = generateCard(input, db);
  await assert.rejects(generateCard({ ...input, provider: 'demo' }, db), (error: unknown) => error instanceof GenerationError && error.status === 409);
  resolve(response());
  assert.equal((await pending).run.status, 'completed');
});

test('arXiv parser supports namespace, multiline and entities without trusting other hosts', () => {
  const xml = '<atom:feed><atom:entry><atom:id>http://arxiv.org/abs/2601.12345v1</atom:id><atom:title>Energy &amp;\n Motion</atom:title><atom:summary><![CDATA[Study of <motion> and energy.]]></atom:summary><atom:author><atom:name>A. &#x42;</atom:name></atom:author></atom:entry><entry><id>https://attacker.test/abs/1</id><title>Bad</title><summary>Bad</summary></entry></atom:feed>';
  const refs = parseArxiv(xml);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].title, 'Energy & Motion');
  assert.deepEqual(refs[0].authors, ['A. B']);
  assert.equal(refs[0].url, 'https://arxiv.org/abs/2601.12345v1');
  assert.throws(() => parseArxiv('<!DOCTYPE feed [<!ENTITY x "bad">]><feed/>'));
});

test('source provenance is assigned by retrieval; dangerous links are removed', () => {
  const refs = parseArxiv('<feed><entry><id>http://arxiv.org/abs/2601.12345</id><title>Retrieved title</title><summary>Research abstract.</summary><author><name>Actual Author</name></author></entry></feed>');
  const sources = [
    { title: 'Changed by model', url: refs[0].url, authors: ['Invented'] },
    { title: 'Unverified model source', url: 'https://example.org/paper', authors: [] },
    { title: 'Unsafe', url: 'javascript:alert(1)', authors: [] },
    { title: 'Private', url: 'http://127.0.0.1/private', authors: [] },
  ];
  const card = parseCardOutput(JSON.stringify({ ...payload, sources }), 'ARTICLE', refs);
  assert.equal(card.sources.length, 2);
  assert.equal(card.sources[0].origin, 'arxiv');
  assert.equal(card.sources[0].title, 'Retrieved title');
  assert.deepEqual(card.sources[0].authors, ['Actual Author']);
  assert.equal(card.sources[1].origin, 'model');
});

test('partial RAG failure is visible on completed run; provider errors never expose bodies or thrown credentials', async () => {
  process.env.OPENAI_API_KEY = 'private-api-key';
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? new Response('private-api-key', { status: 503 }) : response();
  const db = storage();
  const { run } = await generateCard({ ...input, useRag: true }, db);
  assert.equal(run.status, 'completed');
  assert.match(run.error!, /arXiv tidak tersedia/);
  assert.match(run.prompt, /Kartu dibuat tanpa konteks arXiv/);
  globalThis.fetch = async () => { throw new Error('secret private-api-key'); };
  await assert.rejects(generateCard(input, db), error => {
    assert.doesNotMatch(String(error), /private-api-key/);
    return true;
  });
  assert.doesNotMatch(JSON.stringify(db.runs), /private-api-key/);
});

test('provider readiness exposes no keys, prefers explicitly configured provider, and defaults to local demo', () => {
  assert.equal(getAppConfig().defaultProvider, 'demo');
  process.env.OPENAI_API_KEY = 'secret-visible-only-to-server';
  process.env.LLM_DEFAULT_PROVIDER = 'openai';
  assert.equal(getAppConfig().defaultProvider, 'openai');
  assert.equal(getAppConfig().providers.find(provider => provider.id === 'openai')!.configured, true);
  assert.doesNotMatch(JSON.stringify(getAppConfig()), /secret-visible/);
});

test('unconfigured real provider fails explicitly without network or demo fallback', async () => {
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; return response(); };
  process.env.LLM_FALLBACK_CHAIN = 'demo';
  const db = storage();
  await assert.rejects(generateCard(input, db), /API key provider belum dikonfigurasi/);
  assert.equal(networkCalls, 0);
  assert.equal(db.cards.length, 0);
  assert.equal(db.runs[0].attempts.length, 1);
  assert.equal(db.runs[0].attempts[0].provider, 'openai');
});

test('invalid JSON and mismatched card type are rejected instead of replaced with defaults', () => {
  assert.throws(() => parseCardOutput('{broken-json', 'ARTICLE', []), /JSON yang tidak valid/);
  assert.throws(() => parseCardOutput(JSON.stringify({ ...payload, type: 'THREAD' }), 'ARTICLE', []), /kontrak/);
});

test('truncated provider output preserves known model and token usage on failed attempts', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = async () => Response.json({ model: 'actual-truncated-model', choices: [{ message: { content: '{"title":' }, finish_reason: 'length' }], usage: { prompt_tokens: 20, completion_tokens: 4096 } });
  const db = storage();
  await assert.rejects(generateCard(input, db), /terpotong/);
  assert.equal(db.runs[0].attempts[0].model, 'actual-truncated-model');
  assert.equal(db.runs[0].attempts[0].outputTokens, 4096);
});

test('run is visible while arXiv retrieval is pending and final prompt snapshots retrieved context', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  let resolveRetrieval!: (value: Response) => void;
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? new Promise<Response>(done => { resolveRetrieval = done; }) : response();
  const db = storage();
  const pending = generateCard({ ...input, useRag: true }, db);
  assert.equal(db.runs.length, 1);
  assert.equal(db.runs[0].status, 'running');
  assert.match(db.runs[0].prompt, /sedang berjalan/);
  resolveRetrieval(new Response('<feed><entry><id>https://arxiv.org/abs/2601.12345</id><title>Retrieved research</title><summary>Research summary.</summary></entry></feed>'));
  const { run } = await pending;
  assert.match(run.prompt, /Retrieved research/);
  assert.doesNotMatch(run.prompt, /sedang berjalan/);
});

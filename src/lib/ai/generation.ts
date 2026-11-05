import * as repository from '../repository.ts';
import type { GenerationRun, Provider } from '../types.ts';
import { retrieveArxiv, type Reference } from './arxiv.ts';
import { fallbackProviders, PROMPT_VERSION, providerConfig } from './config.ts';
import { ProviderError } from './network.ts';
import { buildPrompt, demoCard } from './prompt.ts';
import { complete, CompletionError, type Completion } from './providers.ts';
import { generationInputSchema, parseCardOutput } from './schema.ts';

export class GenerationError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export type GenerationStorage = Pick<typeof repository, 'getDomain' | 'createRun' | 'updateRunPrompt' | 'finishRun' | 'addAttempt' | 'createCard' | 'getRun'>;
const processState = globalThis as typeof globalThis & { bishamonGenerating?: boolean };

export async function generateCard(raw: unknown, storage: GenerationStorage = repository) {
  const parsed = generationInputSchema.safeParse(raw);
  if (!parsed.success) throw new GenerationError('Input generasi tidak valid. Periksa domain, topik, tipe, provider, model, dan RAG.', 400);
  const input = parsed.data;
  const domain = storage.getDomain(input.domainId);
  if (!domain) throw new GenerationError('Domain tidak ditemukan.', 400);
  if (processState.bishamonGenerating) throw new GenerationError('Generasi lain masih berjalan. Tunggu sampai selesai.', 409);
  processState.bishamonGenerating = true;
  const started = Date.now();
  let run: GenerationRun | undefined;
  try {
    const topic = input.topic || domain.name;
    const model = input.provider === 'demo' ? 'demo-template-v1' : input.model || providerConfig(input.provider).model;
    run = storage.createRun({ domainId: domain.id, topic, provider: input.provider, model, status: 'running', promptVersion: PROMPT_VERSION, prompt: buildPrompt(domain, topic, input.type, [], input.useRag && input.provider !== 'demo' ? 'Pencarian konteks arXiv sedang berjalan.' : null), useRag: input.useRag });
    let references: Reference[] = [];
    let retrievalNote: string | null = null;
    if (input.useRag && input.provider !== 'demo') {
      try {
        references = await retrieveArxiv(topic);
        if (!references.length) retrievalNote = 'arXiv tidak menemukan referensi yang dapat digunakan; kartu tidak mendapat konteks arXiv.';
      } catch (error) {
        retrievalNote = `Konteks arXiv tidak tersedia: ${error instanceof ProviderError ? error.message : 'Pencarian gagal.'} Kartu dibuat tanpa konteks arXiv.`;
      }
    } else if (input.useRag) retrievalNote = 'Mode demo tidak mengakses arXiv atau jaringan.';
    const prompt = buildPrompt(domain, topic, input.type, references, retrievalNote);
    storage.updateRunPrompt(run.id, prompt);
    const providers: Provider[] = input.provider === 'demo' ? ['demo'] : fallbackProviders(input.provider);
    const failures: string[] = [];
    for (const provider of providers) {
      const attemptStarted = Date.now();
      const requestedModel = provider === input.provider ? model : provider === 'demo' ? 'demo-template-v1' : providerConfig(provider).model;
      let completion: Completion | undefined;
      let cardData;
      try {
        if (provider === 'demo') {
          cardData = demoCard(topic, domain, input.type);
        } else {
          completion = await complete(provider, requestedModel, prompt);
          cardData = parseCardOutput(completion.text, input.type, references);
        }
      } catch (error) {
        if (error instanceof CompletionError) completion = error.completion;
        const message = error instanceof ProviderError ? error.message : 'Generasi provider gagal.';
        failures.push(`${provider}: ${message}`);
        storage.addAttempt({ runId: run.id, provider, model: completion?.model || requestedModel, status: 'failed', durationMs: Date.now() - attemptStarted, inputTokens: completion?.inputTokens ?? null, outputTokens: completion?.outputTokens ?? null, error: message });
        continue;
      }
      const actualModel = completion?.model || requestedModel;
      storage.addAttempt({ runId: run.id, provider, model: actualModel, status: 'completed', durationMs: Date.now() - attemptStarted, inputTokens: completion?.inputTokens ?? null, outputTokens: completion?.outputTokens ?? null, error: null });
      const card = storage.createCard({ ...cardData, domainId: domain.id, provider, model: actualModel, promptVersion: PROMPT_VERSION, isDemo: provider === 'demo', runId: run.id });
      const finished = storage.finishRun(run.id, { status: 'completed', provider, model: actualModel, durationMs: Date.now() - started, cardId: card.id, error: retrievalNote });
      return { card, run: finished };
    }
    throw new GenerationError(`Semua percobaan provider gagal. ${failures.join(' ')}`, 502);
  } catch (error) {
    const safeError = error instanceof GenerationError ? error : new GenerationError('Generasi gagal disimpan. Coba kembali setelah memeriksa penyimpanan lokal.', 500);
    if (run) storage.finishRun(run.id, { status: 'failed', durationMs: Date.now() - started, error: safeError.message });
    throw safeError;
  } finally {
    processState.bishamonGenerating = false;
  }
}

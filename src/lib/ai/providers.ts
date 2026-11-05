import { providerConfig, timeoutMs, type RealProvider } from './config.ts';
import { ProviderError, requestText } from './network.ts';

export interface Completion { text: string; model: string; inputTokens: number | null; outputTokens: number | null }
export class CompletionError extends ProviderError {
  completion: Completion;
  constructor(message: string, completion: Completion) { super(message); this.completion = completion; }
}
const tokenCount = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const first = (value: unknown): unknown => Array.isArray(value) ? value[0] : undefined;

export async function complete(provider: RealProvider, model: string, prompt: string): Promise<Completion> {
  const config = providerConfig(provider);
  if (!config.key) throw new ProviderError('API key provider belum dikonfigurasi.');
  const gemini = provider === 'gemini';
  const url = gemini ? `${config.base}/models/${encodeURIComponent(model)}:generateContent` : `${config.base}/chat/completions`;
  const body = gemini
    ? { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 } }
    : { model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, max_tokens: 4096 };
  const raw = await requestText(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(gemini ? { 'x-goog-api-key': config.key } : { Authorization: `Bearer ${config.key}` }) }, body: JSON.stringify(body) }, timeoutMs());
  let result: Record<string, unknown>;
  try { result = object(JSON.parse(raw)); }
  catch { throw new ProviderError('Respons provider bukan JSON yang valid.'); }
  const choice = object(first(gemini ? result.candidates : result.choices));
  const finishReason = gemini ? choice.finishReason : choice.finish_reason;
  const text = gemini
    ? (Array.isArray(object(choice.content).parts) ? (object(choice.content).parts as unknown[]).map(part => object(part).text).filter(value => typeof value === 'string').join('') : undefined)
    : object(choice.message).content;
  const usage = object(gemini ? result.usageMetadata : result.usage);
  const returnedModel = gemini ? result.modelVersion : result.model;
  const completion: Completion = {
    text: typeof text === 'string' ? text : '',
    model: typeof returnedModel === 'string' && /^[a-zA-Z0-9_./:-]{1,150}$/.test(returnedModel) ? returnedModel : model,
    inputTokens: tokenCount(gemini ? usage.promptTokenCount : usage.prompt_tokens),
    outputTokens: tokenCount(gemini ? usage.candidatesTokenCount : usage.completion_tokens),
  };
  if (finishReason && !['STOP', 'stop'].includes(String(finishReason))) throw new CompletionError('Respons model terpotong atau diblokir provider.', completion);
  if (!completion.text.trim()) throw new CompletionError('Provider tidak mengembalikan konten kartu.', completion);
  return completion;
}

import { z } from 'zod';
import type { CardType, Source } from '../types.ts';
import type { Reference } from './arxiv.ts';
import { ProviderError } from './network.ts';

export const generationInputSchema = z.object({
  domainId: z.string().trim().min(1).max(100),
  topic: z.string().trim().max(200).optional(),
  type: z.enum(['ARTICLE', 'FLASHCARD', 'EXPLAINER', 'THREAD']),
  provider: z.enum(['demo', 'nvidia', 'gemini', 'openai']),
  model: z.string().trim().min(1).max(150).regex(/^[a-zA-Z0-9_./:-]+$/).optional(),
  useRag: z.boolean(),
}).strict();

const outputSchema = z.object({
  title: z.string().trim().min(3).max(250),
  content: z.string().trim().min(80).max(40000),
  abstract: z.string().trim().min(10).max(1500),
  type: z.enum(['ARTICLE', 'FLASHCARD', 'EXPLAINER', 'THREAD']),
  sources: z.array(z.object({ title: z.string().trim().min(1).max(400), url: z.string().max(2000), authors: z.array(z.string().trim().min(1).max(200)).max(30) }).strict()).max(15),
  hashtags: z.array(z.string().trim().min(1).max(80).regex(/^[\p{L}\p{N}_-]+$/u)).max(10),
}).strict();

export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || /^[\d.]+$/.test(host) || host.includes(':')) return null;
    url.hash = '';
    return url.toString();
  } catch { return null; }
}

export function parseCardOutput(raw: string, type: CardType, references: Reference[]) {
  let parsed: unknown;
  try { parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1')); }
  catch { throw new ProviderError('Model menghasilkan JSON yang tidak valid.'); }
  const validated = outputSchema.safeParse(parsed);
  if (!validated.success || validated.data.type !== type) throw new ProviderError('Struktur atau tipe kartu dari model tidak sesuai kontrak.');
  const sources: Source[] = [];
  const seen = new Set<string>();
  for (const source of validated.data.sources) {
    const url = safeSourceUrl(source.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const retrieved = references.find(reference => reference.url === url || reference.url === url.replace(/^http:/, 'https:'));
    sources.push(retrieved ? { title: retrieved.title, url: retrieved.url, authors: retrieved.authors, origin: 'arxiv' } : { ...source, url, origin: 'model' });
  }
  return { ...validated.data, sources, hashtags: [...new Set(validated.data.hashtags)] };
}

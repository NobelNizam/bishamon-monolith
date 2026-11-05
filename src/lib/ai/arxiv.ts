import type { Source } from '../types.ts';
import { ProviderError, requestText } from './network.ts';

export interface Reference extends Source { summary: string }

function decodeXml(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (entity.startsWith('#')) {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    }
    return entities[entity.toLowerCase()];
  }).replace(/\s+/g, ' ').trim();
}

function tag(xml: string, name: string): string {
  const value = xml.match(new RegExp(`<(?:(?:\\w+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${name}\\s*>`, 'i'))?.[1] || '';
  return decodeXml(value);
}

/** Narrow Atom reader: rejects entities/DTD and accepts only canonical arXiv abstract URLs. */
export function parseArxiv(xml: string): Reference[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || !/<(?:\w+:)?feed\b/i.test(xml)) throw new ProviderError('Respons arXiv bukan Atom yang didukung.');
  const entries = [...xml.matchAll(/<(?:\w+:)?entry\b[^>]*>([\s\S]*?)<\/(?:\w+:)?entry\s*>/gi)];
  const references: Reference[] = [];
  for (const [, entry] of entries.slice(0, 3)) {
    const title = tag(entry, 'title');
    const summary = tag(entry, 'summary');
    const id = tag(entry, 'id');
    if (!/^https?:\/\/arxiv\.org\/abs\/[a-z\d./-]+$/i.test(id) || !title || !summary) continue;
    references.push({ title: title.slice(0, 400), summary: summary.slice(0, 2000), url: id.replace(/^http:/, 'https:'), authors: [...entry.matchAll(/<(?:\w+:)?author\b[^>]*>([\s\S]*?)<\/(?:\w+:)?author\s*>/gi)].map(([, author]) => tag(author, 'name')).filter(Boolean).slice(0, 30), origin: 'arxiv' });
  }
  return references;
}

export async function retrieveArxiv(topic: string): Promise<Reference[]> {
  const url = new URL('https://export.arxiv.org/api/query');
  // Quoting keeps user input within a literal search phrase, rather than arXiv query operators.
  url.searchParams.set('search_query', `all:"${topic.replace(/["\\]/g, ' ')}"`);
  url.searchParams.set('start', '0');
  url.searchParams.set('max_results', '3');
  url.searchParams.set('sortBy', 'relevance');
  return parseArxiv(await requestText(url.toString(), { headers: { Accept: 'application/atom+xml' } }, 8000, 1_000_000));
}

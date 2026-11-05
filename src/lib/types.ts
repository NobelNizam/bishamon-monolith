export type CardType = 'ARTICLE' | 'FLASHCARD' | 'EXPLAINER' | 'THREAD';
export type Provider = 'demo' | 'nvidia' | 'gemini' | 'openai';
export interface Source { title: string; url: string; authors: string[]; origin: 'arxiv' | 'model' | 'demo' }
export interface Domain { id: string; slug: string; name: string; description: string; parentId: string | null }
export interface Evaluation { rating: 'good' | 'bad'; reason: string; note: string; updatedAt: string }
export interface Card {
  id: string; slug: string; title: string; content: string; abstract: string; type: CardType;
  domainId: string; domainName: string; provider: Provider; model: string; promptVersion: string;
  isDemo: boolean; createdAt: string; bookmarked: boolean; evaluation: Evaluation | null;
  sources: Source[]; hashtags: string[]; runId: string | null;
}
export interface Attempt {
  id: string; runId: string; provider: Provider; model: string; status: 'completed' | 'failed';
  durationMs: number; inputTokens: number | null; outputTokens: number | null; error: string | null; createdAt: string;
}
export interface GenerationRun {
  id: string; domainId: string; topic: string; provider: Provider; model: string;
  status: 'running' | 'completed' | 'failed' | 'interrupted'; promptVersion: string; prompt: string;
  useRag: boolean; startedAt: string; finishedAt: string | null; durationMs: number | null;
  error: string | null; cardId: string | null; attempts: Attempt[];
}
export interface GenerationInput { domainId: string; topic?: string; type: CardType; provider: Provider; model?: string; useRag: boolean }
export interface ModelStats {
  provider: Provider; model: string; cards: number; evaluated: number; good: number; bad: number;
  approvalRate: number | null; attempts: number; failures: number; averageDurationMs: number | null;
  inputTokens: number; outputTokens: number;
}
export interface AppConfig {
  authRequired: boolean; providers: { id: Provider; label: string; model: string; configured: boolean }[];
  defaultProvider: Provider; promptVersion: string;
}

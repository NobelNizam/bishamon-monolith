import type { AppConfig, Provider } from '../types.ts';

export const PROMPT_VERSION = 'bishamon-id-2026-10-29-v1';
export type RealProvider = Exclude<Provider, 'demo'>;
export const REAL_PROVIDERS: RealProvider[] = ['nvidia', 'gemini', 'openai'];

export function providerConfig(provider: RealProvider) {
  const defaults = {
    nvidia: { model: 'meta/llama-3.3-70b-instruct', base: 'https://integrate.api.nvidia.com/v1' },
    gemini: { model: 'gemini-2.5-flash', base: 'https://generativelanguage.googleapis.com/v1beta' },
    openai: { model: 'gpt-4.1-mini', base: 'https://api.openai.com/v1' },
  }[provider];
  const prefix = provider.toUpperCase();
  return {
    key: process.env[`${prefix}_API_KEY`]?.trim() || '',
    model: process.env[`${prefix}_MODEL`]?.trim() || defaults.model,
    base: (provider === 'nvidia' ? process.env.NVIDIA_API_BASE_URL : provider === 'openai' ? process.env.OPENAI_BASE_URL : undefined)?.replace(/\/+$/, '') || defaults.base,
  };
}

export function getAppConfig(): AppConfig {
  const providers: AppConfig['providers'] = [
    { id: 'demo', label: 'Demo lokal (bukan AI)', model: 'demo-template-v1', configured: true },
    ...REAL_PROVIDERS.map(id => ({ id, label: { nvidia: 'NVIDIA NIM', gemini: 'Google Gemini', openai: 'OpenAI / kompatibel' }[id], model: providerConfig(id).model, configured: !!providerConfig(id).key })),
  ];
  const preferred = process.env.LLM_DEFAULT_PROVIDER;
  const defaultProvider = providers.find(p => p.id === preferred && p.configured)?.id ?? providers.find(p => p.id !== 'demo' && p.configured)?.id ?? 'demo';
  return { authRequired: !!process.env.APP_PASSWORD, providers, defaultProvider, promptVersion: PROMPT_VERSION };
}

export function fallbackProviders(selected: RealProvider): RealProvider[] {
  const configured = (process.env.LLM_FALLBACK_CHAIN || '').split(',').map(value => value.trim());
  return [selected, ...configured.filter((provider): provider is RealProvider => REAL_PROVIDERS.includes(provider as RealProvider) && !!providerConfig(provider as RealProvider).key)]
    .filter((provider, index, values) => values.indexOf(provider) === index);
}

export function timeoutMs(): number {
  const value = Number(process.env.LLM_TIMEOUT_MS || 60000);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.max(value, 10), 180000) : 60000;
}

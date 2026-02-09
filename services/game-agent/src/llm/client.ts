/**
 * LLM Client - Factory and high-level interface for LLM providers.
 *
 * Usage:
 *   const llm = createLLMClient();  // reads from env/config
 *   const response = await llm.complete({ messages, tools });
 *
 * Switching providers is a one-line config change:
 *   LLM_PROVIDER=openai   → uses OpenAI
 *   LLM_PROVIDER=mistral  → uses Mistral (default)
 *   LLM_PROVIDER=anthropic → uses Claude
 */

import { createLogger } from '@dory/shared';
import { LLMProvider, LLMProviderType, LLMProviderConfig } from './types';
import { OpenAICompatibleProvider } from './providers/openai-compatible';
import { AnthropicProvider } from './providers/anthropic';

const logger = createLogger('llm-client');

// ─── Default Models ───────────────────────────────────────────────────────────

const DEFAULT_MODELS: Record<LLMProviderType, string> = {
  mistral: 'mistral-large-latest',
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.5-pro',
};

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create an LLM provider from environment variables.
 *
 * Required env vars (depending on provider):
 *   LLM_PROVIDER    - "mistral" | "openai" | "anthropic" (default: "mistral")
 *   LLM_MODEL       - Override default model name
 *   MISTRAL_API_KEY  - For Mistral
 *   OPENAI_API_KEY   - For OpenAI
 *   ANTHROPIC_API_KEY - For Claude
 */
export function createLLMClient(overrides?: Partial<LLMProviderConfig> & { provider?: LLMProviderType }): LLMProvider {
  const providerType = overrides?.provider
    || (process.env.LLM_PROVIDER as LLMProviderType)
    || 'mistral';

  const apiKey = overrides?.apiKey || getApiKeyFromEnv(providerType);
  const model = overrides?.model || getModelFromEnv(providerType) || DEFAULT_MODELS[providerType];

  if (!apiKey) {
    throw new Error(
      `No API key found for provider "${providerType}". ` +
      `Set ${getEnvKeyName(providerType)} in your .env file.`
    );
  }

  const config: LLMProviderConfig = {
    apiKey,
    model,
    baseUrl: overrides?.baseUrl,
    temperature: overrides?.temperature,
    maxTokens: overrides?.maxTokens,
  };

  let provider: LLMProvider;

  switch (providerType) {
    case 'mistral':
      provider = new OpenAICompatibleProvider('mistral', config);
      break;
    case 'openai':
      provider = new OpenAICompatibleProvider('openai', config);
      break;
    case 'gemini':
      provider = new OpenAICompatibleProvider('gemini', config);
      break;
    case 'anthropic':
      provider = new AnthropicProvider(config);
      break;
    default:
      throw new Error(`Unknown LLM provider: ${providerType}`);
  }

  logger.info(`LLM client initialized: ${providerType} / ${model}`);
  return provider;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiKeyFromEnv(provider: LLMProviderType): string | undefined {
  switch (provider) {
    case 'mistral':
      return process.env.MISTRAL_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'gemini':
      return process.env.GEMINI_API_KEY;
  }
}

function getModelFromEnv(provider: LLMProviderType): string | undefined {
  // Check provider-specific model env var first, then generic LLM_MODEL
  switch (provider) {
    case 'mistral':
      return process.env.MISTRAL_MODEL || process.env.LLM_MODEL;
    case 'openai':
      return process.env.OPENAI_MODEL || process.env.LLM_MODEL;
    case 'anthropic':
      return process.env.ANTHROPIC_MODEL || process.env.LLM_MODEL;
    case 'gemini':
      return process.env.GEMINI_MODEL || process.env.LLM_MODEL;
  }
}

function getEnvKeyName(provider: LLMProviderType): string {
  switch (provider) {
    case 'mistral':
      return 'MISTRAL_API_KEY';
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'anthropic':
      return 'ANTHROPIC_API_KEY';
    case 'gemini':
      return 'GEMINI_API_KEY';
  }
}

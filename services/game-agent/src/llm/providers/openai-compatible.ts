/**
 * OpenAI-Compatible Provider
 *
 * Works with both OpenAI and Mistral since Mistral's API follows the
 * OpenAI chat completions format (same endpoints, same tool calling schema).
 *
 * - OpenAI:  baseUrl = https://api.openai.com/v1
 * - Mistral: baseUrl = https://api.mistral.ai/v1
 */

import { createLogger } from '@dory/shared';
import {
  LLMProvider,
  LLMProviderConfig,
  LLMProviderType,
  CompletionRequest,
  CompletionResponse,
  ChatMessage,
  ToolCall,
} from '../types';

const logger = createLogger('llm-openai-compat');

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  mistral: 'https://api.mistral.ai/v1',
};

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: LLMProviderType;
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor(providerName: LLMProviderType, config: LLMProviderConfig) {
    this.name = providerName;
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URLS[providerName] || DEFAULT_BASE_URLS.openai;
    this.defaultTemperature = config.temperature ?? 0.7;
    this.defaultMaxTokens = config.maxTokens ?? 1024;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const url = `${this.baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: this.model,
      messages: request.messages,
      temperature: request.temperature ?? this.defaultTemperature,
      max_tokens: request.max_tokens ?? this.defaultMaxTokens,
    };

    // Add tools if provided
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
      body.tool_choice = request.tool_choice ?? 'auto';
    }

    logger.info(`[${this.name}] Requesting ${this.model} (${request.messages.length} messages, ${request.tools?.length ?? 0} tools)`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`[${this.name}] API error ${response.status}: ${errorBody}`);
      throw new Error(`${this.name} API error ${response.status}: ${errorBody}`);
    }

    const data: any = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error(`${this.name} returned no choices`);
    }

    // Parse the response message
    const rawMessage = choice.message;
    const finishReason = choice.finish_reason;

    const message: ChatMessage = {
      role: 'assistant',
      content: rawMessage.content || null,
    };

    // Parse tool calls if present
    if (rawMessage.tool_calls && rawMessage.tool_calls.length > 0) {
      message.tool_calls = rawMessage.tool_calls.map((tc: any): ToolCall => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }

    // Map finish reason
    let mappedFinishReason: CompletionResponse['finish_reason'] = 'stop';
    if (finishReason === 'tool_calls') {
      mappedFinishReason = 'tool_calls';
    } else if (finishReason === 'length') {
      mappedFinishReason = 'length';
    }

    logger.info(`[${this.name}] Response: finish=${mappedFinishReason}, tool_calls=${message.tool_calls?.length ?? 0}, content_length=${message.content?.length ?? 0}`);

    return {
      message,
      finish_reason: mappedFinishReason,
      usage: data.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}

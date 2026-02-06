/**
 * Anthropic (Claude) Provider
 *
 * Claude uses a different API format from OpenAI/Mistral:
 * - Different endpoint: /v1/messages
 * - System prompt is a top-level field, not a message
 * - Tool calls use content blocks with type "tool_use"
 * - Tool results use content blocks with type "tool_result"
 */

import { createLogger } from '@dory/shared';
import {
  LLMProvider,
  LLMProviderConfig,
  CompletionRequest,
  CompletionResponse,
  ChatMessage,
  ToolCall,
} from '../types';
import { ToolDefinition } from '../../tools/registry';

const logger = createLogger('llm-anthropic');

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic' as const;
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor(config: LLMProviderConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.defaultTemperature = config.temperature ?? 0.7;
    this.defaultMaxTokens = config.maxTokens ?? 1024;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const url = `${this.baseUrl}/v1/messages`;

    // Extract system message (Claude takes it as a top-level field)
    let systemPrompt: string | undefined;
    const messages: any[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content || undefined;
        continue;
      }

      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        // Convert assistant tool_calls to Claude's content block format
        const content: any[] = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
        messages.push({ role: 'assistant', content });
      } else if (msg.role === 'tool') {
        // Convert tool result to Claude's tool_result content block
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id,
              content: msg.content || '',
            },
          ],
        });
      } else {
        messages.push({
          role: msg.role,
          content: msg.content || '',
        });
      }
    }

    // Convert tool definitions from OpenAI format to Claude format
    const tools = request.tools?.map((t) => convertToolDefinition(t));

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: request.temperature ?? this.defaultTemperature,
      max_tokens: request.max_tokens ?? this.defaultMaxTokens,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (tools && tools.length > 0) {
      body.tools = tools;
      if (request.tool_choice === 'none') {
        // Claude doesn't support tool_choice "none" directly - just omit tools
        delete body.tools;
      }
      // 'auto' is the default for Claude
    }

    logger.info(`[anthropic] Requesting ${this.model} (${messages.length} messages, ${tools?.length ?? 0} tools)`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`[anthropic] API error ${response.status}: ${errorBody}`);
      throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
    }

    const data: any = await response.json();

    // Parse Claude's response content blocks back into our unified format
    const message: ChatMessage = {
      role: 'assistant',
      content: null,
    };

    const toolCalls: ToolCall[] = [];
    const textParts: string[] = [];

    for (const block of data.content || []) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    if (textParts.length > 0) {
      message.content = textParts.join('\n');
    }

    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }

    // Map stop reason
    let finishReason: CompletionResponse['finish_reason'] = 'stop';
    if (data.stop_reason === 'tool_use') {
      finishReason = 'tool_calls';
    } else if (data.stop_reason === 'max_tokens') {
      finishReason = 'length';
    }

    logger.info(`[anthropic] Response: finish=${finishReason}, tool_calls=${toolCalls.length}, content_length=${message.content?.length ?? 0}`);

    return {
      message,
      finish_reason: finishReason,
      usage: data.usage
        ? {
            prompt_tokens: data.usage.input_tokens,
            completion_tokens: data.usage.output_tokens,
            total_tokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }
}

/**
 * Convert OpenAI-format tool definition to Claude format.
 * Claude expects: { name, description, input_schema } (no wrapping "function" key).
 */
function convertToolDefinition(tool: ToolDefinition) {
  return {
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  };
}

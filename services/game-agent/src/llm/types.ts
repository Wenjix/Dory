/**
 * LLM types - Provider-agnostic interfaces for chat completions with tool calling.
 */

import { ToolDefinition } from '../tools/registry';

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** Tool calls made by the assistant (only on assistant messages) */
  tool_calls?: ToolCall[];
  /** The tool call ID this message is responding to (only on tool messages) */
  tool_call_id?: string;
  /** Name of the tool (only on tool messages) */
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

// ─── Completion Request/Response ──────────────────────────────────────────────

export interface CompletionRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  /** 'auto' lets the LLM decide, 'none' disables tools */
  tool_choice?: 'auto' | 'none';
  temperature?: number;
  max_tokens?: number;
}

export interface CompletionResponse {
  message: ChatMessage;
  /** Why the LLM stopped: made tool calls, finished message, or hit limit */
  finish_reason: 'tool_calls' | 'stop' | 'length';
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── Provider Interface ───────────────────────────────────────────────────────

export type LLMProviderType = 'mistral' | 'openai' | 'anthropic' | 'gemini';

export interface LLMProviderConfig {
  apiKey: string;
  model: string;
  /** Override base URL (useful for proxies or local models) */
  baseUrl?: string;
  /** Default temperature (0-1) */
  temperature?: number;
  /** Default max tokens */
  maxTokens?: number;
}

/**
 * Abstract LLM provider interface.
 * Implement this for each provider (Mistral, OpenAI, Claude).
 */
export interface LLMProvider {
  readonly name: LLMProviderType;
  readonly model: string;

  /**
   * Send a chat completion request with optional tool definitions.
   * Returns the assistant's response message and finish reason.
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

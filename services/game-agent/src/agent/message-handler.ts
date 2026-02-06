/**
 * Message Handler - The reasoning loop that ties LLM + tools together.
 *
 * Flow:
 * 1. User sends a message
 * 2. Build context: system prompt (with state) + conversation history + user message
 * 3. Send to LLM with tool definitions
 * 4. If LLM returns tool calls → execute them → add results → loop back to 3
 * 5. If LLM returns text → return it as the response
 *
 * Manages per-session conversation history in memory.
 */

import { createLogger } from '@dory/shared';
import { MinecraftBot } from '../bot/minecraft-bot';
import { LLMProvider, ChatMessage, ToolCall } from '../llm/types';
import { ALL_TOOLS, executeTool } from '../tools';
import { buildSystemPrompt } from './system-prompt';

const logger = createLogger('message-handler');

// ─── Configuration ────────────────────────────────────────────────────────────

/** Max tool-calling loop iterations to prevent infinite loops */
const MAX_TOOL_ITERATIONS = 10;

/** Max messages to keep in conversation history (excluding system prompt) */
const MAX_HISTORY_MESSAGES = 30;

// ─── Per-Session Conversation History ─────────────────────────────────────────

const sessionHistories = new Map<string, ChatMessage[]>();

/**
 * Get conversation history for a session (creates new if needed)
 */
function getHistory(sessionId: string): ChatMessage[] {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, []);
  }
  return sessionHistories.get(sessionId)!;
}

/**
 * Trim history to keep it under the max limit.
 * Keeps the most recent messages.
 */
function trimHistory(history: ChatMessage[]): void {
  while (history.length > MAX_HISTORY_MESSAGES) {
    history.shift();
  }
}

/**
 * Clear conversation history for a session
 */
export function clearHistory(sessionId: string): void {
  sessionHistories.delete(sessionId);
}

/**
 * Get conversation history length for a session (for debugging)
 */
export function getHistoryLength(sessionId: string): number {
  return sessionHistories.get(sessionId)?.length ?? 0;
}

// ─── Message Handler ──────────────────────────────────────────────────────────

export interface HandleMessageResult {
  /** The assistant's final text response */
  response: string;
  /** Tool calls that were executed during this turn */
  toolsExecuted: Array<{ name: string; args: Record<string, any>; result: string }>;
  /** Number of LLM calls made (1 = no tools, 2+ = tool loop) */
  llmCalls: number;
}

/**
 * Handle a user message: run the LLM reasoning loop with tool execution.
 *
 * @param sessionId - Session identifier (for conversation history)
 * @param bot - The MinecraftBot for this session
 * @param llm - The LLM provider to use
 * @param userMessage - The user's text message
 * @returns The assistant's response and metadata
 */
export async function handleMessage(
  sessionId: string,
  bot: MinecraftBot,
  llm: LLMProvider,
  userMessage: string
): Promise<HandleMessageResult> {
  const history = getHistory(sessionId);
  const toolsExecuted: HandleMessageResult['toolsExecuted'] = [];
  let llmCalls = 0;

  // Add the user message to history
  history.push({ role: 'user', content: userMessage });

  // Build system prompt with current game state
  const systemPrompt = buildSystemPrompt(bot);

  // Build the full message array: system + history
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];

  logger.info(`[${sessionId}] Handling message: "${userMessage}" (history: ${history.length} msgs)`);

  // ── Tool-calling loop ───────────────────────────────────────────────────

  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    // Call LLM
    const completion = await llm.complete({
      messages,
      tools: ALL_TOOLS,
      tool_choice: 'auto',
    });

    llmCalls++;
    const assistantMessage = completion.message;

    // Add assistant response to messages (for potential next iteration)
    messages.push(assistantMessage);

    // If no tool calls, we have our final response
    if (completion.finish_reason !== 'tool_calls' || !assistantMessage.tool_calls?.length) {
      const responseText = assistantMessage.content || "I'm not sure what to say.";

      // Save assistant response to persistent history
      history.push({ role: 'assistant', content: responseText });
      trimHistory(history);

      logger.info(`[${sessionId}] Final response after ${llmCalls} LLM calls, ${toolsExecuted.length} tools`);

      return {
        response: responseText,
        toolsExecuted,
        llmCalls,
      };
    }

    // ── Execute tool calls ────────────────────────────────────────────────

    logger.info(`[${sessionId}] LLM requested ${assistantMessage.tool_calls.length} tool call(s) (iteration ${iterations})`);

    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs: Record<string, any> = {};

      // Parse arguments
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        logger.warn(`[${sessionId}] Failed to parse args for ${toolName}: ${toolCall.function.arguments}`);
      }

      logger.info(`[${sessionId}] Executing: ${toolName}(${JSON.stringify(toolArgs)})`);

      // Execute the tool
      const result = await executeTool(bot, toolName, toolArgs);

      // Track execution
      toolsExecuted.push({
        name: toolName,
        args: toolArgs,
        result: result.message,
      });

      // Add tool result to messages for the next LLM iteration
      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
        name: toolName,
      });
    }

    // Save the assistant message (with tool calls) and tool results to history
    history.push({
      role: 'assistant',
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls,
    });

    for (const toolCall of assistantMessage.tool_calls) {
      const executed = toolsExecuted.find((t) => t.name === toolCall.function.name);
      history.push({
        role: 'tool',
        content: JSON.stringify({ success: true, message: executed?.result ?? '' }),
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
      });
    }

    trimHistory(history);

    // Loop continues - LLM will see tool results and either call more tools or respond
  }

  // Safety: if we hit max iterations, return what we have
  logger.warn(`[${sessionId}] Hit max tool iterations (${MAX_TOOL_ITERATIONS})`);

  return {
    response: "I tried several actions but hit the limit. Let me know if you need anything else.",
    toolsExecuted,
    llmCalls,
  };
}

/**
 * Message Handler - The reasoning loop that ties LLM + tools together.
 *
 * Two-path routing:
 * - Simple requests (follow me, stop, look around) → direct LLM tool-calling loop
 * - Complex requests (multi-step tasks) → planning system (create plan → execute plan)
 *
 * On any new message, the active plan (if any) is cancelled first.
 */

import { createLogger, prettyJson } from '@dory/shared';
import { MinecraftBot } from '../bot/minecraft-bot';
import { LLMProvider, ChatMessage } from '../llm/types';
import { ALL_TOOLS, executeTool } from '../tools';
import { buildSystemPrompt } from './system-prompt';
import {
  createPlan,
  executePlan,
  cancelPlan,
  getActivePlan,
} from '../planning';

const logger = createLogger('MessageHandler');

// ─── Configuration ────────────────────────────────────────────────────────────

/** Max tool-calling loop iterations for simple requests */
const MAX_TOOL_ITERATIONS = 10;

/** Max messages to keep in conversation history */
const MAX_HISTORY_MESSAGES = 30;

// ─── Per-Session Conversation History ─────────────────────────────────────────

const sessionHistories = new Map<string, ChatMessage[]>();

function getHistory(sessionId: string): ChatMessage[] {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, []);
  }
  return sessionHistories.get(sessionId)!;
}

function trimHistory(history: ChatMessage[]): void {
  while (history.length > MAX_HISTORY_MESSAGES) {
    history.shift();
  }
}

export function clearHistory(sessionId: string): void {
  sessionHistories.delete(sessionId);
}

export function getHistoryLength(sessionId: string): number {
  return sessionHistories.get(sessionId)?.length ?? 0;
}

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface HandleMessageResult {
  /** The assistant's final text response */
  response: string;
  /** Tool calls that were executed during this turn */
  toolsExecuted: Array<{
    name: string;
    args: Record<string, any>;
    result: string;
  }>;
  /** Number of LLM calls made */
  llmCalls: number;
  /** Whether the planning system was used */
  usedPlanning: boolean;
  /** Plan summary (if planning was used) */
  planSummary?: string;
}

// ─── Complexity Detection ─────────────────────────────────────────────────────

/**
 * Determine if a request is complex enough to need the planning system.
 *
 * Complex requests typically involve:
 * - Multiple sequential actions ("get wood and build a house")
 * - Crafting chains ("make a pickaxe")
 * - Actions with prerequisites ("build a wall with cobblestone" → may need to collect first)
 * - Conditional logic ("if you have wood, craft planks")
 *
 * Simple requests are single-action:
 * - "follow me", "stop", "come here"
 * - "what do you see?", "where are you?"
 * - "build a pillar here"
 */
function isComplexRequest(message: string): boolean {
  const lower = message.toLowerCase().trim();

  // Explicit simple patterns -- these never need planning
  const simplePatterns = [
    /^(follow|come|stop|jump|look|where|what|who|hi|hello|hey|sup|thanks|thank|ok|yes|no|help)/,
    /^(build|place) .*(here|where i.m looking|where i look)/,
    /^tell me/,
    /^how (are|is)/,
    /^go to /,
    /^eat /,
    /^equip /,
  ];
  if (simplePatterns.some((p) => p.test(lower))) {
    return false;
  }

  // Multi-step indicators
  const complexIndicators = [
    / and (then )?/,        // "get wood and build"
    / then /,               // "collect stone then craft"
    /,\s*(then|and|after)/,  // "get wood, then craft"
    /craft.*pickaxe/,       // crafting chains always need planning
    /craft.*table/,         // crafting table needs prerequisites
    /craft.*sword/,
    /make (me |a )/,        // "make me a pickaxe"
    /build .* (house|shelter|base|structure)/,  // complex builds
    /collect .* (and|then|,)/,  // collect + something else
    /give .* to/,           // give implies collect + come to player
    /bring .* (to|here)/,   // bring implies collect + navigate
    /get .* (and|then|for)/, // get + another action
  ];

  if (complexIndicators.some((p) => p.test(lower))) {
    return true;
  }

  // Word count heuristic: longer messages are more likely complex
  const wordCount = lower.split(/\s+/).length;
  if (wordCount > 12) {
    return true;
  }

  return false;
}

// ─── Message Handler ──────────────────────────────────────────────────────────

/**
 * Handle a user message.
 * Cancels any active plan first, then routes to planning or direct tool loop.
 */
export async function handleMessage(
  sessionId: string,
  bot: MinecraftBot,
  llm: LLMProvider,
  userMessage: string
): Promise<HandleMessageResult> {
  // ── Cancel any active plan ──────────────────────────────────────────────
  const activePlan = getActivePlan(sessionId);
  if (activePlan) {
    logger.info(`[${sessionId}] New message received, cancelling active plan ${activePlan.id}`);
    await cancelPlan(sessionId, bot);
  }

  const history = getHistory(sessionId);
  history.push({ role: 'user', content: userMessage });

  // ── Route: complex → planning, simple → direct loop ─────────────────────
  const complex = isComplexRequest(userMessage);
  logger.info(
    `[${sessionId}] Handling message: "${userMessage}" (complex=${complex}, history=${history.length})`
  );

  if (complex) {
    return await handleWithPlanning(sessionId, bot, llm, userMessage, history);
  } else {
    return await handleWithToolLoop(sessionId, bot, llm, userMessage, history);
  }
}

// ─── Planning Path ────────────────────────────────────────────────────────────

async function handleWithPlanning(
  sessionId: string,
  bot: MinecraftBot,
  llm: LLMProvider,
  userMessage: string,
  history: ChatMessage[]
): Promise<HandleMessageResult> {
  const toolsExecuted: HandleMessageResult['toolsExecuted'] = [];
  let llmCalls = 0;

  try {
    // Create a plan
    logger.info(`[${sessionId}] Creating plan for: "${userMessage}"`);
    const plan = await createPlan(
      { userRequest: userMessage },
      bot,
      llm,
      sessionId
    );
    llmCalls++;

    logger.info(
      `[${sessionId}] Plan created: ${plan.steps.map((s) => s.tool).join(' → ')}`
    );

    // Execute the plan
    const result = await executePlan(plan, bot, llm);

    logger.info(`[${sessionId}] Plan result:\n${prettyJson({
      success: result.success,
      summary: result.summary,
      error: result.error,
    })}`);

    // Collect tool execution info from plan steps
    for (const step of plan.steps) {
      if (step.status === 'completed' || step.status === 'failed') {
        toolsExecuted.push({
          name: step.tool,
          args: step.parameters,
          result: step.result?.data?.message || step.error || '',
        });
      }
    }

    // Generate a response based on the plan result
    const response = result.success
      ? plan.reasoning || result.summary
      : `I had trouble: ${result.error || result.summary}`;

    // Save to conversation history
    history.push({ role: 'assistant', content: response });
    trimHistory(history);

    return {
      response,
      toolsExecuted,
      llmCalls,
      usedPlanning: true,
      planSummary: `${plan.steps.length} steps, ${result.success ? 'success' : 'failed'}: ${result.summary}`,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    logger.error(`[${sessionId}] Planning failed: ${errorMsg}`);

    // Fallback: try direct tool loop
    logger.info(`[${sessionId}] Falling back to direct tool loop...`);
    const fallbackResult = await handleWithToolLoop(
      sessionId,
      bot,
      llm,
      userMessage,
      history
    );
    fallbackResult.usedPlanning = false;
    return fallbackResult;
  }
}

// ─── Direct Tool Loop Path ────────────────────────────────────────────────────

async function handleWithToolLoop(
  sessionId: string,
  bot: MinecraftBot,
  llm: LLMProvider,
  userMessage: string,
  history: ChatMessage[]
): Promise<HandleMessageResult> {
  const toolsExecuted: HandleMessageResult['toolsExecuted'] = [];
  let llmCalls = 0;

  // Build system prompt with current game state
  const systemPrompt = buildSystemPrompt(bot);

  // Build the full message array: system + history
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];

  // ── Tool-calling loop ───────────────────────────────────────────────────

  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const completion = await llm.complete({
      messages,
      tools: ALL_TOOLS,
      tool_choice: 'auto',
    });

    llmCalls++;
    const assistantMessage = completion.message;
    messages.push(assistantMessage);

    // If no tool calls, we have our final response
    if (
      completion.finish_reason !== 'tool_calls' ||
      !assistantMessage.tool_calls?.length
    ) {
      const responseText =
        assistantMessage.content || "I'm not sure what to say.";

      history.push({ role: 'assistant', content: responseText });
      trimHistory(history);

      logger.info(
        `[${sessionId}] Response after ${llmCalls} LLM calls, ${toolsExecuted.length} tools`
      );

      return {
        response: responseText,
        toolsExecuted,
        llmCalls,
        usedPlanning: false,
      };
    }

    // ── Execute tool calls ──────────────────────────────────────────────

    logger.info(
      `[${sessionId}] ${assistantMessage.tool_calls.length} tool call(s) (iteration ${iterations})`
    );

    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs: Record<string, any> = {};

      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        logger.warn(
          `[${sessionId}] Failed to parse args for ${toolName}: ${toolCall.function.arguments}`
        );
      }

      logger.info(
        `[${sessionId}] Executing: ${toolName}(${JSON.stringify(toolArgs)})`
      );

      const result = await executeTool(bot, toolName, toolArgs);

      toolsExecuted.push({
        name: toolName,
        args: toolArgs,
        result: result.message,
      });

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
        name: toolName,
      });
    }

    // Save tool exchange to history
    history.push({
      role: 'assistant',
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls,
    });

    for (const toolCall of assistantMessage.tool_calls) {
      const executed = toolsExecuted.find(
        (t) => t.name === toolCall.function.name
      );
      history.push({
        role: 'tool',
        content: JSON.stringify({
          success: true,
          message: executed?.result ?? '',
        }),
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
      });
    }

    trimHistory(history);
  }

  logger.warn(
    `[${sessionId}] Hit max tool iterations (${MAX_TOOL_ITERATIONS})`
  );

  return {
    response:
      "I tried several actions but hit the limit. Let me know if you need anything else.",
    toolsExecuted,
    llmCalls,
    usedPlanning: false,
  };
}

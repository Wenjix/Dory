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

/**
 * Trim conversation history while keeping tool_use / tool_result pairs intact.
 *
 * Anthropic requires that every `tool_result` has a matching `tool_use` in the
 * preceding assistant message. Naively shifting messages off the front can orphan
 * tool_result blocks, causing a 400 error.
 *
 * Strategy: remove messages from the front, but if we remove an assistant message
 * with tool_calls, also remove all its subsequent tool-result messages.
 */
function trimHistory(history: ChatMessage[]): void {
  while (history.length > MAX_HISTORY_MESSAGES) {
    const removed = history.shift();
    if (!removed) break;

    // If we removed an assistant message that had tool_calls,
    // also remove all immediately-following tool messages that reference those calls.
    if (removed.role === 'assistant' && removed.tool_calls?.length) {
      const toolCallIds = new Set(removed.tool_calls.map((tc: any) => tc.id));
      while (
        history.length > 0 &&
        history[0].role === 'tool' &&
        history[0].tool_call_id &&
        toolCallIds.has(history[0].tool_call_id)
      ) {
        history.shift();
      }
    }
  }

  // Safety net: if history starts with orphaned tool messages, remove them.
  // This handles edge cases where tool_result messages ended up at the start.
  while (history.length > 0 && history[0].role === 'tool') {
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

// ─── Chat vs Action Detection ─────────────────────────────────────────────────

/**
 * Determine if a message is conversational (chat/question) rather than an action request.
 * Chat messages can be answered without interrupting an active plan.
 */
function isChatMessage(message: string): boolean {
  const lower = message.toLowerCase().trim();

  const chatPatterns = [
    /^(hi|hello|hey|sup|yo|what'?s up)\b/,
    /^(how (are|is)|what do you|where are you|who|tell me|do you)/,
    /^(thanks|thank you|cool|nice|great|awesome|ok|okay|alright)\b/,
    /^(what|why|when|how|where|can you tell|do you know)/,
    /^(help|what can you do|what tools)/,
    /\?$/,  // Anything ending with a question mark
  ];

  return chatPatterns.some((p) => p.test(lower));
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

  // Multi-step indicators OR long-running single actions
  // Long-running tools (collect, craft) go through planning so the voice agent
  // gets an immediate narration ("On it, I'll collect some wood!") instead of
  // blocking the HTTP request for 30+ seconds.
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
    /^collect /,            // "collect wood" — long-running, needs immediate ack
    /^gather /,             // "gather stone"
    /^mine /,               // "mine some iron"
    /^get \d+ /,            // "get 5 oak logs"
    /^get (some|wood|stone|cobble|sand|dirt|iron|coal|diamond|gold)/, // "get some wood"
    /^craft /,              // "craft planks" — may need prerequisites
    /place .*(where|here|looking)/, // "place X where I'm looking" — use planning to pick right tool
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
  const activePlan = getActivePlan(sessionId);
  const history = getHistory(sessionId);
  history.push({ role: 'user', content: userMessage });

  const complex = isComplexRequest(userMessage);
  const isChat = isChatMessage(userMessage);

  logger.info(
    `[${sessionId}] Handling message: "${userMessage}" (complex=${complex}, chat=${isChat}, activePlan=${!!activePlan}, history=${history.length})`
  );

  // ── If bot is busy with a plan and user sends a new action request ──────
  // Cancel the active plan immediately and process the new request.
  // Voice users expect instant responsiveness — asking "want me to stop?"
  // creates a confusing loop since confirmations don't route correctly.
  if (activePlan && !isChat) {
    logger.info(`[${sessionId}] New action request while plan active — cancelling plan ${activePlan.id}`);
    await cancelPlan(sessionId, bot);
    // Fall through to process the new request normally
  }

  // ── Route: complex → planning, simple → direct loop ─────────────────────
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
  try {
    // ── Step 1: Create the plan (fast — single LLM call) ────────────────
    logger.info(`[${sessionId}] Creating plan for: "${userMessage}"`);
    const plan = await createPlan(
      { userRequest: userMessage },
      bot,
      llm,
      sessionId
    );

    logger.info(
      `[${sessionId}] Plan created: ${plan.steps.map((s) => s.tool).join(' → ')}`
    );

    // ── Step 2: Build a natural narration of the plan ───────────────────
    const narration = buildPlanNarration(plan);
    logger.info(`[${sessionId}] Plan narration: "${narration}"`);

    // Save to conversation history
    history.push({ role: 'assistant', content: narration });
    trimHistory(history);

    // ── Step 3: Execute the plan in the background (don't block) ────────
    // The voice agent gets the narration immediately.
    // Execution continues asynchronously.
    executePlan(plan, bot, llm)
      .then((result) => {
        logger.info(`[${sessionId}] Background plan result:\n${prettyJson({
          success: result.success,
          summary: result.summary,
          error: result.error,
        })}`);
      })
      .catch((err) => {
        logger.error(`[${sessionId}] Background plan failed: ${(err as Error).message}`);
      });

    return {
      response: narration,
      toolsExecuted: [],
      llmCalls: 1,
      usedPlanning: true,
      planSummary: `${plan.steps.length} steps: ${plan.steps.map((s) => s.tool).join(' → ')}`,
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

// ─── Plan Narration Builder ──────────────────────────────────────────────────

/**
 * Build a natural-sounding narration of the plan for the voice agent.
 * Uses the plan's reasoning + step descriptions to create something
 * Dory AI can say out loud, e.g.:
 *   "Alright! First I'll collect some oak logs, then craft them into planks."
 */
function buildPlanNarration(plan: { reasoning?: string; steps: Array<{ tool: string; parameters: Record<string, any>; expectedOutcome?: string }> }): string {
  // Use the LLM's reasoning if it's a good summary
  if (plan.reasoning && plan.reasoning.length > 10 && plan.reasoning.length < 200) {
    return plan.reasoning;
  }

  // Otherwise build from steps
  const stepDescriptions = plan.steps.map((step, i) => {
    return describeStep(step.tool, step.parameters, i, plan.steps.length);
  });

  if (stepDescriptions.length === 0) {
    return "Let me work on that for you!";
  }

  if (stepDescriptions.length === 1) {
    return `On it! I'll ${stepDescriptions[0]}.`;
  }

  // "First I'll X, then Y, and finally Z."
  const first = stepDescriptions[0];
  const rest = stepDescriptions.slice(1, -1);
  const last = stepDescriptions[stepDescriptions.length - 1];

  let narration = `Here's my plan: first I'll ${first}`;
  for (const mid of rest) {
    narration += `, then ${mid}`;
  }
  narration += `, and finally ${last}. Let me get started!`;

  return narration;
}

/**
 * Describe a single plan step in natural language.
 */
function describeStep(tool: string, params: Record<string, any>, _index: number, _total: number): string {
  switch (tool) {
    case 'collect_resource':
      return `collect ${params.count || 'some'} ${params.block_type || 'blocks'}`;
    case 'craft_item':
      return `craft ${params.count || ''} ${params.item_name || 'an item'}`.trim();
    case 'go_to_player':
    case 'come_to_me':
      return `come to you`;
    case 'follow_player':
      return `follow you`;
    case 'go_to_position':
      return `go to (${params.x}, ${params.y}, ${params.z})`;
    case 'place_block':
      return `place ${params.block_type || 'a block'}`;
    case 'build_pillar':
      return `build a ${params.height || 3}-block pillar`;
    case 'build_wall':
      return `build a wall`;
    case 'get_inventory':
      return `check inventory`;
    case 'look_around':
      return `look around`;
    case 'equip_item':
      return `equip ${params.item_name || 'an item'}`;
    case 'drop_item':
      return `drop ${params.count === -1 ? 'all' : params.count || 'some'} ${params.item_name || 'items'}`;
    case 'eat':
      return `eat something`;
    case 'stop':
      return `stop what I'm doing`;
    default:
      return tool.replace(/_/g, ' ');
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

/**
 * A2A Message Handler
 *
 * Handles incoming A2A messages from the voice agent (or any external agent).
 * Routes messages through the existing handleMessage pipeline.
 *
 * Uses the first active bot session, or returns an error if none exist.
 */

import { createLogger } from '@dory/shared';
import { BotManager } from '../bot/bot-manager';
import { handleMessage } from '../agent';
import { getLLMClient } from '../llm';

const logger = createLogger('A2AHandler');

export interface A2AMessageRequest {
  message: string;
  /** Optional: target a specific bot session */
  sessionId?: string;
}

export interface A2AMessageResponse {
  success: boolean;
  response?: string;
  toolsExecuted?: Array<{ name: string; args: Record<string, any>; result: string }>;
  error?: string;
  sessionId?: string;
  usedPlanning?: boolean;
}

/**
 * Handle an incoming A2A message.
 *
 * Finds the best bot session to route the message to:
 * 1. If sessionId is provided, use that session
 * 2. Otherwise, use the first active session
 * 3. If no sessions exist, return an error
 */
export async function handleA2AMessage(
  req: A2AMessageRequest
): Promise<A2AMessageResponse> {
  const { message, sessionId: requestedSession } = req;

  logger.info(`━━━ A2A MESSAGE RECEIVED ━━━`);
  logger.info(`  Message: "${message}"`);
  logger.info(`  Requested session: ${requestedSession || '(auto-detect)'}`);

  // Find the right bot session
  const sessionId = resolveSession(requestedSession);
  if (!sessionId) {
    const activeSessions = BotManager.getActiveSessions();
    logger.warn(`  No active bot session found (total sessions: ${activeSessions.length})`);
    return {
      success: false,
      error: 'No active bot session. The bot needs to be connected first — try saying "join the game".',
    };
  }

  logger.info(`  Resolved session: ${sessionId}`);

  const bot = BotManager.getBot(sessionId);
  if (!bot) {
    logger.error(`  Bot not found for session: ${sessionId}`);
    return {
      success: false,
      error: `Bot session "${sessionId}" not found.`,
    };
  }

  logger.info(`  Bot: ${bot.username} at (${Math.round(bot.position?.x || 0)}, ${Math.round(bot.position?.y || 0)}, ${Math.round(bot.position?.z || 0)})`);

  const llm = getLLMClient();
  if (!llm) {
    logger.error('  LLM not configured');
    return {
      success: false,
      error: 'LLM not configured on game agent. Set API keys in .env.',
    };
  }

  logger.info(`  LLM: ${llm.name} / ${llm.model}`);
  logger.info(`  Processing message through handleMessage...`);

  try {
    const startTime = Date.now();
    const result = await handleMessage(sessionId, bot, llm, message);
    const elapsed = Date.now() - startTime;

    const toolNames = result.toolsExecuted.map(t => t.name).join(', ') || '(none)';

    logger.info(`━━━ A2A RESPONSE (${elapsed}ms) ━━━`);
    logger.info(`  Response: "${result.response.substring(0, 200)}${result.response.length > 200 ? '...' : ''}"`);
    logger.info(`  Tools: ${toolNames}`);
    logger.info(`  LLM calls: ${result.llmCalls}, Planning: ${result.usedPlanning}`);

    return {
      success: true,
      response: result.response,
      toolsExecuted: result.toolsExecuted,
      sessionId,
      usedPlanning: result.usedPlanning,
    };
  } catch (error) {
    logger.error(`━━━ A2A ERROR ━━━`);
    logger.error(`  ${(error as Error).message}`);
    logger.error(`  Stack: ${(error as Error).stack?.split('\n').slice(0, 3).join(' → ')}`);
    return {
      success: false,
      error: `Failed to process message: ${(error as Error).message}`,
      sessionId,
    };
  }
}

/**
 * Resolve which session to use for an A2A message.
 */
function resolveSession(requestedSession?: string): string | null {
  // If a specific session was requested, use it
  if (requestedSession) {
    const bot = BotManager.getBot(requestedSession);
    if (bot) return requestedSession;
    logger.warn(`  Requested session "${requestedSession}" not found, falling back to auto-detect`);
  }

  // Otherwise, find the first active session
  const sessions = BotManager.getActiveSessions();
  logger.info(`  Active sessions: ${sessions.length > 0 ? sessions.join(', ') : '(none)'}`);

  if (sessions.length > 0) {
    return sessions[0];
  }

  return null;
}

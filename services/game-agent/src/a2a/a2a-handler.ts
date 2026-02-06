/**
 * A2A Message Handler
 *
 * Handles incoming A2A messages from the voice agent (or any external agent).
 * Routes messages through the existing handleMessage pipeline.
 *
 * Uses a default session ("a2a-session") or the first active bot session.
 */

import { createLogger } from '@dory/shared';
import { BotManager } from '../bot/bot-manager';
import { handleMessage } from '../agent';
import { getLLMClient } from '../llm';

const logger = createLogger('A2AHandler');

/** Default session ID for A2A messages when no specific session is provided */
const A2A_DEFAULT_SESSION = 'a2a-default-session';

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

  logger.info(`Incoming A2A message: "${message}" (session: ${requestedSession || 'auto'})`);

  // Find the right bot session
  const sessionId = resolveSession(requestedSession);
  if (!sessionId) {
    logger.warn('No active bot session found for A2A message');
    return {
      success: false,
      error: 'No active bot session. Create a bot session first (POST /api/sessions).',
    };
  }

  const bot = BotManager.getBot(sessionId);
  if (!bot) {
    return {
      success: false,
      error: `Bot session "${sessionId}" not found.`,
    };
  }

  const llm = getLLMClient();
  if (!llm) {
    return {
      success: false,
      error: 'LLM not configured on game agent.',
    };
  }

  try {
    const result = await handleMessage(sessionId, bot, llm, message);

    logger.info(
      `A2A response: "${result.response.substring(0, 100)}..." ` +
        `(tools: ${result.toolsExecuted.length}, planning: ${result.usedPlanning})`
    );

    return {
      success: true,
      response: result.response,
      toolsExecuted: result.toolsExecuted,
      sessionId,
      usedPlanning: result.usedPlanning,
    };
  } catch (error) {
    logger.error(`A2A message handling failed: ${(error as Error).message}`);
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
  }

  // Otherwise, find the first active session
  const sessions = BotManager.getActiveSessions();
  if (sessions.length > 0) {
    return sessions[0];
  }

  return null;
}

/**
 * Game Tools
 *
 * Tools for the Persona Builder agent to transition users
 * into gaming mode with their created/saved persona.
 * Handles conversation summarization and mode change.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { getConfig } from '../config/index.js';
import {
  isAuthenticated,
  getUserId,
  getSession,
  getMessages,
  getDraftPersona,
  getEditingPersonaId,
  isEditingExisting,
  wasPersonaSavedThisTurn,
} from '../services/session.js';
import type { OutgoingMessage, AppMode } from '../types/persona.js';
import {
  summarizeConversation,
  getRecentMessages,
  formatSummaryForPrompt,
  type ConversationMessage,
} from '@dory/shared';

/**
 * Tool execution context (same interface as persona-tools)
 */
export interface GameToolContext {
  sessionId: string;
  sendToClient: (message: OutgoingMessage) => void;
}

/**
 * Create game tools with session context
 */
export function createGameTools(context: GameToolContext) {
  const config = getConfig();

  return {
    /**
     * Transition to gaming mode with the current persona.
     * Called when the user wants to play with their just-created or saved persona.
     */
    playWithPersona: tool({
      description: `⚠️ CRITICAL: Persona MUST be saved (have an ID) before calling this tool. Start playing games with the current persona. Use this when the user says they want to play, test, or game with their persona. Requires:
1. Persona must be saved (have an ID) - NEVER call this if persona is not saved
If persona is not saved yet, tell the user to save first using savePersona tool.`,
      parameters: z.object({
        personaId: z.string().optional().describe('The persona ID to play with. If not provided, uses the currently saved persona from this session.'),
      }),
      execute: async ({ personaId: explicitPersonaId }) => {
        console.log(`[Tool:playWithPersona] Initiating game transition`);

        // Block if persona was just saved this turn - user hasn't had a chance to explicitly request playing
        if (wasPersonaSavedThisTurn(context.sessionId)) {
          console.log('[Tool:playWithPersona] ⛔ Blocked - persona was saved this same turn. User must explicitly request playing first.');
          return {
            success: false,
            error: 'Persona was just saved this turn. Wait for the user to explicitly request playing before calling playWithPersona. Do NOT call playWithPersona in the same turn as savePersona.',
          };
        }

        // CRITICAL: First check - verify persona was saved before proceeding
        // Never generate personaId - only retrieve from saved persona
        const isSaved = isEditingExisting(context.sessionId);
        const editingId = getEditingPersonaId(context.sessionId);

        if (!isSaved && !editingId) {
          // Persona was never saved - return clear error
          const draft = getDraftPersona(context.sessionId);
          const hasName = !!draft.identity?.name;

          if (hasName) {
            return {
              success: false,
              error: 'This persona must be saved first before playing. Call savePersona to save it, then you can start playing!',
            };
          }

          return {
            success: false,
            error: 'No saved persona found. Please save your persona first using savePersona.',
          };
        }

        // Determine persona ID - ONLY from saved persona, never generate
        const targetPersonaId = explicitPersonaId || editingId;

        // Final validation - ensure we have a valid personaId
        if (!targetPersonaId || targetPersonaId.trim() === '') {
          console.error('[Tool:playWithPersona] ⛔ Invalid personaId - cannot proceed');
          return {
            success: false,
            error: 'Invalid persona ID. Cannot transition to gaming mode. Please save your persona first.',
          };
        }

        // Summarize conversation before transitioning
        let conversationSummary: string | undefined;
        const messages = getMessages(context.sessionId);

        if (messages.length > 2) {
          console.log(`[Tool:playWithPersona] Summarizing ${messages.length} messages...`);

          try {
            const recentMsgs: ConversationMessage[] = getRecentMessages(
              messages.map(m => ({ role: m.role, content: m.content })),
              10
            );

            const summary = await summarizeConversation(recentMsgs, config.GROQ_API_KEY);
            conversationSummary = formatSummaryForPrompt(summary);

            console.log(`[Tool:playWithPersona] ✅ Summary: ${conversationSummary.substring(0, 80)}...`);
          } catch (error) {
            console.error('[Tool:playWithPersona] ⚠️ Summary failed:', error);
            conversationSummary = 'User just created a persona in the persona builder and wants to play with it.';
          }
        } else {
          conversationSummary = 'User created a persona and wants to start playing.';
        }

        // Final safety check before sending mode_change - never send without valid personaId
        if (!targetPersonaId || targetPersonaId.trim() === '') {
          console.error('[Tool:playWithPersona] ⛔ CRITICAL: Attempted to send mode_change with invalid personaId');
          return {
            success: false,
            error: 'Invalid persona ID. Cannot transition to gaming mode.',
          };
        }

        // Send mode_change to client
        const modeChangeMessage: OutgoingMessage = {
          type: 'mode_change',
          mode: 'GAMER_AGENT' as AppMode,
          personaId: targetPersonaId,
          conversationSummary,
          timestamp: new Date().toISOString(),
        };

        context.sendToClient(modeChangeMessage);

        console.log(`[Tool:playWithPersona] ✅ Sent mode_change to GAMER_AGENT with persona: ${targetPersonaId}`);

        // Fetch persona name for the response message
        const draft = getDraftPersona(context.sessionId);
        const personaName = draft.identity?.name || 'your persona';

        return {
          success: true,
          personaId: targetPersonaId,
          mode: 'GAMER_AGENT',
          message: `Starting game session with ${personaName}! Transitioning to gaming mode.`,
        };
      },
    }),
  };
}

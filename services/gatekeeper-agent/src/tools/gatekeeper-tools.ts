/**
 * Gatekeeper Tools
 *
 * Tools for the gatekeeper agent to handle:
 * - Fetching personas from persona-builder service
 * - Mode transitions between GATEKEEPER, PERSONA_BUILDER, GAMER_AGENT
 *
 * No authentication required - all users are treated as authenticated.
 *
 * Follows the Vercel AI SDK tool pattern.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { getConfig } from '../config/index.js';
import {
  getSession,
  getMessages,
  setCurrentMode,
  setPendingPersonas,
  setSelectedPersonaId,
  setPersonasFetchedThisTurn,
  werePersonasFetchedThisTurn,
  type AppMode,
  type PersonaSummary,
} from '../services/session.js';
import type { OutgoingMessage } from '../services/websocket.js';
import {
  summarizeConversation,
  getRecentMessages,
  formatSummaryForPrompt,
  type ConversationMessage,
} from '@dory/shared';

/** API response types */

interface PersonaApiResponse {
  personas: Array<{
    id: string;
    identity?: { name?: string; tagline?: string };
    description?: string;
    visualIdentity?: { avatarUrl?: string | null };
  }>;
  count: number;
}

/**
 * Tool execution context passed to each tool
 */
export interface ToolContext {
  sessionId: string;
  sendToClient: (message: OutgoingMessage) => void;
}

/**
 * Create gatekeeper tools with session context
 */
export function createGatekeeperTools(context: ToolContext) {
  const config = getConfig();

  return {
    /**
     * Fetch popular personas from persona-builder service
     */
    fetchPopularPersonas: tool({
      description: 'Fetch the most recent published personas from the vault. Call this when user wants to play games, so they can choose a companion.',
      parameters: z.object({
        limit: z.number().min(1).max(10).default(5).describe('Number of personas to fetch (1-10, default 5)'),
      }),
      execute: async ({ limit = 5 }) => {
        console.log(`[Tool:fetchPopularPersonas] Fetching ${limit} personas`);

        try {
          const response = await fetch(
            `${config.PERSONA_BUILDER_URL}/api/personas/public?limit=${limit}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            }
          );

          if (!response.ok) {
            console.error(`[Tool:fetchPopularPersonas] API error: ${response.status}`);
            return {
              success: false,
              error: 'Could not load personas. Try again.'
            };
          }

          const data = await response.json() as PersonaApiResponse;
          const personas = data.personas || [];

          if (personas.length === 0) {
            return {
              success: true,
              personas: [],
              message: 'No personas available yet. Suggest the user create one instead.'
            };
          }

          // Transform to PersonaSummary format
          const summaries: PersonaSummary[] = personas.map((p) => ({
            id: p.id,
            name: p.identity?.name || 'Unknown',
            tagline: p.identity?.tagline,
            description: p.description,
            imageUrl: p.visualIdentity?.avatarUrl,
          }));

          // Store in session for reference
          setPendingPersonas(context.sessionId, summaries);
          setPersonasFetchedThisTurn(context.sessionId);

          // Send persona list to client for UI rendering
          context.sendToClient({
            type: 'persona_list',
            personas: summaries,
            timestamp: new Date().toISOString(),
          });

          console.log(`[Tool:fetchPopularPersonas] Found ${summaries.length} personas`);

          // Build a text description for the LLM to use
          const personaDescriptions = summaries.map((p, i) =>
            `${i + 1}. ${p.name}${p.tagline ? ` - "${p.tagline}"` : ''}`
          ).join('\n');

          return {
            success: true,
            count: summaries.length,
            personas: summaries,
            message: `Found ${summaries.length} companions in the vault. The client will display them for selection. Available:\n${personaDescriptions}\n\nIMPORTANT: Present these options to the user and WAIT for their response. Do NOT call changeMode yet - let the user choose first.`
          };
        } catch (error) {
          console.error('[Tool:fetchPopularPersonas] Error:', error);
          return {
            success: false,
            error: 'Could not reach the persona vault. Try again later.'
          };
        }
      },
    }),

    /**
     * Change application mode - orchestrate transitions between states
     */
    changeMode: tool({
      description: `Change the application mode. Use this to transition users between different parts of the platform:
- PERSONA_BUILDER: For creating/editing personas
- GAMER_AGENT: For playing games with a persona (requires personaId)
- GATEKEEPER: Return to the main menu`,
      parameters: z.object({
        mode: z.enum(['GATEKEEPER', 'PERSONA_BUILDER', 'GAMER_AGENT']).describe('The mode to transition to'),
        personaId: z.string().optional().describe('Required when mode is GAMER_AGENT - the ID of the selected persona'),
        initialPrompt: z.string().optional().describe('Optional initial prompt to pass to PERSONA_BUILDER for context'),
      }),
      execute: async ({ mode, personaId, initialPrompt }) => {
        console.log(`[Tool:changeMode] Transitioning to: ${mode}`);

        const session = getSession(context.sessionId);

        // Validate requirements for each mode
        if (mode === 'GAMER_AGENT') {
          // Block if personas were just fetched this turn - user hasn't had a chance to choose
          if (werePersonasFetchedThisTurn(context.sessionId)) {
            console.log('[Tool:changeMode] Blocked - personas were fetched this same turn. User must select first.');
            return {
              success: false,
              error: 'Personas were just shown to the user. Wait for the user to select a persona before calling changeMode. Do NOT call changeMode in the same turn as fetchPopularPersonas.',
            };
          }

          // Gaming requires a persona selection (check parameter first)
          if (!personaId) {
            return {
              success: false,
              error: 'A persona must be selected to play games. Call fetchPopularPersonas first or have user select one.'
            };
          }

          // Store selected persona
          setSelectedPersonaId(context.sessionId, personaId);
        }

        // Summarize conversation before mode change (for context preservation)
        let conversationSummary: string | undefined;
        const messages = getMessages(context.sessionId);

        if (messages.length > 1) {
          console.log(`[Tool:changeMode] Summarizing ${messages.length} messages...`);

          try {
            const recentMsgs: ConversationMessage[] = getRecentMessages(
              messages.map(m => ({ role: m.role, content: m.content })),
              10
            );

            const summary = await summarizeConversation(recentMsgs, config.GROQ_API_KEY);
            conversationSummary = formatSummaryForPrompt(summary);

            console.log(`[Tool:changeMode] Summary: ${conversationSummary.substring(0, 80)}...`);
          } catch (error) {
            console.error('[Tool:changeMode] Summary failed:', error);
            conversationSummary = 'User was talking to the gatekeeper before switching.';
          }
        } else {
          // Short conversation - build a minimal summary from the messages we have
          const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
          conversationSummary = userMessages.length > 0
            ? `User said: "${userMessages.join('" then "')}" before switching to ${mode}.`
            : `User chose to switch to ${mode} from the gatekeeper.`;
          console.log(`[Tool:changeMode] Short conversation - minimal summary: ${conversationSummary}`);
        }

        // Update session mode
        setCurrentMode(context.sessionId, mode);

        // Build the mode_change message
        const message: OutgoingMessage = {
          type: 'mode_change',
          mode,
          conversationSummary,
          timestamp: new Date().toISOString(),
        };

        // Include personaId for GAMER_AGENT mode
        if (mode === 'GAMER_AGENT' && personaId) {
          message.personaId = personaId;
        }

        // Include initial prompt for persona builder
        // If the LLM didn't pass an explicit initialPrompt, use the user's last message
        if (mode === 'PERSONA_BUILDER') {
          if (initialPrompt) {
            message.initialPrompt = initialPrompt;
          } else {
            // Auto-extract the user's last message as the initial prompt
            const userMessages = messages.filter(m => m.role === 'user');
            const lastUserMessage = userMessages[userMessages.length - 1]?.content;
            if (lastUserMessage) {
              message.initialPrompt = lastUserMessage;
              console.log(`[Tool:changeMode] Auto-extracted initialPrompt: "${lastUserMessage.substring(0, 50)}"`);
            }
          }
        }

        // Send mode change to client
        context.sendToClient(message);

        console.log(`[Tool:changeMode] Sent mode_change to client: ${mode}`);

        // Return appropriate message based on mode
        const modeMessages: Record<AppMode, string> = {
          'GATEKEEPER': 'Back to main menu.',
          'PERSONA_BUILDER': 'Opening persona builder.',
          'GAMER_AGENT': `Starting game with persona ${personaId}.`,
        };

        return {
          success: true,
          mode,
          message: modeMessages[mode]
        };
      },
    }),

    /**
     * Get detailed information about a specific persona
     */
    getPersonaDetails: tool({
      description: 'Fetch detailed information about a specific persona when user wants to know more before selecting. Use when user says "tell me more about X" or asks about a specific companion.',
      parameters: z.object({
        personaId: z.string().describe('The ID of the persona to fetch details for'),
      }),
      execute: async ({ personaId }) => {
        console.log(`[Tool:getPersonaDetails] Fetching persona: ${personaId}`);

        try {
          const response = await fetch(
            `${config.PERSONA_BUILDER_URL}/api/personas/public/${personaId}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            }
          );

          if (!response.ok) {
            return {
              success: false,
              error: 'Could not load persona details.',
            };
          }

          const data = await response.json() as any;
          const persona = data.persona || data;

          // Return formatted details for LLM to present
          return {
            success: true,
            persona: {
              id: persona.id,
              name: persona.identity?.name || 'Unknown',
              tagline: persona.identity?.tagline || '',
              backstory: persona.identity?.backstory || '',
              description: persona.description || '',
              traits: persona.personality?.traits || [],
              archetype: persona.personality?.archetype || '',
              playstyle: persona.gaming?.playstyle || '',
              avatarUrl: persona.visualIdentity?.avatarUrl || null,
            },
            message: 'Present these details to the user in an engaging way. If they want to play with this persona, call changeMode with GAMER_AGENT and this personaId.',
          };
        } catch (error) {
          console.error('[Tool:getPersonaDetails] Error:', error);
          return {
            success: false,
            error: 'Could not fetch persona details.',
          };
        }
      },
    }),
  };
}

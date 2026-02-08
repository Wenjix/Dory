/**
 * Draft Recovery Service
 *
 * Reconstructs draft persona state from conversation history if the draft
 * state is lost or corrupted. Uses LLM to extract structured data from
 * unstructured conversation messages.
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getConfig } from '../config/index.js';
import type { DraftPersona } from './session.js';
import { getMessages, hasModeTransitionOccurred } from './session.js';

// Lazy-initialized OpenAI client
let openaiClient: ReturnType<typeof createOpenAI> | null = null;

function getOpenAIClient() {
  if (!openaiClient) {
    const config = getConfig();
    openaiClient = createOpenAI({
      apiKey: config.OPENAI_API_KEY,
      ...(config.OPENAI_BASE_URL && { baseURL: config.OPENAI_BASE_URL }),
    });
  }
  return openaiClient;
}

/**
 * Attempt to recover draft persona from conversation history
 * Uses LLM to extract structured persona data from messages
 */
export async function recoverDraftFromHistory(sessionId: string): Promise<DraftPersona | null> {
  try {
    const messages = getMessages(sessionId);

    // Need at least a few messages to recover from
    if (messages.length < 2) {
      console.log(`[DraftRecovery] Not enough messages to recover (${messages.length} messages)`);
      return null;
    }

    // Build conversation context
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    console.log(`[DraftRecovery] Attempting to recover draft from ${messages.length} messages...`);

    const prompt = `You are analyzing a conversation where a user is building an AI gaming companion persona.

Extract the persona information that has been discussed so far. Return ONLY a JSON object with this structure:
{
  "identity": {
    "species": "string or null",
    "name": "string or null",
    "tagline": "string or null",
    "backstory": "string or null",
    "ageImpression": "string or null"
  },
  "description": "string or null",
  "personality": {
    "archetype": "string or null",
    "traits": ["string"] or null,
    "emotionalTendency": "string or null"
  },
  "gaming": {
    "playstyle": "string or null",
    "riskTolerance": "string or null"
  }
}

Only include fields that were explicitly mentioned in the conversation. Use null for missing fields.
Do not make up information that wasn't discussed.

Conversation:
${conversationText}

Return ONLY the JSON object, no other text.`;

    const result = await generateText({
      model: getOpenAIClient()('gpt-4o-mini'),
      prompt,
      temperature: 0.1, // Low temperature for structured extraction
    });

    const jsonText = result.text.trim();
    // Try to extract JSON from response (might have markdown code blocks)
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[DraftRecovery] No JSON found in LLM response`);
      return null;
    }

    const recovered = JSON.parse(jsonMatch[0]) as Partial<DraftPersona>;

    // Helper: check if a value is actually meaningful (not null, not string "null", not empty)
    const isValidValue = (v: unknown): boolean => {
      if (v === null || v === undefined) return false;
      if (typeof v === 'string') return v.trim() !== '' && v.trim().toLowerCase() !== 'null';
      if (Array.isArray(v)) return v.length > 0 && v.some(item => isValidValue(item));
      return true;
    };

    // Helper: strip null/string-"null" values from an object
    const stripNulls = <T extends Record<string, unknown>>(obj: T): T => {
      const result = { ...obj };
      for (const key of Object.keys(result)) {
        if (!isValidValue(result[key])) {
          delete result[key];
        }
      }
      return result;
    };

    // Clean up the recovered data (remove null values, string "null", and ensure proper structure)
    const cleanedIdentity = recovered.identity ? stripNulls(recovered.identity as Record<string, unknown>) : undefined;
    const cleanedVisual = recovered.visualIdentity ? stripNulls(recovered.visualIdentity as Record<string, unknown>) : undefined;
    const cleanedPersonality = recovered.personality ? stripNulls(recovered.personality as Record<string, unknown>) : undefined;
    const cleanedGaming = recovered.gaming ? stripNulls(recovered.gaming as Record<string, unknown>) : undefined;

    const cleaned: DraftPersona = {
      identity: cleanedIdentity && Object.keys(cleanedIdentity).length > 0
        ? cleanedIdentity as Partial<DraftPersona['identity']>
        : undefined,
      description: isValidValue(recovered.description) ? recovered.description as string : undefined,
      visualIdentity: cleanedVisual && Object.keys(cleanedVisual).length > 0
        ? cleanedVisual as Partial<DraftPersona['visualIdentity']>
        : undefined,
      personality: cleanedPersonality && Object.keys(cleanedPersonality).length > 0
        ? cleanedPersonality as Partial<DraftPersona['personality']>
        : undefined,
      gaming: cleanedGaming && Object.keys(cleanedGaming).length > 0
        ? cleanedGaming as Partial<DraftPersona['gaming']>
        : undefined,
    };

    console.log(`[DraftRecovery] ✅ Recovered draft persona:`, {
      hasSpecies: !!cleaned.identity?.species,
      hasName: !!cleaned.identity?.name,
      hasDescription: !!cleaned.description,
      hasPersonality: !!cleaned.personality?.traits?.length,
      hasGaming: !!cleaned.gaming?.playstyle,
    });

    return cleaned;
  } catch (error) {
    console.error(`[DraftRecovery] ❌ Failed to recover draft from history:`, error);
    return null;
  }
}

/**
 * Check if draft state appears to be lost and attempt recovery
 * Returns recovered draft if successful, null otherwise
 */
export async function attemptDraftRecovery(sessionId: string): Promise<DraftPersona | null> {
  // Don't attempt recovery if mode transition occurred (user is in gaming mode)
  if (hasModeTransitionOccurred(sessionId)) {
    console.log(`[DraftRecovery] Skipping recovery - mode transition to GAMER_AGENT occurred`);
    return null;
  }

  const messages = getMessages(sessionId);

  // Only attempt recovery if we have substantial conversation history
  // and it seems like persona building was in progress
  if (messages.length < 3) {
    return null;
  }

  // Check if conversation mentions persona-related keywords
  const conversationText = messages.map(m => m.content).join(' ').toLowerCase();
  const personaKeywords = ['species', 'name', 'art style', 'personality', 'gaming', 'playstyle', 'avatar', 'companion', 'character'];
  const hasPersonaContent = personaKeywords.some(keyword => conversationText.includes(keyword));

  if (!hasPersonaContent) {
    console.log(`[DraftRecovery] Conversation doesn't appear to be about persona building`);
    return null;
  }

  console.log(`[DraftRecovery] Attempting recovery for session: ${sessionId}`);
  return await recoverDraftFromHistory(sessionId);
}

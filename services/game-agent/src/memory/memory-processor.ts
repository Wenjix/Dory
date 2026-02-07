/**
 * Memory Processor
 *
 * Receives conversation history from the voice agent and uses the LLM
 * to extract meaningful information:
 *   - User preferences  (e.g. "likes building with oak")
 *   - Personality traits (e.g. "explorer", "creative builder")
 *   - Goals             (e.g. "wants to build a castle")
 *   - Notable topics    (e.g. "discussed mining strategies")
 *
 * Extracted data is stored as SemanticMemory documents in MongoDB.
 */

import { getLLMClient } from '../llm/instance.js';
import { getMemoriesCollection } from './database.js';
import type {
  SemanticMemory,
  ConversationContextPayload,
  MemoryProcessingResult,
} from './types.js';

// ---------------------------------------------------------------------------
// LLM extraction prompt
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `You are a memory extraction agent for an AI Minecraft companion named Dory.

Analyze the following conversation between the player and Dory. Extract any meaningful information that Dory should remember about the player for future interactions.

Return a JSON object with ONLY the fields that have actual content (omit empty arrays):

{
  "preferences": [
    { "key": "short_identifier", "value": "description", "confidence": 0.0-1.0 }
  ],
  "personality": [
    { "trait": "one or two words", "evidence": "brief reason" }
  ],
  "goals": [
    { "description": "what the player wants to achieve", "status": "active" }
  ],
  "topics": ["topic1", "topic2"],
  "summary": "One or two sentence summary of what happened in this conversation."
}

Rules:
- Only extract REAL information explicitly stated or strongly implied by the player.
- Do NOT invent or assume preferences that weren't expressed.
- Confidence should reflect how explicitly the player stated something (1.0 = they said it directly, 0.5 = implied).
- Keep everything concise — this will be stored in a database.
- If the conversation is just small talk with no extractable info, return: { "summary": "Brief chat with no notable preferences or goals." }
- Return ONLY valid JSON, no markdown fences, no explanation.`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Process conversation context from the voice agent.
 * Extracts preferences/personality/goals via LLM and stores them.
 */
export async function processConversationContext(
  payload: ConversationContextPayload
): Promise<MemoryProcessingResult> {
  const { sessionId, userId, conversationHistory } = payload;

  console.log(
    `[Memory Processor] Processing ${conversationHistory.length} messages for user ${userId}`
  );

  const result: MemoryProcessingResult = {
    memoriesCreated: 0,
    preferencesExtracted: [],
    summaryUpdated: false,
    errors: [],
  };

  if (conversationHistory.length === 0) return result;

  // ── Build conversation text for the LLM ─────────────────────────────────
  const conversationText = conversationHistory
    .map((m) => `${m.role === 'user' ? 'Player' : 'Dory'}: ${m.content}`)
    .join('\n');

  // ── Call LLM for extraction ─────────────────────────────────────────────
  const llm = getLLMClient();
  if (!llm) {
    console.warn('[Memory Processor] LLM client not available, skipping extraction');
    result.errors!.push('LLM client not available');
    return result;
  }

  let extracted: ExtractedData;
  try {
    const response = await llm.complete({
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: conversationText },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const raw = response.message.content?.trim() || '{}';
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    extracted = JSON.parse(cleaned);
    console.log('[Memory Processor] LLM extraction:', JSON.stringify(extracted, null, 2));
  } catch (error) {
    console.error('[Memory Processor] LLM extraction failed:', error);
    result.errors!.push(`LLM extraction failed: ${(error as Error).message}`);
    return result;
  }

  const collection = getMemoriesCollection();
  const now = new Date();

  // ── Store preferences ───────────────────────────────────────────────────
  if (extracted.preferences && extracted.preferences.length > 0) {
    for (const pref of extracted.preferences) {
      const mem: SemanticMemory = {
        sessionId,
        userId,
        type: 'semantic',
        timestamp: now,
        lastAccessed: now,
        importance: 0.85,
        tags: ['preference', 'user_preference', pref.key],
        textContent: `User preference: ${pref.value}`,
        source: 'conversation',
        metadata: { extractedBy: 'llm' },
        data: {
          category: 'user_preference',
          key: pref.key,
          value: pref.value,
          confidence: pref.confidence ?? 0.8,
          lastUpdated: now,
        },
      };

      await collection.insertOne(mem as any);
      result.memoriesCreated++;
      result.preferencesExtracted.push(pref.key);
      console.log(`[Memory Processor] Stored preference: ${pref.key} = ${pref.value}`);
    }
  }

  // ── Store personality traits ─────────────────────────────────────────────
  if (extracted.personality && extracted.personality.length > 0) {
    const traits = extracted.personality.map((p) => p.trait);
    const mem: SemanticMemory = {
      sessionId,
      userId,
      type: 'semantic',
      timestamp: now,
      lastAccessed: now,
      importance: 0.8,
      tags: ['personality', ...traits],
      textContent: `Player personality traits: ${traits.join(', ')}`,
      source: 'conversation',
      metadata: {
        extractedBy: 'llm',
        evidence: extracted.personality.map((p) => ({
          trait: p.trait,
          evidence: p.evidence,
        })),
      },
      data: {
        category: 'personality',
        key: 'personality_traits',
        value: { traits, details: extracted.personality },
        confidence: 0.7,
        lastUpdated: now,
      },
    };

    await collection.insertOne(mem as any);
    result.memoriesCreated++;
    console.log(`[Memory Processor] Stored personality: ${traits.join(', ')}`);
  }

  // ── Store goals ─────────────────────────────────────────────────────────
  if (extracted.goals && extracted.goals.length > 0) {
    for (const goal of extracted.goals) {
      const mem: SemanticMemory = {
        sessionId,
        userId,
        type: 'semantic',
        timestamp: now,
        lastAccessed: now,
        importance: 0.75,
        tags: ['goal', goal.status || 'active'],
        textContent: `Player goal: ${goal.description} (${goal.status || 'active'})`,
        source: 'conversation',
        metadata: { extractedBy: 'llm' },
        data: {
          category: 'goal',
          key: `goal_${Date.now()}`,
          value: { description: goal.description, status: goal.status || 'active' },
          confidence: 0.75,
          lastUpdated: now,
        },
      };

      await collection.insertOne(mem as any);
      result.memoriesCreated++;
      console.log(`[Memory Processor] Stored goal: ${goal.description}`);
    }
  }

  // ── Store conversation summary ──────────────────────────────────────────
  if (extracted.summary) {
    const mem: SemanticMemory = {
      sessionId,
      userId,
      type: 'semantic',
      timestamp: now,
      lastAccessed: now,
      importance: 0.6,
      tags: ['conversation', 'summary', ...(extracted.topics || [])],
      textContent: `Conversation summary: ${extracted.summary}`,
      source: 'conversation',
      metadata: {
        extractedBy: 'llm',
        messageCount: conversationHistory.length,
        topics: extracted.topics,
      },
      data: {
        category: 'knowledge',
        key: `conversation_summary_${sessionId}_${Date.now()}`,
        value: {
          summary: extracted.summary,
          topics: extracted.topics,
          messageCount: conversationHistory.length,
        },
        confidence: 0.8,
        lastUpdated: now,
      },
    };

    await collection.insertOne(mem as any);
    result.memoriesCreated++;
    result.summaryUpdated = true;
    console.log(`[Memory Processor] Stored summary: ${extracted.summary}`);
  }

  console.log(
    `[Memory Processor] Done: ${result.memoriesCreated} memories, ${result.preferencesExtracted.length} preferences`
  );

  return result;
}

// ---------------------------------------------------------------------------
// Types for LLM extraction output
// ---------------------------------------------------------------------------

interface ExtractedData {
  preferences?: Array<{ key: string; value: string; confidence?: number }>;
  personality?: Array<{ trait: string; evidence: string }>;
  goals?: Array<{ description: string; status?: string }>;
  topics?: string[];
  summary?: string;
}

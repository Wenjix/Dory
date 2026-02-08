/**
 * Conversation Summarizer Service
 *
 * Shared service for summarizing conversations using a fast LLM (OpenAI or Groq).
 * Used during agent transitions to preserve conversation context.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ConversationSummary {
  summary: string;
  keyPoints: string[];
  userPreferences?: string;
  emotionalTone?: string;
}

/**
 * Summarize a conversation history into a concise context.
 * Uses fast LLM (OpenAI or Groq) to create a compact summary suitable
 * for injection into the next agent's system prompt.
 */
export async function summarizeConversation(
  messages: ConversationMessage[],
  apiKey: string,
  baseURL?: string
): Promise<ConversationSummary> {
  console.log(`[Summarizer] Processing ${messages.length} messages...`);

  if (messages.length <= 2) {
    console.log(`[Summarizer] Conversation too short, skipping`);
    return {
      summary: 'Brief initial greeting.',
      keyPoints: [],
    };
  }

  const startTime = Date.now();

  // Determine if using Groq (for model selection)
  const isGroq = baseURL === 'https://api.groq.com/openai/v1';
  
  // Use provided baseURL (for OpenRouter support) or default to OpenAI
  const client = createOpenAI({
    apiKey: apiKey,
    ...(baseURL && { baseURL }), // Use provided baseURL (OpenRouter, Groq, or custom)
  });

  const conversationText = messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const prompt = `Summarize this conversation between a user and an AI agent. Focus on:
1. Main topics discussed
2. User's interests, preferences, or goals mentioned
3. Any decisions made (like persona selection, authentication)
4. Overall emotional tone of the interaction

Keep the summary concise (2-3 sentences) and actionable for the next agent to use.

Conversation:
${conversationText}

Provide a JSON response with this exact structure (no markdown, no extra text):
{
  "summary": "2-3 sentence overview",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "userPreferences": "what the user seems to prefer or care about",
  "emotionalTone": "friendly/excited/curious/professional/etc"
}`;

  try {
    // Use gpt-4o-mini for OpenAI, llama-3.1-8b-instant for Groq
    const modelName = isGroq ? 'llama-3.1-8b-instant' : 'gpt-4o-mini';
    const result = await generateText({
      model: client(modelName),
      prompt,
      temperature: 0.3,
      maxTokens: 300,
    });

    const duration = Date.now() - startTime;
    console.log(`[Summarizer] Generated summary in ${duration}ms`);

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as ConversationSummary;
      console.log(`[Summarizer] Summary: ${parsed.summary.substring(0, 100)}...`);
      return parsed;
    }

    console.warn(`[Summarizer] No JSON in response, using text directly`);
    return {
      summary: result.text.substring(0, 200),
      keyPoints: [],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Summarizer] Failed after ${duration}ms:`, error);

    return {
      summary: 'User had a conversation before switching modes.',
      keyPoints: [],
    };
  }
}

/**
 * Get last N messages for summary context.
 */
export function getRecentMessages(
  messages: ConversationMessage[],
  maxMessages: number = 10
): ConversationMessage[] {
  return messages
    .filter(m => m.role !== 'system')
    .slice(-maxMessages);
}

/**
 * Format summary for injection into system prompt.
 */
export function formatSummaryForPrompt(summary: ConversationSummary): string {
  const parts: string[] = [summary.summary];

  if (summary.keyPoints && summary.keyPoints.length > 0) {
    parts.push(`Key points: ${summary.keyPoints.join(', ')}`);
  }

  if (summary.userPreferences) {
    parts.push(`User interests: ${summary.userPreferences}`);
  }

  if (summary.emotionalTone) {
    parts.push(`Tone: ${summary.emotionalTone}`);
  }

  return parts.join('\n');
}

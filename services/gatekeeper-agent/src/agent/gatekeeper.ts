/**
 * Gatekeeper Agent
 *
 * Core agent logic using Vercel AI SDK with Groq LLM.
 * Orchestrates user flow between modes: GATEKEEPER, PERSONA_BUILDER, GAMER_AGENT.
 * Handles persona selection and mode transitions.
 */

import { streamText, generateText, CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getConfig } from '../config/index.js';
import { createGatekeeperTools } from '../tools/gatekeeper-tools.js';
import {
  getMessages,
  addMessage,
  getCurrentMode,
  getSession,
  getPendingPersonas,
  getConversationSummary,
  clearConversationSummary,
  clearTurnFlags,
  appendConversationSummary,
  getRollingSummary,
  trimOldestMessages,
  clearStaleState,
} from '../services/session.js';
import { GATEKEEPER_PROMPT } from './prompt.js';
import type { OutgoingMessage } from '../services/websocket.js';
import { parsePersonaSelection } from '../utils/persona-matcher.js';

// Constants for context management
const SUMMARIZE_THRESHOLD = 10;  // Trigger summarization when messages exceed this
const MESSAGES_TO_SUMMARIZE = 6; // Number of oldest messages to summarize
const MESSAGES_TO_KEEP = 6;      // Number of recent messages to keep verbatim

// Lazy-initialized Groq client
let groqClient: ReturnType<typeof createOpenAI> | null = null;

function getGroqClient() {
  if (!groqClient) {
    const config = getConfig();
    groqClient = createOpenAI({
      apiKey: config.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return groqClient;
}

/**
 * Summarize a batch of messages into bullet points
 * Uses a fast model for efficiency
 */
async function summarizeMessages(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  console.log(`[Agent] Summarizing ${messages.length} messages...`);
  const startTime = Date.now();

  try {
    const result = await generateText({
      model: getGroqClient()('llama-3.1-8b-instant'), // Fast model for summarization
      system: 'You are a helpful assistant that summarizes conversations concisely.',
      prompt: `Summarize this conversation in 2-3 bullet points. Focus on user intent (wanting to create persona, play games, or general questions). Be brief and factual.

Conversation:
${conversationText}

Summary:`,
      maxTokens: 150,
      temperature: 0.3,
    });

    const duration = Date.now() - startTime;
    console.log(`[Agent] Summarization complete in ${duration}ms`);
    console.log(`[Agent] Summary: ${result.text.substring(0, 100)}...`);

    return result.text.trim();
  } catch (error) {
    console.error('[Agent] Summarization failed:', error);
    // Return empty string on failure - don't block the conversation
    return '';
  }
}

/**
 * Handle context management - summarize older messages when needed
 */
async function manageContext(sessionId: string): Promise<void> {
  const messages = getMessages(sessionId);

  if (messages.length > SUMMARIZE_THRESHOLD) {
    console.log(`[Agent] Context management: ${messages.length} messages exceed threshold of ${SUMMARIZE_THRESHOLD}`);

    // Get the oldest messages to summarize
    const messagesToSummarize = messages.slice(0, MESSAGES_TO_SUMMARIZE);

    // Summarize them
    const summary = await summarizeMessages(messagesToSummarize);

    if (summary) {
      // Append to existing rolling summary
      appendConversationSummary(sessionId, summary);

      // Remove the summarized messages from history
      trimOldestMessages(sessionId, MESSAGES_TO_SUMMARIZE);

      console.log(`[Agent] Context managed: summarized ${MESSAGES_TO_SUMMARIZE} messages, ${getMessages(sessionId).length} remaining`);
    }
  }
}

/**
 * Detect if conversation is stuck (multiple empty responses)
 */
function isConversationStuck(sessionId: string): boolean {
  const messages = getMessages(sessionId);
  const recentMessages = messages.slice(-5); // Check last 5 messages

  // Count empty assistant responses
  const emptyResponses = recentMessages.filter(
    msg => msg.role === 'assistant' &&
    (msg.content.trim() === '' ||
     msg.content.includes("Sorry, I didn't catch that") ||
     msg.content.length < 10)
  );

  // If 3+ empty responses in last 5 messages, conversation is stuck
  return emptyResponses.length >= 3;
}

/**
 * Build dynamic context for the system prompt based on session state
 */
function buildStateContext(sessionId: string): string {
  const currentMode = getCurrentMode(sessionId);
  const pendingPersonas = getPendingPersonas(sessionId);

  const contextParts: string[] = [
    '\n\n# Current Session State',
    `- **Current Mode**: ${currentMode}`,
  ];

  // Add pending personas if user is selecting
  if (pendingPersonas && pendingPersonas.length > 0) {
    contextParts.push(`- **Personas Shown**: ${pendingPersonas.length} companions displayed to user`);
    contextParts.push(`- **Awaiting Selection**: YES - user should choose a persona or you select one for them`);
  }

  // Add mode-specific guidance
  contextParts.push('\n# Behavioral Guidance');

  contextParts.push(`
User is authenticated. They can:
1. PLAY - Call fetchPopularPersonas if not done, then let them select, then changeMode to GAMER_AGENT
2. CREATE - Call changeMode to PERSONA_BUILDER (no personaId needed)
3. BROWSE/CHAT - Respond as the Golem, guide them to engage`);

  // Remind about persona selection if we have pending personas
  if (pendingPersonas && pendingPersonas.length > 0) {
    contextParts.push(`
IMPORTANT: Personas have been shown to the user. If they indicate a choice (by number, name, or description):
- Extract the personaId from the pending list
- Call changeMode with mode: GAMER_AGENT and the personaId

If they seem indecisive, pick one for them and explain why it suits them.`);
  }

  // Inject conversation context from previous agent (handoff)
  const conversationSummary = getConversationSummary(sessionId);
  if (conversationSummary) {
    contextParts.push(`
# Previous Conversation Context

${conversationSummary}

**Important**: The user had a conversation with another agent before returning to you. Use this context to:
- Continue the conversation naturally without repeating information
- Reference previous topics if relevant
- Maintain continuity in the interaction
- Don't explicitly say "welcome back" unless it feels natural`);

    // Clear after first injection so it doesn't repeat every turn
    clearConversationSummary(sessionId);
  }

  return contextParts.join('\n');
}

/**
 * Handle incoming user message
 *
 * @param sessionId - Session identifier
 * @param userMessage - User's message text
 * @param sendToClient - Callback to send messages to client
 */
export async function handleUserMessage(
  sessionId: string,
  userMessage: string,
  sendToClient: (message: OutgoingMessage) => void
): Promise<void> {
  console.log(`[Agent] Processing message for session: ${sessionId}`);

  // Clear per-turn flags at the start of each new user message
  clearTurnFlags(sessionId);

  // Clear stale state (pending personas that are too old, etc.)
  clearStaleState(sessionId);

  // Check if conversation is stuck and needs reset
  if (isConversationStuck(sessionId)) {
    console.log(`[Agent] Conversation appears stuck - clearing stale state and recent empty responses`);
    const messages = getMessages(sessionId);
    // Remove empty assistant responses from recent history
    const cleanedMessages = messages.filter(
      (msg, index) => !(msg.role === 'assistant' &&
        (msg.content.trim() === '' ||
         msg.content.includes("Sorry, I didn't catch that") ||
         msg.content.length < 10) &&
        index >= messages.length - 5) // Only remove from last 5
    );
    // Update session with cleaned messages
    const session = getSession(sessionId);
    session.messages = cleanedMessages;
    // Clear pending personas if stuck
    if (session.pendingPersonas) {
      session.pendingPersonas = undefined;
      console.log(`[Agent] Cleared stale pending personas due to stuck conversation`);
    }
  }

  // Pre-LLM: Detect persona selection when personas are pending
  const pendingPersonas = getPendingPersonas(sessionId);
  if (pendingPersonas && pendingPersonas.length > 0) {
    const matchedPersonaId = parsePersonaSelection(userMessage, pendingPersonas);
    if (matchedPersonaId) {
      console.log(`[Agent] Auto-detected persona selection: ${matchedPersonaId}`);
      // Let the LLM handle it with a hint so it calls changeMode naturally
      // We prepend context so the LLM knows which persona was selected
      const matchedPersona = pendingPersonas.find(p => p.id === matchedPersonaId);
      if (matchedPersona) {
        userMessage = `${userMessage}\n\n[System hint: User selected persona "${matchedPersona.name}" (ID: ${matchedPersonaId}). Call changeMode with GAMER_AGENT and this personaId.]`;
      }
    }
  }

  // Add user message to history
  addMessage(sessionId, 'user', userMessage);

  // Manage context - summarize old messages if needed
  await manageContext(sessionId);

  // Get conversation history (after potential summarization)
  const history = getMessages(sessionId);
  const recentHistory = history.slice(-MESSAGES_TO_KEEP);

  console.log(`[Agent] History: ${history.length} messages, using last ${recentHistory.length}`);

  // Build messages array for LLM
  const messages: CoreMessage[] = recentHistory.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  // Create tools with session context
  const tools = createGatekeeperTools({
    sessionId,
    sendToClient,
  });

  // Build system prompt with dynamic state context
  let systemPrompt = GATEKEEPER_PROMPT + buildStateContext(sessionId);

  // Add rolling summary if exists (from older messages that were summarized)
  const rollingSummary = getRollingSummary(sessionId);
  if (rollingSummary) {
    systemPrompt += `\n\n# Earlier in this conversation:\n${rollingSummary}`;
  }

  try {
    // Stream response from LLM
    const result = await streamText({
      model: getGroqClient()('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 5, // Allow multiple tool calls in sequence
      temperature: 0.7,
    });

    // Collect full response text and track tool usage
    let fullResponse = '';
    let toolsWereCalled = false;

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        fullResponse += part.textDelta;
      } else if (part.type === 'tool-call') {
        toolsWereCalled = true;
        console.log(`[Agent] Tool called: ${part.toolName}`);
      }
    }

    // Clean up response (remove any tool syntax that leaked through)
    fullResponse = cleanResponse(fullResponse);

    if (fullResponse.trim()) {
      // Add assistant response to history
      addMessage(sessionId, 'assistant', fullResponse);

      // Send to client
      sendToClient({
        type: 'chat',
        role: 'assistant',
        text: fullResponse,
        timestamp: new Date().toISOString(),
      });
      console.log(`[Agent] Response sent for session: ${sessionId}`);
    } else if (toolsWereCalled) {
      // Tools handled the response (e.g. mode_change, persona_list) - no text needed
      console.log(`[Agent] Tools handled response for session: ${sessionId} (no text needed)`);
    } else {
      // No tools called AND no text - genuine empty response, send fallback
      console.warn(`[Agent] Empty response (no tools, no text) for session: ${sessionId}`);
      const fallback = "Sorry, I didn't catch that. Want to play with one of my personas, or make your own?";
      addMessage(sessionId, 'assistant', fallback);
      sendToClient({
        type: 'chat',
        role: 'assistant',
        text: fallback,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('[Agent] Error processing message:', error);

    // Send error message to client
    sendToClient({
      type: 'error',
      text: 'Something went wrong. Try again.',
      timestamp: new Date().toISOString(),
    });

    // Don't rethrow - let the WebSocket connection stay open
    // The error is already logged and the user notified
  }
}

/**
 * Clean up LLM response
 * Removes any tool call syntax that might have leaked through
 */
function cleanResponse(text: string): string {
  // Remove function call patterns like <function=verifyOtp>{"code":"123456"}</function>
  let cleaned = text.replace(/<function=\w+>\s*\{[^}]*\}<\/function>/g, '');

  // Remove standalone function tags
  cleaned = cleaned.replace(/<\/?function[^>]*>/g, '');

  // Remove <tool_call> tags
  cleaned = cleaned.replace(/<\/?tool_call>/g, '');

  // Remove JSON-like tool invocations
  cleaned = cleaned.replace(/\{"name":\s*"[^"]+",\s*"arguments":\s*\{[^}]*\}\}/g, '');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Persona Builder Agent
 *
 * Core agent logic using Vercel AI SDK with Groq LLM.
 * Handles persona creation flow via tool calling.
 */

import { streamText, generateText, CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getConfig } from '../config/index.js';
import { createPersonaTools } from '../tools/persona-tools.js';
import { createGameTools } from '../tools/game-tools.js';
import {
  getMessages,
  addMessage,
  isAuthenticated,
  getUserId,
  getDraftPersona,
  getSimplifiedPersona,
  getConversationSummary,
  appendConversationSummary,
  trimOldestMessages,
  hasAuthErrorOccurred,
  clearAuthError,
  isEditingExisting,
  getEditingPersonaId,
  clearTurnFlags,
  wasPersonaSavedThisTurn,
  setModeTransitionOccurred,
  hasModeTransitionOccurred,
  type DraftPersona,
} from '../services/session.js';
import { PERSONA_BUILDER_PROMPT } from './prompt.js';
import type { OutgoingMessage } from '../services/websocket.js';

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
      prompt: `Summarize this conversation in 2-3 bullet points. Focus on what the user wants for their persona (name, personality, appearance, gaming style). Be brief and factual.

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
      // Append to existing summary
      await appendConversationSummary(sessionId, summary);

      // Remove the summarized messages from history
      await trimOldestMessages(sessionId, MESSAGES_TO_SUMMARIZE);

      console.log(`[Agent] Context managed: summarized ${MESSAGES_TO_SUMMARIZE} messages, ${getMessages(sessionId).length} remaining`);
    }
  }
}

/**
 * Extract suggestions from agent response using fast LLM
 * Only calls LLM when response likely contains options (has ? and comma/or)
 */
async function extractSuggestions(text: string): Promise<{ message: string; suggestions: string[] }> {
  // Quick check - skip if no options likely
  const hasQuestion = text.includes('?');
  const hasOptions = text.includes(',') || /\bor\b/i.test(text);

  if (!hasQuestion || !hasOptions) {
    console.log('[Agent] Skipping suggestion extraction - no options detected');
    return { message: text.trim(), suggestions: [] };
  }

  console.log('[Agent] Extracting suggestions via LLM...');
  const startTime = Date.now();

  try {
    const result = await generateText({
      model: getGroqClient()('llama-3.1-8b-instant'),
      system: `You extract the main message and choice options from text.
Return ONLY valid JSON, nothing else.
Format: { "message": "the question or statement", "suggestions": ["option1", "option2", ...] }
- message: The full conversational text up to and including the question
- suggestions: 2-5 short option labels (clean, no articles like "a" or "an")
If no clear choice options exist, return empty suggestions array.`,
      prompt: `Extract from: "${text}"`,
      maxTokens: 200,
      temperature: 0,
    });

    const duration = Date.now() - startTime;
    console.log(`[Agent] Suggestion extraction completed in ${duration}ms`);

    // Parse JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        message: parsed.message || text.trim(),
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    }

    return { message: text.trim(), suggestions: [] };
  } catch (error) {
    console.error('[Agent] Suggestion extraction failed:', error);
    return { message: text.trim(), suggestions: [] };
  }
}

/**
 * Check if a string value is actually valid (not null, not string "null", not empty)
 */
function isValidString(value: string | undefined | null): boolean {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined';
}

/**
 * Check if all required steps (1-5) are complete
 * Returns completion status and list of missing fields
 */
function areAllStepsComplete(draft: DraftPersona): { complete: boolean; missingFields: string[] } {
  const missing: string[] = [];
  if (!isValidString(draft.identity?.species)) missing.push('species');
  if (!isValidString(draft.description)) missing.push('description');
  if (!isValidString(draft.identity?.name)) missing.push('name');
  if (!draft.personality?.traits?.length) missing.push('personality.traits');
  if (!isValidString(draft.gaming?.playstyle)) missing.push('gaming.playstyle');

  return {
    complete: missing.length === 0,
    missingFields: missing
  };
}

/**
 * Determine the current step based on what's missing in the draft
 * Returns a directive string telling the LLM exactly what to do next
 */
function determineCurrentStep(draft: DraftPersona, sessionId: string): string | null {
  // Debug logging: Log draft state to understand what's happening
  console.log(`[StepDetection] Checking step for session: ${sessionId}`);
  console.log(`[StepDetection] Draft state:`, {
    hasSpecies: isValidString(draft.identity?.species),
    species: draft.identity?.species || 'missing',
    hasDescription: isValidString(draft.description),
    descriptionLength: draft.description?.length || 0,
    hasName: isValidString(draft.identity?.name),
    name: draft.identity?.name || 'missing',
    hasPersonality: !!(draft.personality?.traits?.length),
    personalityTraits: draft.personality?.traits?.length || 0,
    hasGaming: isValidString(draft.gaming?.playstyle),
    playstyle: draft.gaming?.playstyle || 'missing',
    hasAvatarUrl: !!draft.visualIdentity?.avatarUrl,
  });

  // CRITICAL: Check user intent FIRST (before checking draft state)
  // This ensures play/save intent is detected even if draft is empty
  const messages = getMessages(sessionId);
  // Find last REAL user message — skip system-injected messages (prefixed with [System:)
  const lastUserMessage = messages.slice().reverse().find(msg =>
    msg.role === 'user' && !msg.content.trimStart().startsWith('[System:')
  );

  // Check if user wants to play - this should be checked FIRST, even before checking if saved
  // Messages like "Let's play with Midnight" or "play" are strong signals
  // NOTE: Only match specific play-related phrases, NOT generic words like "start", "game", "begin"
  // which can appear in normal persona-building conversation
  const lastMsgLower = lastUserMessage?.content.toLowerCase() || '';
  const wantsToPlay = lastUserMessage && (
    lastMsgLower.includes('play') ||
    lastMsgLower.includes("let's play") ||
    lastMsgLower.includes("lets play") ||
    lastMsgLower.includes('play with') ||
    lastMsgLower.includes('ready to play') ||
    lastMsgLower.includes("let's go play") ||
    lastMsgLower.includes('lets go play') ||
    lastMsgLower.includes('go play') ||
    /\bstart\s+(playing|the game|gaming)\b/i.test(lastUserMessage.content) ||
    /\bbegin\s+(playing|the game|gaming)\b/i.test(lastUserMessage.content)
  );

  // Check if persona is saved (has editingPersonaId) OR check conversation history for persona_saved
  const editingId = getEditingPersonaId(sessionId);
  const isSaved = isEditingExisting(sessionId) || !!editingId;

  // Also check conversation history for any indication a persona was saved
  // Look for assistant messages mentioning "saved" or "has been saved"
  const hasSavedIndication = messages.some(msg =>
    msg.role === 'assistant' && (
      msg.content.toLowerCase().includes('has been saved') ||
      msg.content.toLowerCase().includes('saved!') ||
      msg.content.toLowerCase().includes('persona saved')
    )
  );

  // Check if conversation has persona building activity (indicates a persona was created)
  const hasPersonaBuildingActivity = messages.length > 3 && messages.some(msg =>
    msg.content.toLowerCase().includes('species') ||
    msg.content.toLowerCase().includes('personality') ||
    msg.content.toLowerCase().includes('avatar') ||
    msg.content.toLowerCase().includes('playstyle')
  );

  console.log(`[StepDetection] Saved check: editingId=${editingId}, isSaved=${isSaved}, hasSavedIndication=${hasSavedIndication}, hasPersonaBuildingActivity=${hasPersonaBuildingActivity}`);

  // If user wants to play, be aggressive - if they say "play" and there's any indication of persona activity, try to play
  // This handles cases where editingPersonaId might not be set but persona was saved
  if (wantsToPlay) {
    if (isSaved || hasSavedIndication || (hasPersonaBuildingActivity && messages.length > 5)) {
      console.log(`[StepDetection] → User wants to play (message: "${lastUserMessage?.content}") - persona appears to be saved or was created`);
      // Extract persona name from message if present (e.g., "play with Midnight")
      const personaNameMatch = lastUserMessage?.content.match(/play with (\w+)/i);
      const personaName = personaNameMatch ? personaNameMatch[1] : (draft.identity?.name || 'your persona');

      return `**PHASE 5 - Step 8: Play** ⚠️ USER WANTS TO PLAY ⚠️
⚠️ CRITICAL: User wants to play (message: "${lastUserMessage?.content}"). Persona is saved. YOU MUST CALL playWithPersona TOOL NOW. Do NOT ask questions. Do NOT generate text. Just call the playWithPersona tool immediately.
${personaNameMatch ? `User mentioned persona name: ${personaName}. Use this persona.` : ''}`;
    } else {
      // User wants to play but no clear indication persona is saved - still try, playWithPersona will handle error
      console.log(`[StepDetection] → User wants to play but persona might not be saved - attempting anyway`);
      return `**PHASE 5 - Step 8: Play** ⚠️ USER WANTS TO PLAY ⚠️
⚠️ CRITICAL: User wants to play (message: "${lastUserMessage?.content}"). Call playWithPersona tool. If it fails, inform the user they need to save first.`;
    }
  }

  // If persona is saved but user hasn't explicitly asked to play - offer it
  if (isSaved || hasSavedIndication) {
    const personaName = draft.identity?.name || lastUserMessage?.content.match(/play with (\w+)/i)?.[1] || 'your persona';
    console.log(`[StepDetection] → Returning Step 8 (persona already saved, offering to play)`);
    return `**PHASE 5 - Step 8: Play Offer**
Persona is saved! Ask if they want to play with ${personaName}. If yes, call playWithPersona.`;
  }

  // Check if user wants to save — only match explicit save intent from real user messages
  const wantsToSave = lastUserMessage && (
    lastMsgLower.includes('save') ||
    lastMsgLower.includes('done') ||
    // Only match "yes"/"ready" if there's persona-building context (not on first message)
    ((lastMsgLower === 'yes' || lastMsgLower === 'ready' || lastMsgLower.includes('ready to save')) && messages.length > 3)
  );

  if (wantsToSave) {
    // Check if persona is already saved (has an ID) or was just saved this turn
    const wasJustSaved = wasPersonaSavedThisTurn(sessionId);

    if (!isSaved && !wasJustSaved && !hasSavedIndication) {
      console.log(`[StepDetection] → User wants to save (message: "${lastUserMessage?.content}") - returning save directive`);
      return `**PHASE 4 - Step 7: Save Persona** ⚠️ USER WANTS TO SAVE ⚠️
⚠️ CRITICAL: User explicitly said they want to save (message: "${lastUserMessage?.content}").
YOU MUST CALL savePersona TOOL NOW. Do NOT ask questions. Do NOT generate text. Just call the savePersona tool immediately.`;
    }
    // If wasJustSaved or already saved, skip - persona was just saved, no need to save again
  }

  // PHASE 1: VISUAL FOUNDATION
  // STRICT SEQUENTIAL ORDER: Steps must be completed in order 1→2→3

  // Step 1: Core Concept (species) - NO prerequisites
  if (!isValidString(draft.identity?.species)) {
    console.log(`[StepDetection] → Returning Step 1 (missing species)`);
    return `**PHASE 1 - Step 1: Ask for Core Concept** (REQUIRED FIRST)
Ask what kind of companion they want to create. Offer creative suggestions (animals, mythical creatures, robots, fantasy characters).
After they answer, call updateDraftPersona with species.
⚠️ You MUST complete Step 1 before moving to Step 2.`;
  }

  // Step 2: Visual Details (description) - REQUIRES: Step 1 complete (species)
  // We check if we have a visual description - must be in draft.description field
  // Note: backstory is NOT visual details - it's about history, not appearance
  const hasVisualDetails = isValidString(draft.description);
  if (!hasVisualDetails) {
    // Validate prerequisite: Step 1 must be complete
    if (!isValidString(draft.identity?.species)) {
      return `**PHASE 1 - Step 1: Ask for Core Concept** (MUST COMPLETE FIRST)
You cannot skip to visual details. First ask what kind of companion they want to create.
After they answer, call updateDraftPersona with species.`;
    }

    console.log(`[StepDetection] → Returning Step 2 (missing visual details, species=${draft.identity?.species})`);
    return `**PHASE 1 - Step 2: Ask for Visual Details** (REQUIRES Step 1 complete)
React to their species choice (${draft.identity?.species}), then ask about their character's appearance/look. Tailor suggestions to their specific character type.
After they answer, call updateDraftPersona with description or visual details.
⚠️ You MUST complete Step 2 before moving to Step 3.`;
  }

  // Step 3: Name - CRITICAL: never skip this
  // REQUIRES: Step 1 (species) AND Step 2 (visual details) complete
  // MUST come before avatar generation check - name is REQUIRED for avatar
  if (!isValidString(draft.identity?.name)) {
    // Validate ALL prerequisites
    if (!isValidString(draft.identity?.species)) {
      return `**PHASE 1 - Step 1: Ask for Core Concept** (MUST COMPLETE FIRST)
You cannot skip steps. First ask what kind of companion they want to create.`;
    }
    if (!hasVisualDetails) {
      return `**PHASE 1 - Step 2: Ask for Visual Details** (MUST COMPLETE BEFORE Step 3)
You cannot skip to name. First ask about their character's appearance/look.`;
    }

    console.log(`[StepDetection] → Returning Step 3 (missing name)`);
    return `**PHASE 1 - Step 3: Ask for Name** ⚠️ CRITICAL - DO NOT SKIP (REQUIRES Steps 1 & 2 complete)
⚠️ YOU CANNOT GENERATE AVATAR WITHOUT A NAME! ⚠️
Ask for a name. Suggest 2-3 fitting names based on their character's vibe.
After they answer, call updateDraftPersona with name, THEN call generateAvatar (you now have name + visual details).
DO NOT call generateAvatar until you have the name! The name MUST be provided first.`;
  }

  // Check if avatar needs to be generated (ONLY if name exists)
  // This step ONLY appears AFTER name is set - name is a hard requirement
  if (isValidString(draft.identity?.name) && !draft.visualIdentity?.avatarUrl) {
    return `**PHASE 1 - Step 3 (continued): Generate Avatar**
You have name (${draft.identity!.name}) and visual details. Now you can call generateAvatar with a FULL description that includes species, visual details, and character concept. Do NOT just pass a short phrase.
⚠️ Only call generateAvatar if you have: name (required) and visual description.`;
  }

  // PHASE 2: PERSONALITY

  // Step 4: Personality
  if (!draft.personality?.archetype && !draft.personality?.traits?.length) {
    console.log(`[StepDetection] → Returning Step 4 (missing personality)`);
    return `**PHASE 2 - Step 4: Ask for Personality**
Ask how this character acts. Tailor options to their character type.
After they answer, call updateDraftPersona with archetype and traits.`;
  }

  // Step 5: Gaming Style
  if (!isValidString(draft.gaming?.playstyle)) {
    console.log(`[StepDetection] → Returning Step 5 (missing gaming playstyle)`);
    return `**PHASE 2 - Step 5: Ask for Gaming Style**
Ask how they play games - explorer, fighter, builder, strategist, etc.
After they answer, call updateDraftPersona with playstyle and riskTolerance.`;
  }

  // PHASE 4: COMPLETION
  // First check if all steps 1-5 are complete (regardless of avatar)
  const stepsCheck = areAllStepsComplete(draft);
  console.log(`[StepDetection] Steps check: complete=${stepsCheck.complete}, missingFields=[${stepsCheck.missingFields.join(', ')}]`);

  // If all steps are complete, check if we need avatar or can save
  if (stepsCheck.complete) {
    // All steps complete - check if avatar exists
    const hasAvatarUrl = !!draft.visualIdentity?.avatarUrl;
    console.log(`[StepDetection] All steps complete, hasAvatarUrl=${hasAvatarUrl}`);

    if (!hasAvatarUrl) {
      // Steps complete but no avatar - offer to save (avatar can be generated later or is optional)
      const isSavedCheck = isEditingExisting(sessionId) || getEditingPersonaId(sessionId);
      if (!isSavedCheck) {
        const messages = getMessages(sessionId);
        const lastUserMessage = messages.slice().reverse().find(msg => msg.role === 'user');
        const wantsToSaveCheck = lastUserMessage && (
          lastUserMessage.content.toLowerCase().includes('save') ||
          lastUserMessage.content.toLowerCase().includes('yes') ||
          lastUserMessage.content.toLowerCase().includes('ready') ||
          lastUserMessage.content.toLowerCase().includes('done')
        );

        if (wantsToSaveCheck) {
          console.log(`[StepDetection] → Returning Step 7 (user wants to save, no avatar)`);
          return `**PHASE 4 - Step 7: Save Persona** ⚠️ USER WANTS TO SAVE ⚠️
⚠️ CRITICAL: User explicitly said they want to save (message: "${lastUserMessage?.content}").
YOU MUST CALL savePersona TOOL NOW. Do NOT ask questions. Do NOT generate text. Just call the savePersona tool immediately.`;
        } else {
          console.log(`[StepDetection] → Returning Step 7 (ready to save, no avatar, user hasn't confirmed)`);
          return `**PHASE 4 - Step 7: Ready to Save**
You have all required fields (name, species, personality, gaming style). Avatar can be generated later if needed.
Give a brief excited summary and ask if they're ready to save.
When they say "yes", "save", "ready", or "done", call savePersona tool.`;
        }
      }
    }
  }

  // Original completion check (requires avatarUrl)
  const hasAllRequired = isValidString(draft.identity?.name) && isValidString(draft.identity?.species) && draft.visualIdentity?.avatarUrl && draft.personality?.traits?.length;
  console.log(`[StepDetection] Completion check: hasAllRequired=${hasAllRequired}, hasAvatarUrl=${!!draft.visualIdentity?.avatarUrl}`);

  if (hasAllRequired) {
    // Check if persona is already saved (has personaId in draft or is being edited)
    // Note: This check is redundant now since we check at the top, but keeping for safety
    const isSavedCheck = isEditingExisting(sessionId) || getEditingPersonaId(sessionId);

    if (!isSavedCheck) {
      // Not saved yet - check if user wants to save (from last message)
      const messages = getMessages(sessionId);
      const lastUserMessage = messages.slice().reverse().find(msg => msg.role === 'user');
      const wantsToSaveCheck = lastUserMessage && (
        lastUserMessage.content.toLowerCase().includes('save') ||
        lastUserMessage.content.toLowerCase().includes('yes') ||
        lastUserMessage.content.toLowerCase().includes('ready') ||
        lastUserMessage.content.toLowerCase().includes('done')
      );

      if (wantsToSaveCheck) {
        return `**PHASE 4 - Step 7: Save Persona** ⚠️ USER WANTS TO SAVE ⚠️
⚠️ CRITICAL: User explicitly said they want to save (message: "${lastUserMessage?.content}").
YOU MUST CALL savePersona TOOL NOW. Do NOT ask questions. Do NOT generate text. Just call the savePersona tool immediately.`;
      } else {
        console.log(`[StepDetection] → Returning Step 7 (ready to save, user hasn't confirmed yet)`);
        return `**PHASE 4 - Step 7: Ready to Save**
You have all required fields (name, species, avatar, personality). Give a brief excited summary and ask if they're ready to save.
When they say "yes", "save", "ready", or "done", call savePersona tool.`;
      }
    }
    // Already saved - this should have been caught at the top, but if we reach here, offer to play
    const personaName = draft.identity?.name || 'your persona';
    console.log(`[StepDetection] → Returning Step 8 (persona already saved, offering to play)`);
    return `**PHASE 5 - Step 8: Play Offer**
Persona is saved! Ask if they want to play with ${personaName}. If yes, call playWithPersona.`;
  }

  // Default: continue conversation
  console.log(`[StepDetection] → Returning null (no specific step, all steps may be complete but missing avatar)`);
  return null;
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

  // Clear per-turn flags at start of each new turn
  clearTurnFlags(sessionId);

  // Add user message to history
  addMessage(sessionId, 'user', userMessage);

  // Manage context - summarize old messages if needed
  await manageContext(sessionId);

  // Get conversation history (after potential summarization)
  const history = getMessages(sessionId);
  const recentHistory = history.slice(-MESSAGES_TO_KEEP);

  console.log(`[Agent] History: ${history.length} messages, using last ${recentHistory.length}`);

  // Build messages array for LLM
  const messages: CoreMessage[] = recentHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Create tools with session context
  const personaTools = createPersonaTools({
    sessionId,
    sendToClient,
  });
  const gameTools = createGameTools({
    sessionId,
    sendToClient,
  });
  const tools = { ...personaTools, ...gameTools };

  // Build system prompt with context
  let systemPrompt = PERSONA_BUILDER_PROMPT;

  // Add authentication context
  const authenticated = isAuthenticated(sessionId);
  systemPrompt += `\n\n# Session: ${authenticated ? 'Logged in' : 'Anonymous'}`;

  // Add conversation summary if exists (from older messages)
  const conversationSummary = getConversationSummary(sessionId);
  if (conversationSummary) {
    systemPrompt += `\n\n# Earlier in this conversation:\n${conversationSummary}`;
  }

  // Add draft persona context (compact format)
  const draft = getDraftPersona(sessionId);
  if (Object.keys(draft).length > 0) {
    systemPrompt += `\n\n# Current Draft:\n${JSON.stringify(draft)}`;
  }

  // Add dynamic step tracking - tell LLM exactly what to do next
  const currentStep = determineCurrentStep(draft, sessionId);
  if (currentStep) {
    // Make step directive even more prominent if it requires a tool call
    const requiresToolCall = currentStep.includes('CALL') || currentStep.includes('Call') || currentStep.includes('tool') || currentStep.includes('savePersona');
    const emphasis = requiresToolCall
      ? `\n\n# ⚠️⚠️⚠️ CRITICAL ACTION REQUIRED ⚠️⚠️⚠️\n${currentStep}\n\n**YOU MUST FOLLOW THIS EXACTLY. DO NOT GENERATE TEXT - CALL THE TOOL AS INSTRUCTED.**`
      : `\n\n# ⚠️ CURRENT STEP - DO THIS NOW:\n${currentStep}\n\n**CRITICAL**: Follow this step exactly. Do NOT skip steps. Do NOT ask multiple questions at once.`;
    systemPrompt += emphasis;
    console.log(`[Agent] Current step directive: ${currentStep.substring(0, 100)}...`);
  }

  try {
    console.log(`[Agent] Calling Groq LLM with ${messages.length} messages...`);

    // Stream response from LLM (simple pattern like gatekeeper-agent)
    const result = await streamText({
      model: getGroqClient()('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 3,
      temperature: 0.7,
    });

    // Collect full response text and track tool usage
    let fullResponse = '';
    let toolsWereCalled = false;
    let modeTransitionOccurred = false;
    let toolError: { toolName: string; error: string } | null = null;
    let internalToolErrors = 0; // Track internal errors to detect loops

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        fullResponse += part.textDelta;
      } else if (part.type === 'tool-call') {
        toolsWereCalled = true;
        console.log(`[Agent] 🔧 Tool called: ${part.toolName}`);
      } else if (part.type === 'tool-result') {
        const toolResult = part.result as any;

        // Check if tool failed
        if (toolResult?.success === false) {
          const error = toolResult.error || 'Tool execution failed';
          const isInternalError = error.includes('You called') &&
                                error.includes('with all undefined parameters');

          if (isInternalError) {
            internalToolErrors++;
            console.log(`[Agent] ⚠️ Internal tool error detected (${internalToolErrors} times): ${part.toolName}`);
            // Don't set toolError for internal errors - we'll handle them separately
          } else {
            // Special handling for savePersona with missingFields - don't treat as blocking error
            // Instead, let the LLM generate a response asking for missing fields
            if (part.toolName === 'savePersona' && toolResult?.missingFields && Array.isArray(toolResult.missingFields)) {
              console.log(`[Agent] ⚠️ savePersona failed with missing fields: ${toolResult.missingFields.join(', ')}`);
              console.log(`[Agent] Will let LLM generate response asking for missing fields instead of blocking`);
              // Don't set toolError - let the LLM continue and ask for missing fields
              // The error message will be in the tool result, which the LLM can see
            } else {
              toolError = {
                toolName: part.toolName,
                error: error,
              };
              console.log(`[Agent] ⚠️ Tool "${part.toolName}" failed: ${toolError.error}`);
            }
          }
        }

        // Check if playWithPersona succeeded - this means mode transition occurred
        if (part.toolName === 'playWithPersona' && toolResult?.success === true) {
          console.log(`[Agent] ✅ Mode transition to GAMER_AGENT - stopping processing`);
          setModeTransitionOccurred(sessionId);
          modeTransitionOccurred = true;
        }
      }
    }

    console.log(`[Agent] Response received, length: ${fullResponse.length}`);

    // Early return if mode transition occurred - don't process further
    if (modeTransitionOccurred) {
      console.log(`[Agent] Mode transition occurred - not sending response or continuing processing`);
      return;
    }

    // Log if we detected multiple internal tool errors (LLM might be stuck)
    if (internalToolErrors > 0) {
      console.log(`[Agent] ⚠️ Detected ${internalToolErrors} internal tool error(s) - LLM called tool with undefined params`);
      if (internalToolErrors > 2) {
        console.log(`[Agent] ⚠️ WARNING: Multiple internal tool errors detected - LLM may be stuck in a loop`);
      }
    }

    // Check if a tool failed - send error message to user (internal errors are already filtered)
    if (toolError) {
      // Real tool error - send to user
      console.log(`[Agent] ⚠️ Tool error occurred - sending error message to user`);
      sendToClient({
        type: 'chat',
        role: 'assistant',
        text: toolError.error,
        persona: getSimplifiedPersona(sessionId),
        timestamp: new Date().toISOString(),
      });
      // Add error to conversation history
      addMessage(sessionId, 'assistant', toolError.error);
      return;
    }

    // Check if an auth error occurred during tool execution
    if (hasAuthErrorOccurred(sessionId)) {
      console.log(`[Agent] ⛔ Auth error occurred - skipping LLM response for session: ${sessionId}`);
      // The error was already sent to the client by the tool
      // Do not send the LLM's response text
      return;
    }

    // Clean up response
    fullResponse = cleanResponse(fullResponse);

    // Special case: If savePersona was called but failed with missingFields and LLM didn't generate response,
    // generate a helpful follow-up asking for the missing fields
    if (toolsWereCalled && !fullResponse.trim() && !toolError) {
      // Check conversation history for savePersona failure with missingFields
      const messages = getMessages(sessionId);
      // Look for the tool result in the stream (we need to check if savePersona was called)
      // Instead, check the draft to see what's missing
      const draft = getDraftPersona(sessionId);
      const missingFields: string[] = [];

      if (!draft.identity?.name) missingFields.push('name');
      if (!draft.identity?.species) missingFields.push('species');
      if (!draft.visualIdentity?.avatarUrl) missingFields.push('avatar');
      if (!draft.personality?.traits || draft.personality.traits.length === 0) missingFields.push('personality traits');
      if (!draft.gaming?.playstyle) missingFields.push('gaming playstyle');

      // If we have missing fields and tools were called (likely savePersona), generate follow-up
      if (missingFields.length > 0) {
        console.log(`[Agent] savePersona likely failed with missing fields: ${missingFields.join(', ')} - generating follow-up`);
        let followUpText = '';
        if (missingFields.includes('personality traits')) {
          followUpText = `Almost there! How does ${draft.identity?.name || 'this character'} act? What are their main personality traits?`;
        } else if (missingFields.includes('gaming playstyle')) {
          followUpText = `Great! How does ${draft.identity?.name || 'this character'} play games? Are they an explorer, fighter, builder, or strategist?`;
        } else if (missingFields.includes('name')) {
          followUpText = `What should we call ${draft.identity?.species || 'this character'}?`;
        } else if (missingFields.includes('avatar')) {
          followUpText = `Let me generate an avatar for ${draft.identity?.name || 'this character'}...`;
        } else {
          followUpText = `Let's finish up! We still need: ${missingFields.join(', ')}.`;
        }

        sendToClient({
          type: 'chat',
          role: 'assistant',
          text: followUpText,
          persona: getSimplifiedPersona(sessionId),
          timestamp: new Date().toISOString(),
        });
        addMessage(sessionId, 'assistant', followUpText);
        return;
      }
    }

    if (fullResponse.trim()) {
      // Add assistant response to history
      addMessage(sessionId, 'assistant', fullResponse);

      // Extract suggestions using LLM (conditional - only when options likely)
      const extracted = await extractSuggestions(fullResponse);

      // Send structured response to client with simplified persona
      sendToClient({
        type: 'chat',
        role: 'assistant',
        text: extracted.message,
        suggestions: extracted.suggestions,
        persona: getSimplifiedPersona(sessionId),
        timestamp: new Date().toISOString(),
      });
      console.log(`[Agent] ✅ Response sent for session: ${sessionId}`);
    } else if (toolsWereCalled) {
      // Tools were called but LLM didn't generate text
      // Use step tracking to determine what question to ask next
      console.log(`[Agent] Tools called but no text generated - sending context-aware acknowledgment`);

      const draft = getDraftPersona(sessionId);
      const currentStep = determineCurrentStep(draft, sessionId);

      // Generate context-aware acknowledgment based on current step
      let acknowledgment: string;
      let suggestions: string[] = [];

      if (currentStep) {
        console.log(`[Agent] Current step for acknowledgment: ${currentStep.substring(0, 100)}...`);
        // Parse the step to generate appropriate question
        if (currentStep.includes('Step 1: Ask for Core Concept') || currentStep.includes('Step 1')) {
          acknowledgment = `What kind of companion would you like to create?`;
          suggestions = ['A mythical creature', 'A robot', 'An animal', 'Something else'];
        } else if (currentStep.includes('Step 2: Ask for Visual Details') || currentStep.includes('Step 2')) {
          acknowledgment = `Great choice! What should ${draft.identity?.species || 'this character'} look like?`;
          suggestions = [];
        } else if (currentStep.includes('Step 3') && currentStep.includes('Name')) {
          // Step 3: Name - Validate ALL prerequisites
          if (!draft.identity?.species) {
            acknowledgment = `What kind of companion would you like to create?`;
            suggestions = ['A mythical creature', 'A robot', 'An animal', 'Something else'];
          } else if (!draft.description || draft.description.trim().length === 0) {
            acknowledgment = `Great choice! What should ${draft.identity.species} look like?`;
            suggestions = [];
          } else {
            acknowledgment = `What should we call ${draft.identity.species}?`;
            suggestions = [];
          }
        } else if (currentStep.includes('Step 4: Ask for Personality') || currentStep.includes('Step 4')) {
          acknowledgment = `How does ${draft.identity?.name || 'this character'} act?`;
          suggestions = [];
        } else if (currentStep.includes('Step 5: Ask for Gaming Style') || currentStep.includes('Step 5')) {
          acknowledgment = `How does ${draft.identity?.name || 'this character'} play games?`;
          suggestions = ['Explorer', 'Fighter', 'Builder', 'Strategist'];
        } else {
          // Fallback for other steps
          acknowledgment = `What's next?`;
          suggestions = ['Continue building', 'Save persona'];
        }
      } else {
        // No current step returned - check manually what's missing
        console.log(`[Agent] No step returned, checking manually. Draft: species=${!!draft.identity?.species}, name=${!!draft.identity?.name}`);

        if (!isValidString(draft.identity?.species)) {
          // No species - should be Step 1 (MUST BE FIRST)
          acknowledgment = `What kind of companion would you like to create?`;
          suggestions = ['A mythical creature', 'A robot', 'An animal', 'Something else'];
        } else if (!isValidString(draft.description)) {
          // Species set but visual details missing - should be Step 2 (REQUIRES Step 1)
          acknowledgment = `Great choice! What should ${draft.identity?.species} look like?`;
          suggestions = [];
        } else if (!isValidString(draft.identity?.name)) {
          // Visual details set but name is missing - should be Step 3 (REQUIRES Steps 1 & 2)
          acknowledgment = `What should we call ${draft.identity?.species}?`;
          suggestions = [];
        } else if (isValidString(draft.identity?.name) && isValidString(draft.identity?.species) && draft.visualIdentity?.avatarUrl && draft.personality?.traits?.length) {
          // All required fields present - ready to save
          acknowledgment = `Great! ${draft.identity!.name} is looking good. Ready to save?`;
          suggestions = ['Save persona', 'Continue building'];
        } else {
          // Fallback
          acknowledgment = `What else should we add to ${isValidString(draft.identity?.name) ? draft.identity!.name : 'your companion'}?`;
          suggestions = ['Continue building', 'Save persona'];
        }
      }

      addMessage(sessionId, 'assistant', acknowledgment);
      sendToClient({
        type: 'chat',
        role: 'assistant',
        text: acknowledgment,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        persona: getSimplifiedPersona(sessionId),
        timestamp: new Date().toISOString(),
      });
      console.log(`[Agent] ✅ Context-aware acknowledgment sent for session: ${sessionId}`);
    } else {
      // No tools called AND no text — check if a tool was explicitly required
      const draft = getDraftPersona(sessionId);
      const currentStep = determineCurrentStep(draft, sessionId);
      const requiresToolCall = currentStep && (
        currentStep.includes('CALL') ||
        currentStep.includes('Call') ||
        currentStep.includes('tool') ||
        currentStep.includes('savePersona') ||
        currentStep.includes('playWithPersona')
      );

      if (requiresToolCall && !toolsWereCalled) {
        // Tool was explicitly required but LLM didn't call it - retry with stronger prompt
        const requiredTool = currentStep?.includes('savePersona') ? 'savePersona' :
                            currentStep?.includes('playWithPersona') ? 'playWithPersona' :
                            'unknown';
        console.log(`[Agent] ⚠️ Tool "${requiredTool}" was required but not called. Retrying with stronger prompt...`);
        console.log(`[Agent] Current step directive: ${currentStep?.substring(0, 150)}...`);

        // Build a more forceful system prompt with explicit tool call example
        let retrySystemPrompt = PERSONA_BUILDER_PROMPT;
        retrySystemPrompt += `\n\n# ⚠️⚠️⚠️ CRITICAL: TOOL CALL REQUIRED ⚠️⚠️⚠️\n`;
        retrySystemPrompt += `${currentStep}\n\n`;
        retrySystemPrompt += `**YOU MUST CALL THE TOOL NOW. DO NOT GENERATE ANY TEXT. DO NOT ASK QUESTIONS. JUST CALL THE TOOL.**\n`;
        retrySystemPrompt += `The user explicitly requested this action. You MUST execute it immediately by calling the tool.\n\n`;

        // Add explicit tool call example for savePersona
        if (requiredTool === 'savePersona') {
          retrySystemPrompt += `**EXAMPLE TOOL CALL FOR savePersona:**
You must call the savePersona tool with NO parameters: savePersona({})
This is the ONLY action you should take. No text, no questions, just the tool call.\n\n`;
        } else if (requiredTool === 'playWithPersona') {
          const savedId = getEditingPersonaId(sessionId);
          retrySystemPrompt += `**EXAMPLE TOOL CALL FOR playWithPersona:**
You must call the playWithPersona tool${savedId ? ` with personaId: "${savedId}"` : ''}.
${savedId ? `Call: playWithPersona({ personaId: "${savedId}" })` : 'Call: playWithPersona({})'}
This is the ONLY action you should take. No text, no questions, just the tool call.\n\n`;
        }

        try {
          const retryResult = await streamText({
            model: getGroqClient()('llama-3.3-70b-versatile'),
            system: retrySystemPrompt,
            messages: messages.slice(-3), // Use only last 3 messages for retry
            tools,
            maxSteps: 1, // Force single step
            temperature: 0.0, // Even lower temperature for maximum determinism
          });

          let retryToolsCalled = false;
          let retryToolName = '';
          let retryTextResponse = '';
          let retryToolError: { toolName: string; error: string } | null = null;

          // Wait for the full stream to complete to ensure tool execution finishes
          for await (const part of retryResult.fullStream) {
            if (part.type === 'tool-call') {
              retryToolsCalled = true;
              retryToolName = part.toolName;
              console.log(`[Agent] 🔧 Tool called on retry: ${part.toolName}`);
            } else if (part.type === 'text-delta') {
              retryTextResponse += part.textDelta;
              // Log any text generated (shouldn't happen but helps debug)
              if (retryTextResponse.length < 100) {
                console.log(`[Agent] ⚠️ Retry generated text (unexpected): ${retryTextResponse.substring(0, 50)}...`);
              }
            } else if (part.type === 'tool-result') {
              const toolResult = part.result as any;
              if (toolResult?.success === false) {
                retryToolError = {
                  toolName: part.toolName,
                  error: toolResult.error || 'Tool execution failed',
                };
                console.log(`[Agent] ⚠️ Tool "${part.toolName}" failed on retry: ${retryToolError.error}`);
              }
            }
          }

          if (retryToolError) {
            // Tool was called but failed - send error message (unless it's an internal LLM instruction)
            const isInternalError = retryToolError.error.includes('You called') &&
                                   retryToolError.error.includes('with all undefined parameters');

            if (isInternalError) {
              console.log(`[Agent] ⚠️ Internal tool error on retry (LLM instruction) - ignoring and continuing`);
              // Don't send this to user - it's meant for the LLM, not the user
              // Continue to normal flow below to generate a response
            } else {
              // Real tool error - send to user
              console.log(`[Agent] ⚠️ Tool failed on retry - sending error message`);
              sendToClient({
                type: 'chat',
                role: 'assistant',
                text: retryToolError.error,
                persona: getSimplifiedPersona(sessionId),
                timestamp: new Date().toISOString(),
              });
              addMessage(sessionId, 'assistant', retryToolError.error);
              return;
            }
          }

          if (retryToolsCalled) {
            console.log(`[Agent] ✅ Tool "${retryToolName}" called successfully on retry`);
            // Tool execution is complete - it will have sent its own messages (persona_saved, chat)
            // No need to send additional response, tool handles it
            return;
          } else {
            console.log(`[Agent] ⚠️ Tool "${requiredTool}" still not called on retry after explicit prompt`);
            console.log(`[Agent] This indicates the LLM is not following tool call instructions.`);

            // Last resort: If user explicitly wants to save and LLM failed, directly call the tool
            if (requiredTool === 'savePersona' && personaTools.savePersona) {
              console.log(`[Agent] 🔧 Directly calling savePersona tool as fallback (LLM failed to call it)`);
              try {
                const toolDef = personaTools.savePersona as any;
                if (toolDef && typeof toolDef.execute === 'function') {
                  const toolResult = await toolDef.execute({});
                  console.log(`[Agent] ✅ Direct tool call result:`, toolResult);
                  return;
                } else {
                  console.error('[Agent] savePersona tool does not have execute function');
                }
              } catch (error) {
                console.error('[Agent] Error directly calling savePersona:', error);
              }
            }

            // Last resort: If user wants to play and LLM failed, directly call playWithPersona
            if (requiredTool === 'playWithPersona' && gameTools.playWithPersona) {
              // Get the saved persona ID to pass explicitly
              const savedPersonaId = getEditingPersonaId(sessionId);
              console.log(`[Agent] 🔧 Directly calling playWithPersona tool as fallback (LLM failed to call it), personaId: ${savedPersonaId}`);

              // Clear the "saved this turn" guard — the user explicitly asked to play
              clearTurnFlags(sessionId);

              try {
                const toolDef = gameTools.playWithPersona as any;
                if (toolDef && typeof toolDef.execute === 'function') {
                  const toolResult = await toolDef.execute({ personaId: savedPersonaId || undefined });
                  console.log(`[Agent] ✅ Direct playWithPersona result:`, toolResult);
                  if (toolResult?.success) {
                    return;
                  } else {
                    // Tool returned an error — only send user-friendly messages, not internal ones
                    const rawError = toolResult?.error || '';
                    const isInternalError = rawError.includes('same turn') || rawError.includes('Do NOT call');
                    const errorMsg = isInternalError
                      ? 'Let me get that set up for you. Please try saying "play" again.'
                      : (rawError || 'Unable to start playing. Please try again.');
                    sendToClient({
                      type: 'chat',
                      role: 'assistant',
                      text: errorMsg,
                      persona: getSimplifiedPersona(sessionId),
                      timestamp: new Date().toISOString(),
                    });
                    addMessage(sessionId, 'assistant', errorMsg);
                    return;
                  }
                } else {
                  console.error('[Agent] playWithPersona tool does not have execute function');
                }
              } catch (error) {
                console.error('[Agent] Error directly calling playWithPersona:', error);
              }
            }
          }
        } catch (error) {
          console.error('[Agent] Error during retry:', error);
          console.error('[Agent] Retry failed - this may indicate a deeper issue with tool calling');
        }
      }

      // No tools called AND no text — genuine empty response, send fallback
      console.log(`[Agent] Empty response - sending context-aware fallback`);

      // Context-aware fallback - check if this is a new conversation
      const isNewSession = !draft.identity?.species && !draft.identity?.name;

      // Creative companion suggestions pool - pick 3 random ones
      const companionIdeas = [
        'wise owl', 'fierce dragon', 'friendly robot', 'mischievous fox',
        'ancient turtle', 'cosmic jellyfish', 'steampunk cat', 'shadow wolf',
        'crystal golem', 'time-traveling parrot', 'ninja raccoon', 'frost phoenix',
        'cyber samurai', 'gentle giant', 'trickster crow', 'moon rabbit',
        'volcanic salamander', 'cloud serpent', 'forest spirit', 'pirate octopus',
        'desert scorpion', 'thunder bear', 'mystic deer', 'punk rock unicorn',
      ];

      // Shuffle and pick 3
      const shuffled = companionIdeas.sort(() => Math.random() - 0.5);
      const randomSuggestions = shuffled.slice(0, 3);

      const fallbackResponse = isNewSession
        ? `What kind of companion would you like to create?`
        : `What else should we add to ${draft.identity?.name || 'your companion'}?`;

      const fallbackSuggestions = isNewSession
        ? randomSuggestions
        : ['Add personality', 'Generate avatar', 'Save persona'];

      addMessage(sessionId, 'assistant', fallbackResponse);
      sendToClient({
        type: 'chat',
        role: 'assistant',
        text: fallbackResponse,
        suggestions: fallbackSuggestions,
        persona: getSimplifiedPersona(sessionId),
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('[Agent] ❌ Error processing message:');
    console.error('[Agent] Error name:', (error as Error).name);
    console.error('[Agent] Error message:', (error as Error).message);
    console.error('[Agent] Error stack:', (error as Error).stack);

    if (error instanceof Error && 'cause' in error) {
      console.error('[Agent] Error cause:', error.cause);
    }

    // Send error message to client
    sendToClient({
      type: 'error',
      text: 'I ran into a problem. Let me try that again.',
      timestamp: new Date().toISOString(),
    });

    // Don't rethrow - let the WebSocket connection stay open
    // throw error;
  }
}

/**
 * Clean up LLM response
 * Removes any tool call syntax that might have leaked through
 */
function cleanResponse(text: string): string {
  // Remove <function=name>{...}</function> patterns (the main leak pattern)
  let cleaned = text.replace(/<function=\w+>\s*\{[^}]*\}\s*<\/function>/g, '');

  // Remove unclosed <function=name>{...} patterns
  cleaned = cleaned.replace(/<function=\w+>\s*\{[^}]*\}/g, '');

  // Remove /function=name>{...} patterns
  cleaned = cleaned.replace(/\/function=\w+>\s*\{[^}]*\}/g, '');

  // Remove <tool_call> tags
  cleaned = cleaned.replace(/<\/?tool_call>/g, '');

  // Remove JSON-like tool invocations
  cleaned = cleaned.replace(/\{"name":\s*"[^"]+",\s*"arguments":\s*\{[^}]*\}\}/g, '');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

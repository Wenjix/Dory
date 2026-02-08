/**
 * Conversational Agent
 *
 * Adapted from readyplayerx voice-agent pattern.
 * Pipeline: Silero VAD → Deepgram STT → LLM → ElevenLabs TTS
 * Tools: A2A game tools for Minecraft bot control.
 */

import {
  type JobContext,
  type JobProcess,
  defineAgent,
  voice,
} from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import * as silero from '@livekit/agents-plugin-silero';
import * as openai from '@livekit/agents-plugin-openai';

import { VOICE_INSTRUCTIONS } from './prompt.js';
import { gameTools } from '../tools/game-tools.js';
import { fetchPendingEvents, acknowledgeEvents } from '../events/event-fetcher.js';
import {
  sendConversationContext,
  fetchSystemContext,
  notifySessionEnd,
} from '../services/context-service.js';
import { personaClient, type PersonaInfo } from '../clients/persona-client.js';
import { BASE_VOICE_AGENT_PROMPT, GAME_TOOL_INSTRUCTIONS } from './persona-prompt-builder.js';
import { agentLog, agentError } from '../utils/logger.js';

// ============================================================================
// System Prompt Building
// ============================================================================

/**
 * Build system prompt with optional persona injection, conversation context,
 * and memory enrichment from the game agent.
 *
 * @param userId - User ID for memory enrichment
 * @param personaId - Optional persona ID to fetch and inject personality
 * @param conversationSummary - Optional summary from previous agent conversation
 * @returns Complete system prompt string and optional persona info
 */
async function buildSystemPrompt(
  userId: string,
  personaId?: string,
  conversationSummary?: string
): Promise<{ prompt: string; personaInfo?: PersonaInfo }> {
  let systemPrompt = VOICE_INSTRUCTIONS;
  let personaInfo: PersonaInfo | undefined;

  // If personaId is provided, fetch persona and inject personality
  if (personaId) {
    try {
      agentLog(`Fetching persona: ${personaId}`);
      const result = await personaClient.getPersonaSystemPrompt(personaId);

      if (result) {
        // CRITICAL: Assign personaInfo immediately so it's available
        personaInfo = result.personaInfo;
        
        // Use the FULL persona prompt as-is (persona-builder already generated
        // a complete prompt with personality, response rules, tone, etc.)
        // Only append game-specific tool instructions that the persona prompt lacks.
        const personaPrompt = result.prompt;
        
        // Combine: full persona prompt + game tool instructions
        // The persona prompt already has personality, response rules, tone, examples
        // We only need to add the game-specific tool definitions
        systemPrompt = personaPrompt + '\n\n' + GAME_TOOL_INSTRUCTIONS;
        
        // Log to console for immediate visibility
        console.log(`\n[Persona] ✅ Loaded: ${personaInfo.name}`);
        console.log(`[Persona] Full persona prompt: ${personaPrompt.length} chars`);
        console.log(`[Persona] Game instructions: ${GAME_TOOL_INSTRUCTIONS.length} chars`);
        console.log(`[Persona] Final prompt: ${systemPrompt.length} chars`);
        console.log(`[Persona] Prompt starts with: ${systemPrompt.substring(0, 200)}...\n`);
        console.log(`[Persona] Contains "${personaInfo.name}": ${systemPrompt.toLowerCase().includes(personaInfo.name.toLowerCase())}`);
        console.log(`[Persona] Contains "Dory AI": ${systemPrompt.toLowerCase().includes('dory ai')}\n`);
        
        agentLog(`Injected persona: ${personaInfo.name}`, {
          voiceId: personaInfo.voiceId || 'NOT SET',
          personaPromptLength: personaPrompt.length,
          gameInstructionsLength: GAME_TOOL_INSTRUCTIONS.length,
          finalPromptLength: systemPrompt.length,
          containsPersonaName: systemPrompt.toLowerCase().includes(personaInfo.name.toLowerCase()),
        });
      } else {
        agentLog(`Persona ${personaId} not found, using default prompt`);
      }
    } catch (error) {
      agentError(`Failed to fetch persona ${personaId}`, error);
      agentLog('Falling back to default prompt');
    }
  } else {
    agentLog('No personaId provided, using default prompt');
  }

  // Inject conversation context if provided (from previous agent)
  if (conversationSummary) {
    systemPrompt += `

# Previous Conversation Context

${conversationSummary}

**Important**: The user had a conversation before connecting to you. Use this context to:
- Continue the conversation naturally without repeating information
- Reference previous topics if relevant
- Maintain continuity in the interaction
- Don't explicitly mention "the previous conversation" unless natural

Pick up where they left off smoothly.`;

    agentLog(`Injected conversation context (${conversationSummary.length} chars)`);
  }

  // Try to fetch memory context for additional personalization
  try {
    const memoryContext = await fetchSystemContext(userId);
    if (memoryContext && memoryContext !== 'No previous memory data for this user.') {
      systemPrompt += `\n\n# Background Memory (subtle — DO NOT recite)
You have vague memories from previous sessions with this player. Use them ONLY to:
- Occasionally reference shared history ("Oh yeah, we built that castle before!" or "You like jungle wood, right?")
- Adapt your tone if you know the player's style
- Avoid re-asking things you already know

Rules:
- Do NOT list what you remember. Never say "I remember that you like X and Y and Z."
- Do NOT bring up memories unprompted every turn — sprinkle them in naturally, maybe once every few exchanges.
- If the memory doesn't fit the conversation, just ignore it.
- Keep it casual — like a friend who just happens to remember, not a database readout.

${memoryContext}`;
      agentLog(`Enriched prompt with memory context (${memoryContext.length} chars)`);
    } else {
      agentLog('No memory context available (new user or game agent not running)');
    }
  } catch {
    agentLog('Could not fetch memory context');
  }

  return { prompt: systemPrompt, personaInfo };
}

// ============================================================================
// Game-Aware Agent (extends voice.Agent with event injection)
// ============================================================================

/**
 * Extends the base voice.Agent to inject game events into LLM context.
 * - onUserTurnCompleted: injects HIGH/MEDIUM unannounced events before LLM call
 */
class GameAwareAgent extends voice.Agent {
  override async onUserTurnCompleted(
    chatCtx: any,
    newMessage: any
  ): Promise<void> {
    try {
      const events = await fetchPendingEvents();

      // Filter to high + medium only (critical handled by polling, low is silent)
      const contextEvents = events.filter(
        (e) => e.priority === 'high' || e.priority === 'medium'
      );

      if (contextEvents.length > 0) {
        const summary = contextEvents.map((e) => `• ${e.message}`).join('; ');
        const prefix = `[IMPORTANT GAME UPDATE — You MUST mention these events in your reply before answering the player: ${summary}. Briefly weave them in naturally, then answer the player.]`;

        // ChatMessage.content is an array of content parts (strings, images, etc.)
        // Prepend our context string to the front of the array
        if (Array.isArray(newMessage.content)) {
          newMessage.content.unshift(prefix + '\n\n');
        } else if (typeof newMessage.content === 'string') {
          (newMessage as any).content = prefix + '\n\n' + newMessage.content;
        }

        // Acknowledge high+medium so they don't repeat
        await acknowledgeEvents(['high', 'medium']);

        // Log what the LLM will actually see
        const textContent = Array.isArray(newMessage.content)
          ? newMessage.content.filter((c: any) => typeof c === 'string').join('')
          : newMessage.content;
        console.log(`[Agent] 📢 Injected ${contextEvents.length} game events. LLM will see: "${textContent.substring(0, 150)}..."`);
      }
    } catch (err) {
      // Non-fatal — don't break the conversation
      console.error('[Agent] Event injection error:', (err as Error).message);
    }
  }
}

// ============================================================================
// Critical Event Polling
// ============================================================================

const CRITICAL_POLL_MS = 2000;    // Check every 2 seconds
const CRITICAL_COOLDOWN_MS = 8000; // After speaking, wait 8s before interrupting again

/**
 * Start a background poll for critical events.
 * When a critical event is found, immediately trigger the agent to speak.
 * Uses a cooldown to prevent rapid-fire interruptions that the SDK drops.
 */
function startCriticalEventPoller(
  session: voice.AgentSession,
  onShutdown: (cb: () => void) => void
): void {
  let lastInterruptTime = 0;

  const interval = setInterval(async () => {
    try {
      const events = await fetchPendingEvents();
      const criticals = events.filter((e) => e.priority === 'critical');

      if (criticals.length === 0) return;

      // Always acknowledge criticals so they don't pile up
      await acknowledgeEvents(['critical']);

      // Check cooldown — skip the interrupt if we just spoke
      const now = Date.now();
      if (now - lastInterruptTime < CRITICAL_COOLDOWN_MS) {
        console.log(`[Agent] 🚨 Critical events acknowledged but skipping interrupt (cooldown ${Math.round((CRITICAL_COOLDOWN_MS - (now - lastInterruptTime)) / 1000)}s remaining)`);
        return;
      }

      // Pick the most important message: prefer death > low health > damage
      const deathEvent = criticals.find((e) => e.message.includes('died'));
      const urgentMsg = deathEvent
        ? deathEvent.message
        : criticals[criticals.length - 1].message; // latest event

      console.log(`[Agent] 🚨 CRITICAL EVENT — interrupting: ${urgentMsg}`);
      lastInterruptTime = now;

      // Trigger the agent to speak immediately (interrupts current speech)
      session.generateReply({
        userInput: `[URGENT GAME ALERT] ${urgentMsg}. Tell the player immediately in one brief, urgent sentence!`,
      });
    } catch {
      // Silently ignore polling errors
    }
  }, CRITICAL_POLL_MS);

  onShutdown(() => clearInterval(interval));
  console.log(`[Agent] 🔍 Critical event poller started (every ${CRITICAL_POLL_MS}ms, cooldown ${CRITICAL_COOLDOWN_MS / 1000}s)`);
}

// ============================================================================
// Conversation History Collector + Periodic Sync
// ============================================================================

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const SYNC_INTERVAL_MS = 60_000; // Sync conversation every 60 seconds

/**
 * Collects conversation messages and periodically sends them to the
 * game agent's memory API for LLM extraction of preferences/goals/etc.
 */
function startConversationSync(
  session: voice.AgentSession,
  userId: string,
  sessionId: string,
  onShutdown: (cb: () => void) => void
): { messages: ConversationMessage[] } {
  const messages: ConversationMessage[] = [];
  let lastSyncIndex = 0;

  // Collect user and assistant messages from the session
  session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event) => {
    if (event.isFinal && event.transcript.trim()) {
      messages.push({
        role: 'user',
        content: event.transcript,
        timestamp: new Date().toISOString(),
      });
    }
  });

  session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
    const item = event.item;
    if (item.role === 'assistant' && item.textContent) {
      messages.push({
        role: 'assistant',
        content: item.textContent,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Periodic sync — send new messages since last sync
  const interval = setInterval(async () => {
    if (messages.length <= lastSyncIndex) return; // Nothing new

    const newMessages = messages.slice(lastSyncIndex);
    lastSyncIndex = messages.length;

    try {
      await sendConversationContext(userId, sessionId, newMessages);
    } catch {
      // Non-fatal
    }
  }, SYNC_INTERVAL_MS);

  onShutdown(() => clearInterval(interval));

  // Final flush on shutdown — fire-and-forget to avoid blocking native cleanup
  // (awaiting HTTP calls during shutdown can trigger ONNX runtime mutex crashes)
  onShutdown(() => {
    const doFlush = async () => {
      if (messages.length > lastSyncIndex) {
        const remaining = messages.slice(lastSyncIndex);
        await sendConversationContext(userId, sessionId, remaining).catch(() => {});
      }
      await notifySessionEnd(userId, sessionId).catch(() => {});
    };
    doFlush().catch(() => {});
  });

  return { messages };
}

// ============================================================================
// LiveKit Agent Definition
// ============================================================================

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    // Load VAD once per worker process — avoids native ONNX cleanup crashes
    // when sessions end and new ones start in the same worker.
    proc.userData.vad = await silero.VAD.load();
    console.log('[Prewarm] VAD model loaded');
  },

  entry: async (ctx: JobContext) => {
    // Log immediately at entry point (before any async operations)
    console.log(`\n[Agent] 🚀 ENTRY POINT CALLED - Agent starting...`);
    console.log(`[Agent] Room: ${ctx.room.name || '(unnamed)'}, Job ID: ${ctx.job.id}`);
    
    const sessionId = ctx.room.name || ctx.job.id;

    // Connect to the room FIRST (before anything else)
    console.log(`[Agent] 🔌 Connecting to room...`);
    await ctx.connect();
    console.log(`[Agent] ✅ Connected to room`);

    // ── Parse metadata (personaId, conversationSummary) ──────────────────
    // Metadata can arrive via:
    //   ctx.job.metadata  — from RoomAgentDispatch.metadata (explicit dispatch)
    //   ctx.room.metadata — from at.metadata (room-level, fallback)
    let personaId: string | undefined;
    let conversationSummary: string | undefined;

    // Log raw metadata sources (agentLog writes to agent.log file since
    // child process stdout is not visible in the parent terminal)
    // Also log to console for immediate visibility
    console.log(`[Agent] 📥 Raw metadata received:`);
    console.log(`[Agent]   ctx.job.metadata:`, ctx.job.metadata || '(empty)');
    console.log(`[Agent]   ctx.room.metadata:`, ctx.room.metadata || '(empty)');
    agentLog('Raw ctx.job.metadata', { value: ctx.job.metadata || '(empty)' });
    agentLog('Raw ctx.room.metadata', { value: ctx.room.metadata || '(empty)' });

    try {
      const jobMeta = JSON.parse(ctx.job.metadata || '{}');
      const roomMeta = JSON.parse(ctx.room.metadata || '{}');
      const meta = { ...roomMeta, ...jobMeta }; // job metadata takes priority

      console.log(`[Agent] 📦 Parsed metadata:`, {
        keys: Object.keys(meta),
        personaId: meta.personaId || '(none)',
        hasConversationSummary: !!meta.conversationSummary,
      });
      agentLog('Parsed metadata', { keys: Object.keys(meta), meta });

      personaId = meta.personaId;
      conversationSummary = meta.conversationSummary;

      if (personaId) {
        console.log(`[Agent] ✅ Persona requested: ${personaId}`);
        agentLog(`Persona requested: ${personaId}`);
      } else {
        console.log(`[Agent] ⚠️ No personaId found in metadata`);
      }
      if (conversationSummary) {
        console.log(`[Agent] ✅ Conversation context received (${conversationSummary.length} chars)`);
        agentLog(`Conversation context received (${conversationSummary.length} chars)`);
      }
    } catch (err) {
      console.error(`[Agent] ❌ Failed to parse metadata:`, err);
      agentError('Failed to parse metadata', err);
    }

    console.log(`[Agent] 🚀 Session started: ${sessionId} (persona: ${personaId || 'default'})`);
    agentLog(`Session started: ${sessionId} (persona: ${personaId || 'default'})`);

    // ── Duplicate agent guard ─────────────────────────────────────────────
    const participants = Array.from(ctx.room.remoteParticipants.values());
    const existingAgents = participants.filter(
      (p) => p.identity?.includes('agent') || (p as any).kind === 'AGENT'
    );
    if (existingAgents.length > 0) {
      console.log(`[Agent] Skipping — room already has an agent (${existingAgents.map(p => p.identity).join(', ')})`);
      return;
    }

    // ── VAD (prewarmed — reused across sessions) ──────────────────────────
    const vad = (ctx.proc.userData.vad as silero.VAD) || await silero.VAD.load();

    // ── STT (Deepgram Nova 3) ─────────────────────────────────────────────
    const stt = new deepgram.STT({
      model: 'nova-3',
      apiKey: process.env.DEEPGRAM_API_KEY,
    });

    // ── LLM (OpenAI GPT models via OpenAI or OpenRouter - required for proper instruction following) ───────
    // Voice agent MUST use OpenAI GPT models (not Groq/LLama) for reliable
    // persona personality adherence and tool calling.
    // Supports:
    //   - Direct OpenAI: https://api.openai.com/v1 (requires OPENAI_API_KEY)
    //   - OpenRouter: https://openrouter.ai/api/v1 (requires OPENROUTER_API_KEY, supports GPT models)
    const llmApiKey = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
    
    // Default to OpenAI, but allow OpenRouter (which also provides GPT models)
    const llmBaseURL = process.env.LLM_BASE_URL || 
      (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
    
    // Use gpt-4o for better instruction following (persona personality adherence)
    // gpt-4o-mini is faster but may not follow complex personality instructions as well
    // For OpenRouter, use model names like "openai/gpt-4o" or "openai/gpt-4o-mini"
    const llmModel = process.env.LLM_MODEL || 
      (llmBaseURL.includes('openrouter.ai') ? 'openai/gpt-4o' : 'gpt-4o');
    
    // Validate we're using OpenAI-compatible API (OpenAI or OpenRouter with GPT models)
    if (llmBaseURL.includes('groq.com') || llmBaseURL.includes('api.groq.com')) {
      console.error(`[Agent] ❌ ERROR: Voice agent requires OpenAI GPT models, not Groq!`);
      console.error(`[Agent] Current baseURL: ${llmBaseURL}`);
      console.error(`[Agent] Please use OpenAI (api.openai.com) or OpenRouter (openrouter.ai) with GPT models`);
      throw new Error('Voice agent must use OpenAI GPT models, not Groq');
    }
    
    // Validate model is a GPT model (not LLama/Groq models)
    if (llmModel.includes('llama') || llmModel.includes('groq') || llmModel.includes('qwen')) {
      console.error(`[Agent] ❌ ERROR: Voice agent requires GPT models, not ${llmModel}`);
      console.error(`[Agent] Please use a GPT model like: gpt-4o, gpt-4o-mini, gpt-4-turbo, or openai/gpt-4o (for OpenRouter)`);
      throw new Error(`Voice agent must use GPT models, not ${llmModel}`);
    }
    
    if (!llmApiKey) {
      console.error(`[Agent] ❌ ERROR: LLM API key required`);
      console.error(`[Agent] Set one of: OPENROUTER_API_KEY, LLM_API_KEY, or OPENAI_API_KEY`);
      throw new Error('LLM API key required');
    }

    const provider = llmBaseURL.includes('openrouter.ai') ? 'OpenRouter' : 'OpenAI';
    console.log(`[Agent] LLM: ${llmModel} @ ${llmBaseURL} (${provider} - GPT model)`);

    const llm = new openai.LLM({
      apiKey: llmApiKey,
      baseURL: llmBaseURL,
      model: llmModel,
    });

    // ── TTS (ElevenLabs) ──────────────────────────────────────────────────
    const tts = new elevenlabs.TTS({
      model: process.env.TTS_MODEL || 'eleven_flash_v2_5',
      voiceId: process.env.TTS_VOICE_ID || 'X3fJc68cSPDZeyn9uKoS',
      apiKey: process.env.ELEVEN_API_KEY,
    });

    // ── Build system prompt with persona + memory enrichment ─────────────
    const userId = 'user-123';
    agentLog(`Building system prompt (personaId: ${personaId || 'none'})`);
    const { prompt: systemPrompt, personaInfo } = await buildSystemPrompt(
      userId, personaId, conversationSummary
    );
    // Log to console for immediate visibility
    console.log(`[SystemPrompt] Final result:`, {
      personaLoaded: personaInfo ? personaInfo.name : 'NONE (default Dory AI)',
      promptLength: systemPrompt.length,
      first200Chars: systemPrompt.substring(0, 200),
      containsPersonaName: personaInfo ? systemPrompt.toLowerCase().includes(personaInfo.name.toLowerCase()) : false,
      containsDoryAI: systemPrompt.toLowerCase().includes('dory ai'),
    });
    
    agentLog('System prompt result', {
      personaLoaded: personaInfo ? personaInfo.name : 'NONE (default Dory AI)',
      voiceId: personaInfo?.voiceId || 'NONE (default voice)',
      promptLength: systemPrompt.length,
      promptPreview: systemPrompt.substring(0, 300),
      promptStartsWith: systemPrompt.substring(0, 100),
      containsPersonaName: personaInfo ? systemPrompt.toLowerCase().includes(personaInfo.name.toLowerCase()) : false,
      containsDoryAI: systemPrompt.toLowerCase().includes('dory ai'),
    });

    // ── Apply persona voiceId if available ────────────────────────────────
    if (personaInfo?.voiceId) {
      console.log(`[Voice] 🎤 Applying persona voiceId: ${personaInfo.voiceId}`);
      agentLog(`Applying persona voiceId: ${personaInfo.voiceId}`);
      tts.updateOptions({ voiceId: personaInfo.voiceId });
      console.log(`[Voice] ✅ Voice updated successfully`);
      agentLog(`Voice updated to: ${personaInfo.voiceId}`);
    } else if (personaId) {
      console.log(`[Voice] ⚠️  No voiceId available for persona, using default voice`);
      agentLog('No voiceId available for persona, using default voice');
    }

    // ── Agent Session (voice pipeline) ────────────────────────────────────
    const session = new voice.AgentSession({
      llm: llm as any,
      stt,
      tts,
      vad,
      voiceOptions: {
        maxToolSteps: 10,
      },
    });

    // ── Agent with game event injection ──────────────────────────────────
    const toolNames = Object.keys(gameTools);
    console.log(`[Agent] Tools (${toolNames.length}): [${toolNames.join(', ')}]`);

    const agent = new GameAwareAgent({
      instructions: systemPrompt,
      llm: llm as any,
      tools: gameTools,
    });

    // ── Event Logging ─────────────────────────────────────────────────────

    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event) => {
      if (event.isFinal) {
        console.log(`🎤 User: "${event.transcript}"`);
      }
    });

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const item = event.item;
      if (item.role === 'assistant' && item.textContent) {
        console.log(`🤖 Dory AI: "${item.textContent}"`);
      }
    });

    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (event) => {
      console.log(`State: ${event.oldState} → ${event.newState}`);
    });

    session.on(voice.AgentSessionEventTypes.FunctionToolsExecuted, (event) => {
      for (let i = 0; i < event.functionCalls.length; i++) {
        const call = event.functionCalls[i];
        const output = event.functionCallOutputs[i];
        const preview = output?.output
          ? output.output.substring(0, 200)
          : '(no output)';
        console.log(`🔧 Tool: ${call.name}(${call.args}) → ${output?.isError ? '❌ ' : '✅ '}${preview}`);
      }
    });

    session.on(voice.AgentSessionEventTypes.Error, (event) => {
      console.error('[Agent] Session error:', event.error);
    });

    // ── Start the session ──────────────────────────────────────────────────
    await session.start({ agent, room: ctx.room });
    console.log(`[Agent] ✅ Agent is LIVE — session=${sessionId}, tools=[${toolNames.join(', ')}]`);

    // ── Start critical event poller ──────────────────────────────────────
    const shutdownCallbacks: (() => void)[] = [];
    startCriticalEventPoller(session, (cb) => shutdownCallbacks.push(cb));

    // ── Start conversation sync (periodic memory sync) ───────────────────
    startConversationSync(session, userId, sessionId, (cb) =>
      shutdownCallbacks.push(cb)
    );
    console.log(`[Agent] Conversation sync started (every ${SYNC_INTERVAL_MS / 1000}s)`);

    // ── Shutdown ──────────────────────────────────────────────────────────
    ctx.addShutdownCallback(async () => {
      console.log(`[Agent] Session ending: ${sessionId}`);
      for (const cb of shutdownCallbacks) {
        try {
          cb();
        } catch {}
      }
    });
  },
});

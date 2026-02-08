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
      console.log(`[Agent] Fetching persona: ${personaId}`);
      const result = await personaClient.getPersonaSystemPrompt(personaId);

      if (result) {
        systemPrompt = result.prompt;
        personaInfo = result.personaInfo;
        console.log(`[Agent] Injected persona: ${personaInfo.name} (voiceId: ${personaInfo.voiceId || 'NOT SET'})`);
      } else {
        console.warn(`[Agent] Persona ${personaId} not found, using default prompt`);
      }
    } catch (error) {
      console.error(`[Agent] Failed to fetch persona ${personaId}:`, error);
      console.warn(`[Agent] Falling back to default prompt`);
    }
  } else {
    console.log(`[Agent] No personaId provided, using default prompt`);
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

    console.log(`[Agent] Injected conversation context (${conversationSummary.length} chars)`);
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
      console.log(`[Agent] Enriched prompt with memory context (${memoryContext.length} chars)`);
    } else {
      console.log('[Agent] No memory context available (new user or game agent not running)');
    }
  } catch {
    console.log('[Agent] Could not fetch memory context');
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
    const sessionId = ctx.room.name || ctx.job.id;

    // Connect to the room FIRST (before anything else)
    await ctx.connect();

    // ── Parse metadata (personaId, conversationSummary) ──────────────────
    let personaId: string | undefined;
    let conversationSummary: string | undefined;
    try {
      const jobMeta = JSON.parse(ctx.job.metadata || '{}');
      const roomMeta = JSON.parse(ctx.room.metadata || '{}');
      const meta = { ...roomMeta, ...jobMeta }; // job metadata takes priority

      personaId = meta.personaId;
      conversationSummary = meta.conversationSummary;

      if (personaId) {
        console.log(`[Agent] Persona requested: ${personaId}`);
      }
      if (conversationSummary) {
        console.log(`[Agent] Conversation context received (${conversationSummary.length} chars)`);
      }
    } catch {}

    console.log(`🎮 Agent session started: ${sessionId} (persona: ${personaId || 'default'})`);

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

    // ── LLM (OpenAI-compatible, must support tool/function calling) ───────
    const llmApiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
    const llmBaseURL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
    const llmModel = process.env.LLM_MODEL || 'gpt-4o-mini';

    console.log(`[Agent] LLM: ${llmModel} @ ${llmBaseURL}`);

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
    console.log(`[Agent] Building system prompt (personaId: ${personaId || 'none'})`);
    const { prompt: systemPrompt, personaInfo } = await buildSystemPrompt(
      userId, personaId, conversationSummary
    );

    // ── Apply persona voiceId if available ────────────────────────────────
    if (personaInfo?.voiceId) {
      console.log(`[Agent] Applying persona voiceId: ${personaInfo.voiceId}`);
      tts.updateOptions({ voiceId: personaInfo.voiceId });
      console.log(`[Agent] Voice updated to: ${personaInfo.voiceId}`);
    } else if (personaId) {
      console.log(`[Agent] No voiceId available for persona, using default voice`);
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
        console.log(`🤖 Dory: "${item.textContent}"`);
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

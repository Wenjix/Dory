/**
 * Conversational Agent
 *
 * Voice-enabled agent using LiveKit Agent framework.
 * Pipeline: Silero VAD → Deepgram STT → LLM → ElevenLabs TTS
 *
 * Simplified from readyplayerx:
 * - No auth, no A2A (yet), no database
 * - Pure voice conversation with Dory personality
 * - Room for future A2A tools and game event injection
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

// ============================================================================
// LiveKit Agent Definition
// ============================================================================

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    // Pre-load VAD model during warmup for faster first response
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    const sessionId = ctx.room.name || ctx.job.id;

    await ctx.connect();

    console.log(`[VoiceAgent] Session started: ${sessionId}, waiting for participant...`);

    // Wait for a human participant to join the room
    // This is CRITICAL - without it the agent doesn't know whose audio to listen to
    const participant = await ctx.waitForParticipant();
    console.log(`[VoiceAgent] Participant joined: ${participant.identity}`);

    // ── Voice Activity Detection ──────────────────────────────────────────
    const vad = await silero.VAD.load();

    // ── Speech-to-Text (Deepgram Nova 3) ──────────────────────────────────
    const stt = new deepgram.STT({
      model: 'nova-3',
      apiKey: process.env.DEEPGRAM_API_KEY,
    });

    // ── LLM (OpenAI-compatible — works with Groq, OpenAI, etc.) ───────────
    const llm = new openai.LLM({
      apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
    });

    // ── Text-to-Speech (ElevenLabs) ───────────────────────────────────────
    const tts = new elevenlabs.TTS({
      model: process.env.TTS_MODEL || 'eleven_flash_v2_5',
      voiceId: process.env.TTS_VOICE_ID || 'X3fJc68cSPDZeyn9uKoS',
      apiKey: process.env.ELEVEN_API_KEY,
    });

    // ── Agent Session ─────────────────────────────────────────────────────
    const session = new voice.AgentSession({
      llm: llm as any,
      stt,
      tts,
      vad,
    });

    // ── Agent (with system prompt) ────────────────────────────────────────
    // Future: inject A2A tools here via the `tools` option
    const agent = new voice.Agent({
      instructions: VOICE_INSTRUCTIONS,
      llm: llm as any,
      // tools: [], // A2A tools will go here later
    });

    // ── Event Logging ─────────────────────────────────────────────────────

    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event) => {
      if (event.isFinal) {
        console.log(`[VoiceAgent] [${sessionId}] User: "${event.transcript}"`);
      }
    });

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const item = event.item;
      if (item.role === 'assistant' && item.textContent) {
        console.log(`[VoiceAgent] [${sessionId}] Dory: "${item.textContent}"`);
      }
    });

    session.on(voice.AgentSessionEventTypes.Error, (event) => {
      console.error(`[VoiceAgent] [${sessionId}] Error:`, event.error);
    });

    // ── Start ─────────────────────────────────────────────────────────────
    await session.start({ agent, room: ctx.room });
    console.log(`[VoiceAgent] [${sessionId}] Agent is live and listening`);

    // ── Shutdown ──────────────────────────────────────────────────────────
    ctx.addShutdownCallback(async () => {
      console.log(`[VoiceAgent] [${sessionId}] Session ending`);
      // Future: send final context to game agent, persist history, etc.
    });
  },
});

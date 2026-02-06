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

// ============================================================================
// LiveKit Agent Definition
// (Matches readyplayerx/voice-agent pattern exactly)
// ============================================================================

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vadLoaded = true;
  },

  entry: async (ctx: JobContext) => {
    const sessionId = ctx.room.name || ctx.job.id;

    // Connect to the room FIRST (before anything else)
    await ctx.connect();
    console.log(`🎮 Agent session started: ${sessionId}`);

    // ── Duplicate agent guard (from readyplayerx) ─────────────────────────
    const participants = Array.from(ctx.room.remoteParticipants.values());
    const existingAgents = participants.filter(
      (p) => p.identity?.includes('agent') || (p as any).kind === 'AGENT'
    );
    if (existingAgents.length > 0) {
      console.log(`[Agent] Skipping — room already has an agent (${existingAgents.map(p => p.identity).join(', ')})`);
      return;
    }

    // ── VAD ────────────────────────────────────────────────────────────────
    const vad = await silero.VAD.load();

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

    // ── Agent (instructions + tools) ──────────────────────────────────────
    const toolNames = Object.keys(gameTools);
    console.log(`[Agent] Tools (${toolNames.length}): [${toolNames.join(', ')}]`);

    const agent = new voice.Agent({
      instructions: VOICE_INSTRUCTIONS,
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

    // ── Shutdown ──────────────────────────────────────────────────────────
    ctx.addShutdownCallback(async () => {
      console.log(`[Agent] Session ending: ${sessionId}`);
    });
  },
});

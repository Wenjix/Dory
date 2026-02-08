/**
 * @dory/voice-agent
 *
 * Voice conversational agent using LiveKit WebRTC.
 * Pipeline: Silero VAD → Deepgram STT → LLM → ElevenLabs TTS
 *
 * Simplified from readyplayerx voice-agent:
 * - No auth, no A2A, no database (yet)
 * - Express server for room token generation
 * - LiveKit agent for voice conversations
 */

// Reduce ONNX runtime threads to prevent native mutex crash during shutdown
// (Silero VAD uses ONNX which can crash with "mutex lock failed" on exit)
process.env.ORT_NUM_THREADS = '1';
process.env.OMP_NUM_THREADS = '1';

// Load environment variables FIRST
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env'), override: true });

// Detect .ts vs .js for agent path
const isTypeScript = __filename.endsWith('.ts');
const agentExt = isTypeScript ? '.ts' : '.js';

// Now import everything else
import express from 'express';
import { createServer } from 'http';
import { ServerOptions, cli } from '@livekit/agents';
import { createRoomTokenRouter } from './routes/room-token.js';
import { storeEvent, getUnannounced, markAnnounced } from './events/event-store.js';

// ============================================================================
// Global Error Handlers
// ============================================================================

process.on('unhandledRejection', (reason: any) => {
  console.error('[UNHANDLED REJECTION]', reason?.message || reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('[UNCAUGHT EXCEPTION]', error.message);
});

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT || 4001;

// ============================================================================
// Validate Required Environment Variables
// ============================================================================

const required = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
const missing = required.filter((k) => !process.env[k]);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

// Optional but warn
const optional = ['DEEPGRAM_API_KEY', 'ELEVEN_API_KEY', 'LLM_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY'];
const missingOptional = optional.filter((k) => !process.env[k]);
if (missingOptional.length > 0) {
  console.warn(`Warning: Missing optional env vars: ${missingOptional.join(', ')}`);
  console.warn('Some features may not work without these.');
  const hasLLMKey = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!hasLLMKey) {
    console.warn('⚠️  Voice agent requires one of: OPENROUTER_API_KEY, LLM_API_KEY, or OPENAI_API_KEY (for GPT models)');
  }
}

// A2A Game Agent
const gameAgentUrl = process.env.GAME_AGENT_URL || 'http://localhost:3000';
console.log(`Game Agent URL: ${gameAgentUrl}`);

// Persona Builder
if (!process.env.PERSONA_BUILDER_URL) {
  console.warn('PERSONA_BUILDER_URL not set, using default: http://localhost:4003');
} else {
  console.log(`Persona Builder URL: ${process.env.PERSONA_BUILDER_URL}`);
}

// ============================================================================
// Express App
// ============================================================================

const app = express();

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'voice-agent' });
});

// Room token generation (no auth for now)
app.use('/api/room-token', createRoomTokenRouter());

// ── Diagnostic: test tool definitions ────────────────────────────────────
// GET  /api/debug/tools         → list registered tool names & descriptions
// POST /api/debug/tools/:name   → manually call a tool (bypasses LLM)
app.get('/api/debug/tools', async (_req, res) => {
  try {
    // Dynamic import so it only loads when called
    const { gameTools } = await import('./tools/game-tools.js');
    const tools = Object.entries(gameTools).map(([name, tool]) => ({
      name,
      description: (tool as any).description || '(none)',
      hasParameters: !!(tool as any).parameters,
    }));
    res.json({ success: true, count: tools.length, tools });
  } catch (error) {
    res.json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/debug/tools/:name', async (req, res) => {
  try {
    const { gameTools } = await import('./tools/game-tools.js');
    const tool = (gameTools as any)[req.params.name];
    if (!tool) {
      return res.json({ success: false, error: `Tool "${req.params.name}" not found`, available: Object.keys(gameTools) });
    }
    console.log(`[Debug] Manually calling tool: ${req.params.name}`, req.body);
    const result = await tool.execute(req.body || {});
    console.log(`[Debug] Tool result:`, result);
    res.json({ success: true, tool: req.params.name, result });
  } catch (error) {
    res.json({ success: false, error: (error as Error).message });
  }
});

// ── Game Event Endpoints ─────────────────────────────────────────────────────
// POST /api/events  — Game agent pushes events here
// GET  /api/events  — Agent worker polls for unannounced events
// POST /api/events/ack — Agent worker marks events as announced

app.post('/api/events', (req, res) => {
  const { priority, message, sessionId } = req.body;
  if (!priority || !message) {
    return res.status(400).json({ error: 'Missing priority or message' });
  }
  console.log(`[Events] Received [${priority.toUpperCase()}]: ${message.substring(0, 80)}`);
  storeEvent(priority, message, sessionId);
  res.json({ success: true });
});

app.get('/api/events', (req, res) => {
  const sessionId = req.query.sessionId as string | undefined;
  const events = getUnannounced(sessionId);
  res.json({ events });
});

app.post('/api/events/ack', (req, res) => {
  const { sessionId, priorities } = req.body;
  if (priorities && Array.isArray(priorities)) {
    markAnnounced(sessionId, (e) => priorities.includes(e.priority));
  } else {
    markAnnounced(sessionId);
  }
  res.json({ success: true });
});

// ============================================================================
// HTTP Server
// ============================================================================

const httpServer = createServer(app);

httpServer.listen(PORT, () => {
  console.log(`Voice Agent HTTP server on http://localhost:${PORT}`);
  console.log(`  Health:     http://localhost:${PORT}/health`);
  console.log(`  Room token: POST http://localhost:${PORT}/api/room-token`);
});

// ============================================================================
// LiveKit Agent
// ============================================================================

console.log(`LiveKit URL: ${process.env.LIVEKIT_URL}`);

// Inject 'dev' command if no CLI command provided
if (!process.argv.includes('dev') && !process.argv.includes('start') && !process.argv.includes('connect')) {
  process.argv.push('dev');
}

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(new URL(`./agent/conversational-agent${agentExt}`, import.meta.url)),
    wsURL: process.env.LIVEKIT_URL,
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
    // Explicit agent name — must match the RoomAgentDispatch in room-token.ts.
    // Using explicit dispatch avoids race conditions where the room is created
    // before the worker has fully registered with LiveKit Cloud.
    agentName: 'dory-voice',
    // Keep 1 idle worker process alive at all times.
    // This prevents the worker from being terminated between sessions,
    // which avoids a native ONNX runtime crash (Silero VAD mutex error)
    // that occurs during worker process shutdown.
    numIdleProcesses: 1,
  })
);

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  process.exit(0);
});

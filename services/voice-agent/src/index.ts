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
const optional = ['DEEPGRAM_API_KEY', 'ELEVEN_API_KEY', 'LLM_API_KEY'];
const missingOptional = optional.filter((k) => !process.env[k]);
if (missingOptional.length > 0) {
  console.warn(`Warning: Missing optional env vars: ${missingOptional.join(', ')}`);
  console.warn('Some features may not work without these.');
}

// A2A Game Agent
const gameAgentUrl = process.env.GAME_AGENT_URL || 'http://localhost:3000';
console.log(`Game Agent URL: ${gameAgentUrl}`);

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

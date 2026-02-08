/**
 * @dory/persona-builder-agent
 *
 * AI agent that helps users create unique gaming companion personas
 * with personalities, visual identities, and behavioral traits.
 */

// Load environment variables FIRST
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Now import everything else
import express from 'express';
import { createServer } from 'http';
import { getConfig } from './config/index.js';
import { initWebSocketServer } from './services/websocket.js';
import { connectDatabase, disconnectDatabase } from './db/prisma.js';
import { prisma } from './db/prisma.js';

// ============================================================================
// Global Error Handlers
// ============================================================================

process.on('unhandledRejection', (reason: unknown) => {
  console.error('🚨 [UNHANDLED REJECTION]', reason);
  if (reason && typeof reason === 'object' && 'stack' in reason) {
    console.error('🚨 Error stack:', (reason as Error).stack);
  }
  // Don't exit on unhandled rejection - log and continue
  // This prevents server crashes from async errors
});

process.on('uncaughtException', (error: Error) => {
  console.error('🚨 [UNCAUGHT EXCEPTION]', error);
  console.error('🚨 Error stack:', error.stack);
  // Attempt graceful shutdown before exiting
  console.error('🚨 Attempting graceful shutdown...');
  shutdown().finally(() => {
    console.error('🚨 Forcing exit after uncaught exception');
    process.exit(1);
  });
});

// ============================================================================
// Configuration
// ============================================================================

const config = getConfig();
const PORT = parseInt(config.PORT, 10);

console.log('🎨 Persona Builder Agent starting...');

// ============================================================================
// Express App
// ============================================================================

const app = express();

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json());

// ============================================================================
// Routes
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'persona-builder-agent',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Public Endpoints (no auth required)
// ============================================================================

// List all published personas (public gallery)
// Supports ?limit=N query parameter to limit results
app.get('/api/personas/public', async (req, res) => {
  try {
    // Parse optional limit query parameter (default: no limit)
    const limitParam = req.query.limit;
    const limit = limitParam ? parseInt(limitParam as string, 10) : undefined;

    // Validate limit if provided
    if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
      return res.status(400).json({ error: 'Limit must be a number between 1 and 100' });
    }

    const personas = await prisma.persona.findMany({
      where: { status: 'published' },
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: limit }),
      select: {
        id: true,
        identity: true,
        description: true,
        visualIdentity: true,
        personality: true,
        gaming: true,
        createdAt: true,
        // Note: userId is NOT exposed in public endpoint
      },
    });
    res.json({ personas, count: personas.length });
  } catch (error) {
    console.error('[API] Error listing public personas:', error);
    res.status(500).json({ error: 'Failed to list personas' });
  }
});

// Get a specific public persona by ID (for viewing, not editing)
app.get('/api/personas/public/:id', async (req, res) => {
  try {
    const personaId = req.params.id as string;
    
    // Validate ObjectId format (24-character hexadecimal string)
    const objectIdPattern = /^[a-fA-F0-9]{24}$/;
    if (!objectIdPattern.test(personaId)) {
      return res.status(400).json({ 
        error: 'Invalid persona ID format. Expected a valid MongoDB ObjectId (24-character hexadecimal string).',
        received: personaId
      });
    }
    
    const persona = await prisma.persona.findFirst({
      where: {
        id: personaId,
        status: 'published',
      },
      select: {
        id: true,
        identity: true,
        description: true,
        personality: true,
        communication: true,
        gaming: true,
        voice: true,
        visualIdentity: true,
        examples: true,
        createdAt: true,
        // Note: userId is NOT exposed
      },
    });

    if (!persona) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    res.json({ persona });
  } catch (error) {
    console.error('[API] Error getting public persona:', error);
    res.status(500).json({ error: 'Failed to get persona' });
  }
});

// ============================================================================
// Protected Endpoints (hardcoded user-123, no auth middleware)
// ============================================================================

// List user's own personas (for management/editing)
app.get('/api/personas', async (req, res) => {
  try {
    const userId = 'user-123';
    const personas = await prisma.persona.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ personas });
  } catch (error) {
    console.error('[API] Error listing personas:', error);
    res.status(500).json({ error: 'Failed to list personas' });
  }
});

// Get persona by ID
app.get('/api/personas/:id', async (req, res) => {
  try {
    const userId = 'user-123';
    const personaId = req.params.id as string;
    const persona = await prisma.persona.findFirst({
      where: {
        id: personaId,
        userId,
      },
    });

    if (!persona) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    res.json({ persona });
  } catch (error) {
    console.error('[API] Error getting persona:', error);
    res.status(500).json({ error: 'Failed to get persona' });
  }
});

// Delete persona
app.delete('/api/personas/:id', async (req, res) => {
  try {
    const userId = 'user-123';
    const personaId = req.params.id as string;

    // Verify ownership
    const persona = await prisma.persona.findFirst({
      where: {
        id: personaId,
        userId,
      },
    });

    if (!persona) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    await prisma.persona.delete({
      where: { id: personaId },
    });

    res.json({ success: true, message: 'Persona deleted' });
  } catch (error) {
    console.error('[API] Error deleting persona:', error);
    res.status(500).json({ error: 'Failed to delete persona' });
  }
});

// Get conversational prompt - for voice agents (public endpoint)
app.get('/api/personas/:id/conversational-prompt', async (req, res) => {
  try {
    const personaId = req.params.id as string;
    
    // Validate ObjectId format (24-character hexadecimal string)
    const objectIdPattern = /^[a-fA-F0-9]{24}$/;
    if (!objectIdPattern.test(personaId)) {
      return res.status(400).json({ 
        error: 'Invalid persona ID format. Expected a valid MongoDB ObjectId (24-character hexadecimal string).',
        received: personaId
      });
    }
    
    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
      select: {
        id: true,
        conversationalPrompt: true,
        identity: true,
        voice: true,
      },
    });

    if (!persona) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    if (!persona.conversationalPrompt) {
      return res.status(404).json({ error: 'Conversational prompt not generated for this persona' });
    }

    const identity = persona.identity as { name?: string };
    const voice = persona.voice as { elevenLabsVoiceId?: string; elevenLabsVoiceName?: string } | null;
    const voiceId = voice?.elevenLabsVoiceId || null;

    // Log the raw voice object for debugging
    console.log(`[API] Voice object from DB:`, JSON.stringify(voice));
    console.log(`[API] Extracted elevenLabsVoiceId: ${voiceId}`);

    if (voiceId) {
      console.log(`[API] 📤 Returning conversational prompt with voiceId: ${voiceId} for persona: ${persona.id}`);
    } else {
      console.log(`[API] ⚠️ Returning conversational prompt WITHOUT voiceId for persona: ${persona.id}`);
      if (voice) {
        console.log(`[API] ⚠️ Voice object exists but elevenLabsVoiceId is missing. Voice keys:`, Object.keys(voice));
      } else {
        console.log(`[API] ⚠️ Voice object is null/undefined`);
      }
    }

    const response = {
      personaId: persona.id,
      personaName: identity?.name || 'Unknown',
      prompt: persona.conversationalPrompt,
      voiceId: voiceId,
    };

    console.log(`[API] 📤 Sending response with voiceId: ${response.voiceId}`);
    res.json(response);
  } catch (error) {
    console.error('[API] Error fetching conversational prompt:', error);
    res.status(500).json({ error: 'Failed to fetch conversational prompt' });
  }
});

// Get gaming prompt - for gaming agents like Minecraft (public endpoint)
app.get('/api/personas/:id/gaming-prompt', async (req, res) => {
  try {
    const personaId = req.params.id as string;
    
    // Validate ObjectId format (24-character hexadecimal string)
    const objectIdPattern = /^[a-fA-F0-9]{24}$/;
    if (!objectIdPattern.test(personaId)) {
      return res.status(400).json({ 
        error: 'Invalid persona ID format. Expected a valid MongoDB ObjectId (24-character hexadecimal string).',
        received: personaId
      });
    }
    
    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
      select: {
        id: true,
        gamingPrompt: true,
        identity: true,
      },
    });

    if (!persona) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    if (!persona.gamingPrompt) {
      return res.status(404).json({ error: 'Gaming prompt not generated for this persona' });
    }

    const identity = persona.identity as { name?: string };

    res.json({
      personaId: persona.id,
      personaName: identity?.name || 'Unknown',
      prompt: persona.gamingPrompt,
    });
  } catch (error) {
    console.error('[API] Error fetching gaming prompt:', error);
    res.status(500).json({ error: 'Failed to fetch gaming prompt' });
  }
});

// ============================================================================
// HTTP & WebSocket Server
// ============================================================================

const httpServer = createServer(app);

// Initialize WebSocket server
initWebSocketServer(httpServer);

// ============================================================================
// Startup
// ============================================================================

async function start() {
  try {
    // Connect to database
    await connectDatabase();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`✅ Persona Builder Agent running on http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
      console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
      console.log(`   REST API: http://localhost:${PORT}/api/personas`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function shutdown() {
  console.log('🛑 Shutting down gracefully...');

  httpServer.close(async () => {
    console.log('✅ HTTP server closed');
    await disconnectDatabase();
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

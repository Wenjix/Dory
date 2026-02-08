import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { createLogger, SessionConfig } from '@dory/shared';
import { BotManager } from './bot/bot-manager';
import { v4 as uuidv4 } from 'uuid';
import { handleMessage } from './agent';
import { getLLMClient } from './llm';
import { GAME_AGENT_CARD } from './a2a/agent-card';
import { handleA2AMessage } from './a2a/a2a-handler';
import { createMemoryRouter } from './memory/api-routes';

const logger = createLogger('GameAgentServer');

export function createServer(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'game-agent' });
  });

  // API info
  app.get('/api', (_req: Request, res: Response) => {
    res.json({ 
      service: 'Dory AI Game Agent',
      version: '0.1.0',
      endpoints: {
        health: 'GET /health',
        sessions: 'POST /api/sessions',
        sessionInfo: 'GET /api/sessions/:sessionId',
        disconnect: 'DELETE /api/sessions/:sessionId',
        activeSessions: 'GET /api/sessions',
      }
    });
  });

  // Create new bot session
  app.post('/api/sessions', async (req: Request, res: Response) => {
    try {
      const config: SessionConfig = {
        serverHost: req.body.serverHost || 'localhost',
        serverPort: req.body.serverPort || 25565,
        botName: req.body.botName || 'DoryBot',
        personality: req.body.personality || 'helper',
        authMode: req.body.authMode || 'offline',
      };

      const sessionId = uuidv4();
      const result = await BotManager.createBot(sessionId, config);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          sessionId: result.sessionId,
          config,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.message,
        });
      }
    } catch (error) {
      logger.error('Failed to create session:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // Get session info
  app.get('/api/sessions/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const bot = BotManager.getBot(sessionId);

    if (!bot) {
      res.status(404).json({
        success: false,
        error: 'Session not found',
      });
      return;
    }

    res.json({
      success: true,
      sessionId,
      bot: {
        username: bot.username,
        position: bot.position,
        health: bot.health,
        food: bot.food,
        version: bot.bot.version,
      },
    });
  });

  // Disconnect bot
  app.delete('/api/sessions/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const result = await BotManager.disconnectBot(sessionId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.message,
      });
    }
  });

  // Get all active sessions
  app.get('/api/sessions', (_req: Request, res: Response) => {
    const sessions = BotManager.getActiveSessions();
    res.json({
      success: true,
      count: sessions.length,
      sessions,
    });
  });

  // Send message to bot (AI reasoning)
  app.post('/api/sessions/:sessionId/message', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ success: false, error: 'Missing "message" in request body' });
      return;
    }

    const bot = BotManager.getBot(sessionId);
    if (!bot) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    const llm = getLLMClient();
    if (!llm) {
      res.status(503).json({ success: false, error: 'LLM not configured. Set API keys in .env' });
      return;
    }

    try {
      const result = await handleMessage(sessionId, bot, llm, message);
      res.json({
        success: true,
        response: result.response,
        toolsExecuted: result.toolsExecuted,
        llmCalls: result.llmCalls,
      });
    } catch (error) {
      logger.error(`Message handling failed for session ${sessionId}:`, error);
      res.status(500).json({
        success: false,
        error: `AI error: ${(error as Error).message}`,
      });
    }
  });

  // ── A2A: Agent Card (discovery) ──────────────────────────────────────────
  app.get('/.well-known/agent-card.json', (req: Request, res: Response) => {
    const host = req.headers.host || `localhost:${req.socket.localPort}`;
    const protocol = req.protocol || 'http';
    res.json({
      ...GAME_AGENT_CARD,
      url: `${protocol}://${host}`,
    });
  });

  // ── A2A: Receive message from another agent ────────────────────────────
  app.post('/api/a2a/message', async (req: Request, res: Response) => {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ success: false, error: 'Missing "message" in request body' });
      return;
    }

    const result = await handleA2AMessage({ message, sessionId });
    res.json(result);
  });

  // ── A2A: List active bot sessions (for voice agent to pick) ────────────
  app.get('/api/a2a/sessions', (_req: Request, res: Response) => {
    const sessionIds = BotManager.getActiveSessions();
    const sessions = sessionIds.map((id) => {
      const bot = BotManager.getBot(id);
      return {
        sessionId: id,
        botName: bot?.username || 'Unknown',
        position: bot?.position || null,
        health: bot?.health || 0,
      };
    });
    res.json({
      success: true,
      count: sessions.length,
      sessions,
    });
  });

  // ── Memory API ──────────────────────────────────────────────────────────
  app.use('/api/memory', createMemoryRouter());

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: any) => {
    logger.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

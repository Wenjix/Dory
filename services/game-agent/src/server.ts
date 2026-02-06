import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { createLogger, SessionConfig } from '@dory/shared';
import { BotManager } from './bot/bot-manager';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('game-agent-server');

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
      service: 'Dory Game Agent',
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

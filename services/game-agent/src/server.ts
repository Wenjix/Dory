import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { createLogger } from '@dory/shared';

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

  // API routes placeholder
  app.get('/api', (_req: Request, res: Response) => {
    res.json({ 
      service: 'Dory Game Agent',
      version: '0.1.0',
      endpoints: {
        health: 'GET /health',
        sessions: 'POST /api/sessions (coming soon)',
      }
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

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env');
dotenv.config({ path: envPath });

import express from 'express';
import { createServer } from 'http';
import { getConfig } from './config/index.js';
import { initWebSocketServer } from './services/websocket.js';
import { getSessionSummary } from './services/session.js';

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[UNHANDLED REJECTION]', reason);
  if (reason && typeof reason === 'object' && 'stack' in reason) {
    console.error('Error stack:', (reason as Error).stack);
  }
});

process.on('uncaughtException', (error: Error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
  console.error('Error stack:', error.stack);
});

const config = getConfig();
const PORT = parseInt(config.PORT, 10);

console.log('Gatekeeper Agent starting...');

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'gatekeeper-agent',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/sessions/:id/debug', (req, res) => {
  const sessionId = req.params.id;
  const summary = getSessionSummary(sessionId);
  res.json(summary);
});

const httpServer = createServer(app);
initWebSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Gatekeeper Agent running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

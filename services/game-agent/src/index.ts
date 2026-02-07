import { createServer } from './server';
import { config } from './config';
import { createLogger } from '@dory/shared';
import { setupWebSocket } from './websocket';
import { createLLMClient, setLLMClient } from './llm';
import { connectDatabase } from './memory/database';

const logger = createLogger('game-agent');

async function main() {
  try {
    // Initialize LLM client
    try {
      const llm = createLLMClient();
      setLLMClient(llm);
      logger.info(`LLM ready: ${llm.name} / ${llm.model}`);
    } catch (error) {
      logger.warn(`LLM not configured: ${(error as Error).message}`);
      logger.warn('Bot will work without AI reasoning. Set API keys in .env to enable.');
    }

    // Start HTTP server FIRST so port is available immediately
    // (voice-agent and other services depend on this being reachable)
    const app = createServer();
    
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Game Agent running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
      logger.info(`WebSocket console: ws://localhost:${config.port}/ws`);
      logger.info(`Memory dashboard: open test-memory.html in browser`);
    });

    // Setup WebSocket
    setupWebSocket(server);

    // Connect to MongoDB AFTER server is up (non-blocking for startup)
    // Memory features will be unavailable until this completes, but
    // the rest of the system (bot control, A2A, tools) works fine.
    try {
      await connectDatabase();
      logger.info('Memory system ready (MongoDB)');
    } catch (error) {
      logger.warn(`MongoDB not available: ${(error as Error).message}`);
      logger.warn('Memory system disabled. Run: docker compose up -d');
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

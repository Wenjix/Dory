import { createServer } from './server';
import { config } from './config';
import { createLogger } from '@dory/shared';
import { setupWebSocket } from './websocket';
import { createLLMClient, setLLMClient } from './llm';

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

    const app = createServer();
    
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Game Agent running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
      logger.info(`WebSocket console: ws://localhost:${config.port}/ws`);
    });

    // Setup WebSocket
    setupWebSocket(server);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

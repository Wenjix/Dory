import { createServer } from './server';
import { config } from './config';
import { createLogger } from '@dory/shared';

const logger = createLogger('game-agent');

async function main() {
  try {
    const app = createServer();
    
    app.listen(config.port, () => {
      logger.info(`🚀 Game Agent running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

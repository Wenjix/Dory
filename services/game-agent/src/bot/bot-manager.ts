import { MinecraftBot } from './minecraft-bot';
import { SessionConfig, SessionId } from '@dory/shared';
import { createLogger } from '@dory/shared';
import { setupMinecraftEventListeners, setupA2AEventForwarder } from '../events';
import { setupMemoryEventListener, removeMemoryEventListener } from '../memory/event-listener';

const logger = createLogger('bot-manager');

// Session storage
const sessions = new Map<SessionId, MinecraftBot>();

// Reverse map: Bot -> SessionId (for event handling)
const botToSession = new Map<any, SessionId>();

export interface CreateBotResult {
  success: boolean;
  message: string;
  sessionId?: SessionId;
}

/**
 * Bot Manager
 * Manages Minecraft bot instances per session
 */
export class BotManager {
  /**
   * Create and connect a new bot
   */
  static async createBot(
    sessionId: SessionId,
    config: SessionConfig
  ): Promise<CreateBotResult> {
    // If bot already exists, disconnect it first
    if (sessions.has(sessionId)) {
      logger.info(`Session ${sessionId} already exists, disconnecting old bot`);
      await this.disconnectBot(sessionId);
    }

    try {
      logger.info(`Creating bot for session ${sessionId}`, {
        host: config.serverHost,
        port: config.serverPort,
        username: config.botName,
        auth: config.authMode || 'offline',
      });

      // Create MinecraftBot wrapper
      const bot = new MinecraftBot(
        {
          host: config.serverHost,
          port: config.serverPort,
          username: config.botName,
          auth: config.authMode || 'offline',
        },
        sessionId
      );

      // Wait for login with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout after 30 seconds'));
        }, 30000);

        bot.bot.once('login', () => {
          clearTimeout(timeout);
          logger.info(`[${sessionId}] Bot logged in successfully`);
          resolve();
        });

        bot.bot.once('error', (err: Error) => {
          clearTimeout(timeout);
          logger.error(`[${sessionId}] Bot error during connection:`, err);
          reject(err);
        });
      });

      // Store bot
      sessions.set(sessionId, bot);
      botToSession.set(bot.bot, sessionId);

      // Setup local event handlers (error, disconnect, etc.)
      this.setupEventHandlers(sessionId, bot);

      // Setup game event system (bus listeners + A2A forwarding)
      setupMinecraftEventListeners(bot, sessionId);
      setupA2AEventForwarder(sessionId);

      // Setup memory system (event -> memory pipeline)
      const userId = config.botName || 'default_user';
      setupMemoryEventListener(sessionId, userId);

      // Send welcome message when bot spawns
      bot.bot.once('spawn', () => {
        bot.chat('Hello! I\'m here to help! 👋');
      });

      logger.info(`[${sessionId}] Bot connected successfully to ${config.serverHost}:${config.serverPort}`);

      return {
        success: true,
        message: 'Bot connected successfully!',
        sessionId,
      };
    } catch (error) {
      logger.error(`Failed to create bot for session ${sessionId}:`, error);
      return {
        success: false,
        message: `Failed to connect bot: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get bot for a session
   */
  static getBot(sessionId: SessionId): MinecraftBot | null {
    return sessions.get(sessionId) || null;
  }

  /**
   * Get session ID for a bot
   */
  static getSessionForBot(bot: any): SessionId | null {
    return botToSession.get(bot) || null;
  }

  /**
   * Disconnect bot for a session
   */
  static async disconnectBot(sessionId: SessionId): Promise<CreateBotResult> {
    const bot = sessions.get(sessionId);
    if (!bot) {
      return { success: false, message: 'No bot found for this session' };
    }

    try {
      bot.chat('Goodbye! See you later! 👋');
      
      // Flush pending memory batches before disconnect
      await removeMemoryEventListener(sessionId).catch(() => {});

      // Small delay to let the message send
      await new Promise(resolve => setTimeout(resolve, 500));
      
      bot.bot.quit();
      sessions.delete(sessionId);
      botToSession.delete(bot.bot);

      logger.info(`[${sessionId}] Bot disconnected successfully`);
      return { success: true, message: 'Bot disconnected successfully' };
    } catch (error) {
      logger.error(`Failed to disconnect bot for session ${sessionId}:`, error);
      return {
        success: false,
        message: `Failed to disconnect bot: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get all active sessions
   */
  static getActiveSessions(): SessionId[] {
    return Array.from(sessions.keys());
  }

  /**
   * Setup event handlers for a bot
   */
  private static setupEventHandlers(sessionId: SessionId, bot: MinecraftBot): void {
    // Handle errors
    bot.bot.on('error', (err: Error) => {
      logger.error(`[${sessionId}] Bot error:`, err);
    });

    // Handle kicked
    bot.bot.on('kicked', (reason: string) => {
      logger.warn(`[${sessionId}] Bot was kicked: ${reason}`);
    });

    // Handle disconnect
    bot.bot.on('end', (reason?: string) => {
      sessions.delete(sessionId);
      botToSession.delete(bot.bot);
      logger.info(`[${sessionId}] Bot disconnected${reason ? `: ${reason}` : ''}`);
    });

    // Handle death
    bot.bot.on('death', () => {
      logger.info(`[${sessionId}] Bot died!`);
      bot.chat('Oh no! I died! 💀');
    });

    // Handle respawn
    bot.bot.on('respawn', () => {
      logger.info(`[${sessionId}] Bot respawned`);
      bot.chat('I\'m back! 🌟');
    });
  }
}

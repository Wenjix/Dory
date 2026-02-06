import { Bot, createBot } from 'mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
import { plugin as pvp } from 'mineflayer-pvp';
import { plugin as collectblock } from 'mineflayer-collectblock';
import minecraftData, { IndexedData } from 'minecraft-data';
import { createLogger } from '@dory/shared';

const logger = createLogger('minecraft-bot');

interface MinecraftBotConfig {
  host: string;
  port: number;
  username: string;
  auth: 'offline' | 'microsoft';
  version?: string;
}

/**
 * Wrapper around mineflayer's Bot with high-level methods
 * Based on readyplayerx MinicraftBot pattern
 */
export class MinecraftBot {
  public bot: Bot;
  public mcData: IndexedData | null = null;
  private sessionId: string;
  private interruptFlag = false;

  constructor(config: MinecraftBotConfig, sessionId: string) {
    this.sessionId = sessionId;

    // Create mineflayer bot
    this.bot = createBot({
      host: config.host,
      port: config.port,
      username: config.username,
      auth: config.auth,
      version: config.version,
    });

    // Load plugins after bot is created
    this.bot.loadPlugin(pathfinder);
    this.bot.loadPlugin(pvp);
    this.bot.loadPlugin(collectblock);

    // Initialize minecraft-data once bot logs in
    this.bot.once('login', () => {
      this.mcData = minecraftData(this.bot.version);
      logger.info(`[${this.sessionId}] Bot logged in, version: ${this.bot.version}`);
    });

    // Setup movements for pathfinder (after spawn)
    this.bot.once('spawn', () => {
      if (this.mcData) {
        const defaultMove = new Movements(this.bot);
        this.bot.pathfinder.setMovements(defaultMove);
      }
    });
  }

  /**
   * Send chat message
   */
  chat(message: string): void {
    this.bot.chat(message);
  }

  /**
   * Stop all current actions and clear pathfinding
   */
  async stop(): Promise<void> {
    this.interruptFlag = true;
    
    // Clear pathfinder goal
    if (this.bot.pathfinder) {
      this.bot.pathfinder.setGoal(null);
    }
    
    // Clear control states
    await this.bot.clearControlStates();
    
    // Stop collectblock
    if ((this.bot as any).collectBlock) {
      (this.bot as any).collectBlock.cancelTask();
    }

    this.interruptFlag = false;
  }

  /**
   * Follow a player
   */
  async followPlayer(username: string): Promise<boolean> {
    const player = this.bot.players[username];
    if (!player || !player.entity) {
      return false;
    }

    const goal = new goals.GoalFollow(player.entity, 2);
    this.bot.pathfinder.setGoal(goal, true);
    return true;
  }

  /**
   * Go to a player's position (once, not continuous follow)
   */
  async goToPlayer(username: string, range: number = 2): Promise<boolean> {
    const player = this.bot.players[username];
    if (!player || !player.entity) {
      return false;
    }

    const goal = new goals.GoalNear(player.entity.position.x, player.entity.position.y, player.entity.position.z, range);
    this.bot.pathfinder.setGoal(goal);

    return new Promise((resolve) => {
      const onGoalReached = () => {
        cleanup();
        resolve(true);
      };

      const onPathUpdate = (results: any) => {
        if (results.status === 'noPath') {
          cleanup();
          resolve(false);
        }
      };

      const cleanup = () => {
        (this.bot.pathfinder as any).removeListener('goal_reached', onGoalReached);
        (this.bot.pathfinder as any).removeListener('path_update', onPathUpdate);
      };

      (this.bot.pathfinder as any).on('goal_reached', onGoalReached);
      (this.bot.pathfinder as any).on('path_update', onPathUpdate);

      // Timeout after 30 seconds
      setTimeout(() => {
        cleanup();
        resolve(false);
      }, 30000);
    });
  }

  /**
   * Collect blocks of a specific type
   */
  async collectBlock(blockType: string, count: number): Promise<{ state: boolean; message: string }> {
    if (!this.mcData) {
      return { state: false, message: 'Minecraft data not loaded' };
    }

    const blockId = this.mcData.blocksByName[blockType]?.id;
    if (!blockId) {
      return { state: false, message: `Unknown block type: ${blockType}` };
    }

    try {
      // Use mineflayer-collectblock plugin
      await (this.bot as any).collectBlock.collect(blockId, { count });
      return { state: true, message: `Collected ${count}x ${blockType}` };
    } catch (error) {
      return { state: false, message: `Failed to collect: ${(error as Error).message}` };
    }
  }

  /**
   * Get bot's current position
   */
  get position() {
    return this.bot.entity.position;
  }

  /**
   * Get bot's health
   */
  get health() {
    return this.bot.health;
  }

  /**
   * Get bot's food level
   */
  get food() {
    return this.bot.food;
  }

  /**
   * Get players dictionary
   */
  get players() {
    return this.bot.players;
  }

  /**
   * Get bot username
   */
  get username() {
    return this.bot.username;
  }

  /**
   * Check if bot is interrupted
   */
  get isInterrupted() {
    return this.interruptFlag;
  }
}

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
   * Collect blocks of a specific type.
   * Finds nearby blocks first, then collects them one by one.
   * Based on readyplayerx approach: findBlocks → get Block objects → collect.
   */
  async collectBlock(blockType: string, count: number): Promise<{ state: boolean; message: string }> {
    if (!this.mcData) {
      return { state: false, message: 'Minecraft data not loaded' };
    }

    // Resolve block type aliases (common names → actual block names)
    const blockTypes = resolveBlockAliases(blockType);

    // Get block IDs for all aliases
    const blockIds: number[] = [];
    for (const bt of blockTypes) {
      const id = this.mcData.blocksByName[bt]?.id;
      if (id !== undefined) {
        blockIds.push(id);
      }
    }

    if (blockIds.length === 0) {
      return { state: false, message: `Unknown block type: ${blockType}` };
    }

    let collected = 0;

    try {
      for (let i = 0; i < count; i++) {
        // Find nearby blocks (search up to 64 blocks away)
        const positions = this.bot.findBlocks({
          matching: blockIds,
          maxDistance: 64,
          count: 1,
        });

        if (positions.length === 0) {
          if (collected > 0) {
            return { state: true, message: `Collected ${collected}/${count}x ${blockType} (no more found nearby)` };
          }
          return { state: false, message: `No ${blockType} found within 64 blocks` };
        }

        // Get the actual Block object (this is what the plugin needs)
        const block = this.bot.blockAt(positions[0]);
        if (!block) {
          continue;
        }

        logger.info(`[${this.sessionId}] Collecting ${block.name} at (${block.position.x}, ${block.position.y}, ${block.position.z})`);

        // Try collectblock plugin first
        try {
          await (this.bot as any).collectBlock.collect(block);
          collected++;
        } catch (pluginError) {
          // Fallback: navigate to block, dig it, pick up items
          logger.warn(`[${this.sessionId}] collectBlock plugin failed, using manual dig: ${(pluginError as Error).message}`);
          try {
            // Navigate close to the block
            const goal = new goals.GoalNear(
              block.position.x,
              block.position.y,
              block.position.z,
              2
            );
            this.bot.pathfinder.setGoal(goal);

            // Wait to arrive (simple timeout-based)
            await new Promise<void>((resolve) => {
              const check = setInterval(() => {
                const dist = this.bot.entity.position.distanceTo(block.position);
                if (dist < 4) {
                  clearInterval(check);
                  resolve();
                }
              }, 250);
              setTimeout(() => {
                clearInterval(check);
                resolve();
              }, 15000);
            });

            // Equip best tool for the block
            try {
              await (this.bot as any).tool.equipForBlock(block);
            } catch {
              // No tool plugin or no suitable tool - that's ok
            }

            // Dig the block
            await this.bot.dig(block);
            collected++;

            // Brief wait to pick up drops
            await new Promise((r) => setTimeout(r, 500));
          } catch (manualError) {
            logger.warn(`[${this.sessionId}] Manual dig also failed: ${(manualError as Error).message}`);
          }
        }
      }

      if (collected === 0) {
        return { state: false, message: `Failed to collect any ${blockType}` };
      }

      return { state: true, message: `Collected ${collected}x ${blockType}` };
    } catch (error) {
      if (collected > 0) {
        return { state: true, message: `Collected ${collected}/${count}x ${blockType} (then error: ${(error as Error).message})` };
      }
      return { state: false, message: `Failed to collect ${blockType}: ${(error as Error).message}` };
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

/**
 * Resolve common block name aliases to actual Minecraft block names.
 * e.g. "wood" → ["oak_log", "birch_log", "spruce_log", ...]
 */
function resolveBlockAliases(blockType: string): string[] {
  const aliases: Record<string, string[]> = {
    // Wood aliases
    wood: ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'],
    log: ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'],
    plank: ['oak_planks', 'birch_planks', 'spruce_planks'],
    planks: ['oak_planks', 'birch_planks', 'spruce_planks'],

    // Stone aliases
    stone: ['stone', 'cobblestone'],
    cobble: ['cobblestone'],

    // Ore aliases - include deepslate variants
    coal: ['coal_ore', 'deepslate_coal_ore'],
    iron: ['iron_ore', 'deepslate_iron_ore'],
    gold: ['gold_ore', 'deepslate_gold_ore'],
    diamond: ['diamond_ore', 'deepslate_diamond_ore'],
    redstone: ['redstone_ore', 'deepslate_redstone_ore'],
    lapis: ['lapis_ore', 'deepslate_lapis_ore'],
    copper: ['copper_ore', 'deepslate_copper_ore'],
    emerald: ['emerald_ore', 'deepslate_emerald_ore'],

    // Dirt aliases
    dirt: ['dirt', 'grass_block'],
    grass: ['grass_block'],
    sand: ['sand', 'red_sand'],
  };

  return aliases[blockType.toLowerCase()] || [blockType];
}

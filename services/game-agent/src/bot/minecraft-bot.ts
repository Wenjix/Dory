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
   * Stop all current actions and clear pathfinding.
   * Sets interruptFlag so long-running tasks (like collectBlock) can check it and bail out.
   */
  async stop(): Promise<void> {
    this.interruptFlag = true;
    
    // Clear pathfinder goal
    if (this.bot.pathfinder) {
      this.bot.pathfinder.setGoal(null);
    }
    
    // Clear control states
    await this.bot.clearControlStates();
    
    // Stop collectblock plugin
    if ((this.bot as any).collectBlock) {
      try {
        (this.bot as any).collectBlock.cancelTask();
      } catch {
        // Ignore if no task to cancel
      }
    }

    // Stop digging if in progress
    try {
      this.bot.stopDigging();
    } catch {
      // Ignore if not digging
    }

    // NOTE: interruptFlag stays true - it's the responsibility of
    // the interrupted action to reset it when it sees the flag and stops.
    // If no action is running, reset it after a brief delay.
    setTimeout(() => {
      this.interruptFlag = false;
    }, 500);
  }

  /**
   * Follow a player. Also interrupts any running action (like collectBlock).
   */
  async followPlayer(username: string): Promise<boolean> {
    const player = this.bot.players[username];
    if (!player || !player.entity) {
      return false;
    }

    // Interrupt any running action first
    this.interruptFlag = true;

    // Cancel collectblock if running
    try {
      if ((this.bot as any).collectBlock) {
        (this.bot as any).collectBlock.cancelTask();
      }
    } catch { /* ignore */ }

    const goal = new goals.GoalFollow(player.entity, 2);
    this.bot.pathfinder.setGoal(goal, true);
    return true;
  }

  /**
   * Go to a player's position (once, not continuous follow).
   * Uses async goto() (like readyplayerx) instead of setGoal+events.
   */
  async goToPlayer(username: string, range: number = 2): Promise<boolean> {
    const player = this.bot.players[username];
    if (!player || !player.entity) {
      return false;
    }

    const goal = new goals.GoalNear(
      player.entity.position.x,
      player.entity.position.y,
      player.entity.position.z,
      range
    );

    try {
      await this.bot.pathfinder.goto(goal);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Collect blocks of a specific type.
   * - Finds NEAREST blocks first (sorted by distance)
   * - Respects count limit (capped at MAX_COLLECT)
   * - Verifies via inventory so it stops when target is actually reached
   * - Checks interruptFlag BOTH before and after each collection
   */
  async collectBlock(blockType: string, count: number): Promise<{ state: boolean; message: string }> {
    if (!this.mcData) {
      return { state: false, message: 'Minecraft data not loaded' };
    }

    // Cap count to a reasonable maximum
    const MAX_COLLECT = 10;
    const targetCount = Math.min(Math.max(count, 1), MAX_COLLECT);

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

    // Reset interrupt flag at the start of a new action
    this.interruptFlag = false;

    // ── Track inventory so we know when we've ACTUALLY collected enough ──
    const countMatchingItems = (): number => {
      try {
        return this.bot.inventory.items()
          .filter((item: any) => blockTypes.some(bt => item.name.includes(bt)))
          .reduce((sum: number, item: any) => sum + (item.count ?? 0), 0);
      } catch {
        return 0;
      }
    };

    const initialCount = countMatchingItems();
    let collected = 0;

    try {
      for (let i = 0; i < targetCount; i++) {
        // ── Check for interruption BEFORE collecting ────────────────────
        if (this.interruptFlag) {
          this.interruptFlag = false;
          logger.info(`[${this.sessionId}] Collection interrupted after ${collected} blocks`);
          return {
            state: collected > 0,
            message: collected > 0
              ? `Collected ${collected}/${targetCount}x ${blockType} (interrupted)`
              : `Collection cancelled`,
          };
        }

        // ── Check if inventory already has enough ──────────────────────
        const currentInventory = countMatchingItems();
        const actualCollected = currentInventory - initialCount;
        if (actualCollected >= targetCount) {
          logger.info(`[${this.sessionId}] Already collected ${actualCollected} via inventory check`);
          return { state: true, message: `Collected ${actualCollected}x ${blockType}` };
        }

        // ── Find nearby blocks, sorted by distance ─────────────────────
        const positions = this.bot.findBlocks({
          matching: blockIds,
          maxDistance: 64,
          count: 10,
        });

        if (positions.length === 0) {
          if (collected > 0) {
            return { state: true, message: `Collected ${collected}/${targetCount}x ${blockType} (no more found nearby)` };
          }
          return { state: false, message: `No ${blockType} found within 64 blocks` };
        }

        // Sort by distance to bot (nearest first)
        const botPos = this.bot.entity.position;
        positions.sort((a, b) =>
          botPos.distanceTo(a) - botPos.distanceTo(b)
        );

        const block = this.bot.blockAt(positions[0]);
        if (!block) {
          continue;
        }

        const dist = botPos.distanceTo(block.position).toFixed(1);
        logger.info(`[${this.sessionId}] Collecting ${block.name} at (${block.position.x}, ${block.position.y}, ${block.position.z}) - ${dist} blocks away [${collected + 1}/${targetCount}]`);

        // ── Collect the block ───────────────────────────────────────────
        try {
          await (this.bot as any).collectBlock.collect(block);
          collected++;
        } catch (pluginError) {
          logger.warn(`[${this.sessionId}] Plugin failed, manual dig: ${(pluginError as Error).message}`);
          try {
            await this.manualCollect(block);
            collected++;
          } catch (manualError) {
            logger.warn(`[${this.sessionId}] Manual dig failed: ${(manualError as Error).message}`);
          }
        }

        // ── Check interrupt AFTER collecting ────────────────────────────
        if (this.interruptFlag) {
          this.interruptFlag = false;
          logger.info(`[${this.sessionId}] Collection interrupted after collect() — got ${collected} blocks`);
          return {
            state: collected > 0,
            message: collected > 0
              ? `Collected ${collected}/${targetCount}x ${blockType} (interrupted)`
              : `Collection cancelled`,
          };
        }

        // Brief pause between collections
        await new Promise((r) => setTimeout(r, 200));
      }

      // Final inventory check
      const finalCount = countMatchingItems();
      const totalCollected = finalCount - initialCount;
      logger.info(`[${this.sessionId}] Collection done: loop=${collected}, inventory_delta=${totalCollected}`);

      if (totalCollected === 0 && collected === 0) {
        return { state: false, message: `Failed to collect any ${blockType}` };
      }

      return { state: true, message: `Collected ${totalCollected || collected}x ${blockType}` };
    } catch (error) {
      this.interruptFlag = false;
      if (collected > 0) {
        return { state: true, message: `Collected ${collected}/${targetCount}x ${blockType} (then error: ${(error as Error).message})` };
      }
      return { state: false, message: `Failed to collect ${blockType}: ${(error as Error).message}` };
    }
  }

  /**
   * Manual block collection fallback: navigate close, dig, wait for drops.
   */
  private async manualCollect(block: any): Promise<void> {
    // Navigate close to the block
    const goal = new goals.GoalNear(
      block.position.x,
      block.position.y,
      block.position.z,
      2
    );
    this.bot.pathfinder.setGoal(goal);

    // Wait to arrive (check distance or timeout)
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (this.interruptFlag) {
          clearInterval(check);
          resolve();
          return;
        }
        const dist = this.bot.entity.position.distanceTo(block.position);
        if (dist < 4) {
          clearInterval(check);
          resolve();
        }
      }, 250);
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 10000);
    });

    if (this.interruptFlag) return;

    // Equip best tool
    try {
      await (this.bot as any).tool.equipForBlock(block);
    } catch {
      // No tool plugin or no suitable tool
    }

    // Dig the block
    await this.bot.dig(block);

    // Brief wait to pick up drops
    await new Promise((r) => setTimeout(r, 400));
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

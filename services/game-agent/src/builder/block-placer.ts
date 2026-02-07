/**
 * Block Placer - Places blocks in the Minecraft world via chat commands.
 *
 * Uses /setblock and /fill commands (requires bot to be /op'd).
 * Features progressive placement with delays for visual effect,
 * progress events, and cancellation support.
 */

import { createLogger } from '@dory/shared';
import { MinecraftBot } from '../bot/minecraft-bot';
import { gameEventBus } from '../events/event-bus';
import type { BlockPlacement } from './js-sandbox';

const logger = createLogger('block-placer');

export interface PlacerOptions {
  /** Delay between individual /setblock commands in ms (default: 20) */
  blockDelayMs?: number;
  /** Delay between /fill commands in ms (default: 50) */
  fillDelayMs?: number;
  /** Emit progress events every N blocks (default: 50) */
  progressInterval?: number;
  /** Abort signal - set to true to cancel placement */
  abortSignal?: { aborted: boolean };
}

export interface PlacerResult {
  success: boolean;
  blocksPlaced: number;
  totalBlocks: number;
  cancelled: boolean;
  message: string;
  durationMs: number;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a block string for the /setblock command.
 * Input:  "minecraft:oak_planks[facing=north]"
 * Output: "minecraft:oak_planks[facing=north]"  (pass-through, MC understands this format)
 */
function formatBlockForCommand(block: string): string {
  return block;
}

/**
 * Place blocks progressively in the world using /setblock commands.
 * Blocks are placed bottom-to-top for a natural building effect.
 *
 * Requires the bot to have operator permissions (/op).
 */
export async function placeBlocks(
  bot: MinecraftBot,
  placements: BlockPlacement[],
  sessionId: string,
  options: PlacerOptions = {}
): Promise<PlacerResult> {
  const {
    blockDelayMs = 20,
    fillDelayMs = 50,
    progressInterval = 50,
    abortSignal,
  } = options;

  const startTime = Date.now();
  const totalBlocks = placements.length;
  let blocksPlaced = 0;

  if (totalBlocks === 0) {
    return {
      success: true,
      blocksPlaced: 0,
      totalBlocks: 0,
      cancelled: false,
      message: 'No blocks to place',
      durationMs: 0,
    };
  }

  logger.info(`Starting block placement: ${totalBlocks} blocks`);

  // ── Optimize: group adjacent fills ──────────────────────────────────────

  // For now, we use individual /setblock commands for reliability.
  // TODO: detect rectangular regions of same block type and use /fill
  // This is an optimization pass we can add later.

  for (const placement of placements) {
    // Check cancellation
    if (abortSignal?.aborted) {
      logger.info(`Build cancelled after ${blocksPlaced}/${totalBlocks} blocks`);
      return {
        success: false,
        blocksPlaced,
        totalBlocks,
        cancelled: true,
        message: `Build cancelled after placing ${blocksPlaced}/${totalBlocks} blocks`,
        durationMs: Date.now() - startTime,
      };
    }

    const { x, y, z, block } = placement;
    const cmd = `/setblock ${x} ${y} ${z} ${formatBlockForCommand(block)}`;

    try {
      bot.chat(cmd);
      blocksPlaced++;

      // Progress reporting (log only, no events — we only notify voice agent on completion)
      if (blocksPlaced % progressInterval === 0) {
        const pct = Math.round((blocksPlaced / totalBlocks) * 100);
        logger.info(`Build progress: ${blocksPlaced}/${totalBlocks} (${pct}%)`);
      }

      // Delay for progressive visual effect
      if (blockDelayMs > 0) {
        await sleep(blockDelayMs);
      }
    } catch (err) {
      logger.warn(`Failed to place block at (${x}, ${y}, ${z}): ${(err as Error).message}`);
      // Continue placing other blocks
    }
  }

  const durationMs = Date.now() - startTime;
  logger.info(`Build complete: ${blocksPlaced}/${totalBlocks} blocks in ${(durationMs / 1000).toFixed(1)}s`);

  // Emit building completed event
  gameEventBus.emit({
    type: 'custom:structure_built',
    source: 'custom',
    sessionId,
    timestamp: new Date(),
    data: {
      structureType: 'other' as const,
      blockType: 'mixed',
      blocksPlaced,
    },
    metadata: {
      phase: 'completed',
      totalBlocks,
      durationMs,
    },
  });

  return {
    success: true,
    blocksPlaced,
    totalBlocks,
    cancelled: false,
    message: `Successfully placed ${blocksPlaced} blocks in ${(durationMs / 1000).toFixed(1)}s`,
    durationMs,
  };
}

/**
 * Clear an area using /fill with air before building.
 * Useful to flatten terrain at the build site.
 */
export async function clearArea(
  bot: MinecraftBot,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number
): Promise<void> {
  // /fill can handle up to 32768 blocks per command
  // For large areas, we may need to split into chunks
  const cmd = `/fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} minecraft:air`;
  logger.info(`Clearing area: (${x1},${y1},${z1}) to (${x2},${y2},${z2})`);
  bot.chat(cmd);
  await sleep(100); // small delay for server to process
}

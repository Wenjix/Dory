/**
 * State Manager
 *
 * Captures a structured snapshot of the current game state
 * used by the planning system for decision-making and re-planning.
 */

import { MinecraftBot } from '../bot/minecraft-bot';
import { getVisiblePlayers } from '../actions/vision';
import type { StateSnapshot, InventoryItem } from './types';
import { createLogger } from '@dory/shared';

const logger = createLogger('StateManager');

/**
 * Build a full StateSnapshot from the current bot state.
 * This is the structured version used by the planning system
 * (not the text version used in system prompts).
 */
export function captureState(bot: MinecraftBot): StateSnapshot {
  const pos = bot.position;

  // Inventory
  const inventory: InventoryItem[] = bot.bot.inventory
    .items()
    .map((item) => ({
      name: item.name,
      count: item.count,
    }));

  // Nearby player
  let player: StateSnapshot['player'] = { visible: false };
  try {
    const playersResult = getVisiblePlayers(bot);
    if (playersResult.players.length > 0) {
      const nearest = playersResult.players[0];
      player = {
        visible: true,
        username: nearest.username,
        position: {
          x: nearest.position.x,
          y: nearest.position.y,
          z: nearest.position.z,
        },
      };
    }
  } catch (err) {
    logger.warn('Failed to get visible players for state snapshot');
  }

  // Nearby block types (scan a small radius for unique block names)
  let nearbyBlocks: string[] = [];
  try {
    nearbyBlocks = scanNearbyBlockTypes(bot, 8);
  } catch {
    // Non-critical, skip
  }

  return {
    timestamp: new Date(),
    bot: {
      position: {
        x: Math.round(pos.x * 10) / 10,
        y: Math.round(pos.y * 10) / 10,
        z: Math.round(pos.z * 10) / 10,
      },
      inventory,
      health: bot.health,
      food: bot.food,
      isFollowing: bot.bot.pathfinder?.isMoving() ?? false,
    },
    player,
    nearbyBlocks,
  };
}

/**
 * Scan nearby blocks and return unique block type names.
 * Useful for the LLM to know what resources are available.
 */
function scanNearbyBlockTypes(bot: MinecraftBot, radius: number): string[] {
  const seen = new Set<string>();
  const pos = bot.position;

  for (let dx = -radius; dx <= radius; dx += 2) {
    for (let dy = -4; dy <= 4; dy += 2) {
      for (let dz = -radius; dz <= radius; dz += 2) {
        const block = bot.bot.blockAt(pos.offset(dx, dy, dz));
        if (block && block.name !== 'air' && block.name !== 'cave_air') {
          seen.add(block.name);
        }
      }
    }
  }

  return Array.from(seen).sort();
}

/**
 * Format a StateSnapshot as a concise text string for LLM context.
 * Used when the planning prompt needs to include current state.
 */
export function formatStateForLLM(state: StateSnapshot): string {
  const inv =
    state.bot.inventory.length > 0
      ? state.bot.inventory.map((i) => `${i.count}x ${i.name}`).join(', ')
      : 'empty';

  const playerStr = state.player.visible
    ? `${state.player.username} at (${state.player.position?.x}, ${state.player.position?.y}, ${state.player.position?.z})`
    : 'not visible';

  const blocksStr =
    state.nearbyBlocks && state.nearbyBlocks.length > 0
      ? state.nearbyBlocks.join(', ')
      : 'unknown';

  return [
    `Position: (${state.bot.position.x}, ${state.bot.position.y}, ${state.bot.position.z})`,
    `Health: ${state.bot.health}/20, Food: ${state.bot.food}/20`,
    `Inventory: ${inv}`,
    `Player: ${playerStr}`,
    `Nearby blocks: ${blocksStr}`,
  ].join('\n');
}

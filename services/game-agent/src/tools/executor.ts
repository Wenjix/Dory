/**
 * Tool Executor - Routes LLM tool calls to actual bot action functions.
 *
 * Each tool name from the registry maps to a handler that calls the
 * corresponding action and returns a standardized result.
 */

import { MinecraftBot } from '../bot/minecraft-bot';
import {
  goToPosition,
  equipItem,
  craftItem,
  placeBlock,
  breakBlock,
  storeItemInChest,
  getItemFromChest,
  eatFood,
  hasItem,
  listChestContents,
} from '../actions/helpers';
import {
  buildPillar,
  buildWall,
  buildFloor,
} from '../actions/building';
import {
  placeBlockWherePlayerLooking,
  buildPillarWherePlayerLooking,
  buildWallWherePlayerLooking,
} from '../actions/player-building';
import {
  describeTarget,
  describePlayerTarget,
  scanArea,
  getVisiblePlayers,
} from '../actions/vision';
import { createLogger } from '@dory/shared';
import {
  emitItemCrafted,
  emitStructureBuilt,
  emitResourceCollected,
} from '../events';

const logger = createLogger('tool-executor');

export interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

type ToolHandler = (bot: MinecraftBot, args: Record<string, any>) => Promise<ToolResult>;

// ─── Handler Implementations ──────────────────────────────────────────────────

const handlers: Record<string, ToolHandler> = {

  // ── Movement ──────────────────────────────────────────────────────────────

  follow_player: async (bot, args) => {
    // Use provided username, or fallback to nearest player
    const username = args.username || findNearestPlayerName(bot);
    if (!username) {
      return { success: false, message: 'No player found nearby to follow' };
    }
    const success = await bot.followPlayer(username);
    return {
      success,
      message: success
        ? `Now following ${username}`
        : `Could not find player ${username}`,
    };
  },

  come_to_me: async (bot, args) => {
    const username = args.username || findNearestPlayerName(bot);
    if (!username) {
      return { success: false, message: 'No player found nearby' };
    }
    const success = await bot.goToPlayer(username, 2);
    return {
      success,
      message: success
        ? `Arrived at ${username}'s position`
        : `Could not reach ${username}`,
    };
  },

  go_to_position: async (bot, args) => {
    const { x, y, z } = args;
    const success = await goToPosition(bot, x, y, z);
    return {
      success,
      message: success
        ? `Arrived at (${x}, ${y}, ${z})`
        : `Could not reach (${x}, ${y}, ${z})`,
    };
  },

  stop: async (bot) => {
    await bot.stop();
    return { success: true, message: 'Stopped all actions' };
  },

  // ── Collection & Mining ───────────────────────────────────────────────────

  collect_resource: async (bot, args) => {
    const { block_type, count = 1 } = args;
    const result = await bot.collectBlock(block_type, count);
    if (result.state) {
      // Extract collected count from message (e.g. "Collected 5x oak_log")
      const countMatch = result.message.match(/Collected (\d+)/);
      const collected = countMatch ? parseInt(countMatch[1]) : count;
      emitResourceCollected(bot.sessionId, block_type, collected, collected);
    }
    return {
      success: result.state,
      message: result.message,
    };
  },

  break_block: async (bot, args) => {
    const { x, y, z } = args;
    return breakBlock(bot, x, y, z);
  },

  // ── Inventory & Crafting ──────────────────────────────────────────────────

  get_inventory: async (bot) => {
    const items = bot.bot.inventory.items();
    if (items.length === 0) {
      return { success: true, message: 'Inventory is empty', data: { items: [] } };
    }

    const summary = items.map((i) => `${i.count}x ${i.name}`).join(', ');
    return {
      success: true,
      message: `Inventory: ${summary}`,
      data: {
        items: items.map((i) => ({ name: i.name, count: i.count })),
      },
    };
  },

  has_item: async (bot, args) => {
    const { item_name, count = 1 } = args;
    const result = hasItem(bot, item_name, count);
    return {
      success: result.success,
      message: result.message,
      data: { hasItem: result.hasItem, count: result.count },
    };
  },

  equip_item: async (bot, args) => {
    const { item_name } = args;
    const success = await equipItem(bot, item_name);
    return {
      success,
      message: success
        ? `Equipped ${item_name}`
        : `Don't have ${item_name} in inventory`,
    };
  },

  craft_item: async (bot, args) => {
    const { item_name, count = 1 } = args;
    const result = await craftItem(bot, item_name, count);
    if (result.success) {
      emitItemCrafted(bot.sessionId, item_name, count);
    }
    return result;
  },

  drop_item: async (bot, args) => {
    const { item_name, count = -1 } = args;
    const items = bot.bot.inventory.items();
    const matching = items.filter((i: any) => i.name === item_name || i.name.includes(item_name));

    if (matching.length === 0) {
      return { success: false, message: `Don't have any ${item_name} in inventory` };
    }

    let totalDropped = 0;
    const toDrop = count === -1 ? Infinity : count;

    for (const item of matching) {
      if (totalDropped >= toDrop) break;
      const dropCount = Math.min(item.count, toDrop - totalDropped);
      try {
        await bot.bot.tossStack(item);
        totalDropped += item.count;
      } catch {
        // tossStack drops the whole stack; if we need partial, use toss()
        try {
          await bot.bot.toss(item.type, item.metadata, dropCount);
          totalDropped += dropCount;
        } catch (err) {
          return {
            success: totalDropped > 0,
            message: totalDropped > 0
              ? `Dropped ${totalDropped}x ${item_name} (error on remaining: ${(err as Error).message})`
              : `Failed to drop ${item_name}: ${(err as Error).message}`,
          };
        }
      }
    }

    return {
      success: true,
      message: `Dropped ${totalDropped}x ${item_name}`,
    };
  },

  eat_food: async (bot) => {
    return eatFood(bot);
  },

  // ── Storage ───────────────────────────────────────────────────────────────

  store_in_chest: async (bot, args) => {
    const { item_name, count = -1 } = args;
    return storeItemInChest(bot, item_name, count);
  },

  get_from_chest: async (bot, args) => {
    const { item_name, count = -1 } = args;
    return getItemFromChest(bot, item_name, count);
  },

  list_chest_contents: async (bot) => {
    return listChestContents(bot);
  },

  // ── Building (Bot Position) ───────────────────────────────────────────────

  place_block: async (bot, args) => {
    const { block_type, x, y, z } = args;
    return placeBlock(bot, block_type, x, y, z);
  },

  build_pillar: async (bot, args) => {
    const { height, block_type } = args;
    const result = await buildPillar(bot, height, block_type);
    if (result.success) {
      emitStructureBuilt(bot.sessionId, 'pillar', block_type, height || 3);
    }
    return result;
  },

  build_wall: async (bot, args) => {
    const { length, height, block_type } = args;
    const result = await buildWall(bot, length, height, block_type);
    if (result.success) {
      emitStructureBuilt(bot.sessionId, 'wall', block_type, (length || 5) * (height || 3));
    }
    return result;
  },

  build_floor: async (bot, args) => {
    const { width, length, block_type } = args;
    const result = await buildFloor(bot, width, length, block_type);
    if (result.success) {
      emitStructureBuilt(bot.sessionId, 'platform', block_type, (width || 5) * (length || 5));
    }
    return result;
  },

  // ── Building (Player POV) ─────────────────────────────────────────────────

  place_block_where_player_looking: async (bot, args) => {
    const { block_type } = args;
    return placeBlockWherePlayerLooking(bot, block_type);
  },

  build_pillar_where_player_looking: async (bot, args) => {
    const { height, block_type } = args;
    const result = await buildPillarWherePlayerLooking(bot, height, block_type);
    if (result.success) {
      emitStructureBuilt(bot.sessionId, 'pillar', block_type, height || 3);
    }
    return result;
  },

  build_wall_where_player_looking: async (bot, args) => {
    const { length, height, block_type } = args;
    const result = await buildWallWherePlayerLooking(bot, length, height, block_type);
    if (result.success) {
      emitStructureBuilt(bot.sessionId, 'wall', block_type, (length || 5) * (height || 3));
    }
    return result;
  },

  // ── Vision & Info ─────────────────────────────────────────────────────────

  what_am_i_looking_at: async (bot) => {
    const description = describeTarget(bot);
    return { success: true, message: description };
  },

  what_is_player_looking_at: async (bot) => {
    const description = describePlayerTarget(bot);
    return { success: true, message: description };
  },

  scan_area: async (bot, args) => {
    const { range = 16 } = args;
    const result = scanArea(bot, range);
    if (!result.success) {
      return { success: false, message: 'Failed to scan area' };
    }

    const blockSummary = result.blocks.slice(0, 10).map((b) => `${b.count}x ${b.name}`).join(', ');
    const entitySummary = result.entities.length > 0
      ? result.entities.map((e) => `${e.count}x ${e.type}`).join(', ')
      : 'none';

    return {
      success: true,
      message: `Nearby blocks: ${blockSummary || 'none'}. Entities: ${entitySummary}`,
      data: { blocks: result.blocks.slice(0, 10), entities: result.entities },
    };
  },

  get_position: async (bot) => {
    const pos = bot.position;
    return {
      success: true,
      message: `Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}), health: ${bot.health}/20, food: ${bot.food}/20`,
      data: {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        health: bot.health,
        food: bot.food,
      },
    };
  },

  get_nearby_players: async (bot) => {
    const result = getVisiblePlayers(bot);
    if (!result.success || result.players.length === 0) {
      return { success: true, message: 'No players nearby', data: { players: [] } };
    }

    const summary = result.players
      .map((p) => `${p.username} (${p.distance.toFixed(1)} blocks away)`)
      .join(', ');

    return {
      success: true,
      message: `Nearby players: ${summary}`,
      data: { players: result.players },
    };
  },

  send_chat: async (bot, args) => {
    const { message } = args;
    bot.chat(message);
    return { success: true, message: `Sent chat: "${message}"` };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findNearestPlayerName(bot: MinecraftBot): string | null {
  const players = Object.values(bot.bot.players).filter(
    (p) => p.entity && p.username !== bot.username
  );

  if (players.length === 0) return null;

  const nearest = players.reduce((prev, curr) => {
    const prevDist = bot.bot.entity.position.distanceTo(prev.entity!.position);
    const currDist = bot.bot.entity.position.distanceTo(curr.entity!.position);
    return currDist < prevDist ? curr : prev;
  });

  return nearest.username;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute a tool by name with the given arguments.
 * Returns a standardized ToolResult.
 */
export async function executeTool(
  bot: MinecraftBot,
  toolName: string,
  args: Record<string, any>
): Promise<ToolResult> {
  const handler = handlers[toolName];

  if (!handler) {
    logger.warn(`Unknown tool: ${toolName}`);
    return {
      success: false,
      message: `Unknown tool: ${toolName}. Available: ${Object.keys(handlers).join(', ')}`,
    };
  }

  logger.info(`Executing tool: ${toolName}`, { args });

  try {
    const result = await handler(bot, args);
    logger.info(`Tool ${toolName} result: ${result.message}`);
    return result;
  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error(`Tool ${toolName} error: ${errorMessage}`);
    return {
      success: false,
      message: `Tool "${toolName}" failed: ${errorMessage}`,
    };
  }
}

/**
 * Get all registered tool handler names (for debugging)
 */
export function getRegisteredHandlers(): string[] {
  return Object.keys(handlers);
}

import { Vec3 } from 'vec3';
import { MinecraftBot } from '../bot/minecraft-bot';
import { Block } from 'prismarine-block';
import { createLogger } from '@dory/shared';

const logger = createLogger('vision');

/**
 * Perform manual raycast to find what the bot is looking at
 */
export function getBlockLookingAt(
  bot: MinecraftBot,
  maxDistance: number = 5
): {
  success: boolean;
  blockName?: string;
  position?: { x: number; y: number; z: number };
  distance?: number;
} {
  try {
    const block = bot.bot.blockAtCursor(maxDistance);
    
    if (!block || block.name === 'air') {
      return {
        success: false,
      };
    }

    return {
      success: true,
      blockName: block.name,
      position: {
        x: block.position.x,
        y: block.position.y,
        z: block.position.z,
      },
      distance: bot.bot.entity.position.distanceTo(block.position),
    };
  } catch (error) {
    logger.error('getBlockLookingAt error:', error);
    return { success: false };
  }
}

/**
 * Find what entity the bot is looking at
 */
export function getEntityLookingAt(
  bot: MinecraftBot,
  maxDistance: number = 5
): {
  success: boolean;
  entityType?: string;
  entityName?: string;
  distance?: number;
} {
  try {
    // Get bot's look direction
    const yaw = bot.bot.entity.yaw;
    const pitch = bot.bot.entity.pitch;
    
    // Calculate look direction vector
    const direction = new Vec3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    );

    // Check all nearby entities
    const entities = Object.values(bot.bot.entities).filter((entity) => {
      if (entity === bot.bot.entity) return false;
      
      const distance = bot.bot.entity.position.distanceTo(entity.position);
      if (distance > maxDistance) return false;

      // Calculate vector to entity
      const toEntity = entity.position.minus(bot.bot.entity.position).normalize();
      
      // Check if entity is in look direction (dot product > threshold)
      const dotProduct = direction.dot(toEntity);
      return dotProduct > 0.9; // About 25 degree cone
    });

    if (entities.length === 0) {
      return { success: false };
    }

    // Get closest entity in view
    const closest = entities.reduce((prev, curr) => {
      const prevDist = bot.bot.entity.position.distanceTo(prev.position);
      const currDist = bot.bot.entity.position.distanceTo(curr.position);
      return currDist < prevDist ? curr : prev;
    });

    return {
      success: true,
      entityType: closest.type,
      entityName: closest.name || closest.username || closest.type,
      distance: bot.bot.entity.position.distanceTo(closest.position),
    };
  } catch (error) {
    logger.error('getEntityLookingAt error:', error);
    return { success: false };
  }
}

/**
 * Describe what the bot is currently looking at
 */
export function describeTarget(bot: MinecraftBot): string {
  // First check for blocks
  const blockResult = getBlockLookingAt(bot);
  if (blockResult.success && blockResult.blockName) {
    return `Looking at ${blockResult.blockName} at (${blockResult.position?.x}, ${blockResult.position?.y}, ${blockResult.position?.z}), ${blockResult.distance?.toFixed(1)} blocks away`;
  }

  // Then check for entities
  const entityResult = getEntityLookingAt(bot);
  if (entityResult.success && entityResult.entityName) {
    return `Looking at ${entityResult.entityName} (${entityResult.entityType}), ${entityResult.distance?.toFixed(1)} blocks away`;
  }

  return "Not looking at anything specific (probably sky or too far away)";
}

/**
 * Scan the area in the bot's field of view
 */
export function scanArea(
  bot: MinecraftBot,
  range: number = 16
): {
  success: boolean;
  blocks: { name: string; count: number }[];
  entities: { type: string; count: number }[];
} {
  try {
    // Scan for blocks
    const blockCounts = new Map<string, number>();
    const positions = bot.bot.findBlocks({
      matching: (block) => block.name !== 'air',
      maxDistance: range,
      count: 100,
    });

    for (const pos of positions) {
      const block = bot.bot.blockAt(pos);
      if (block) {
        blockCounts.set(block.name, (blockCounts.get(block.name) || 0) + 1);
      }
    }

    // Scan for entities
    const entityCounts = new Map<string, number>();
    Object.values(bot.bot.entities).forEach((entity) => {
      if (entity === bot.bot.entity) return;
      
      const distance = bot.bot.entity.position.distanceTo(entity.position);
      if (distance <= range) {
        const type = entity.type;
        entityCounts.set(type, (entityCounts.get(type) || 0) + 1);
      }
    });

    return {
      success: true,
      blocks: Array.from(blockCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      entities: Array.from(entityCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    };
  } catch (error) {
    logger.error('scanArea error:', error);
    return { success: false, blocks: [], entities: [] };
  }
}

/**
 * Get detailed information about visible players
 */
export function getVisiblePlayers(bot: MinecraftBot): {
  success: boolean;
  players: Array<{
    username: string;
    distance: number;
    position: { x: number; y: number; z: number };
  }>;
} {
  try {
    const players = Object.values(bot.bot.players)
      .filter((player) => player.entity && player.username !== bot.username)
      .map((player) => ({
        username: player.username,
        distance: bot.bot.entity.position.distanceTo(player.entity!.position),
        position: {
          x: player.entity!.position.x,
          y: player.entity!.position.y,
          z: player.entity!.position.z,
        },
      }))
      .sort((a, b) => a.distance - b.distance);

    return {
      success: true,
      players,
    };
  } catch (error) {
    logger.error('getVisiblePlayers error:', error);
    return { success: false, players: [] };
  }
}

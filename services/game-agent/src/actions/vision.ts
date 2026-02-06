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

/**
 * Get the nearest player entity
 */
function getNearestPlayer(bot: MinecraftBot) {
  const players = Object.values(bot.bot.players).filter(
    (player) => player.entity && player.username !== bot.username
  );

  if (players.length === 0) return null;

  return players.reduce((nearest, current) => {
    const nearestDist = bot.bot.entity.position.distanceTo(nearest.entity!.position);
    const currentDist = bot.bot.entity.position.distanceTo(current.entity!.position);
    return currentDist < nearestDist ? current : nearest;
  });
}

/**
 * Perform raycast from PLAYER's point of view
 * This is more intuitive for building commands.
 * 
 * Face detection uses the readyplayerx approach: track the previous block
 * position along the ray, and when we enter a solid block, determine which
 * face was crossed by comparing current vs previous block coordinates.
 */
export function getBlockPlayerIsLookingAt(
  bot: MinecraftBot,
  maxDistance: number = 6
): {
  success: boolean;
  blockName?: string;
  blockId?: number;
  position?: { x: number; y: number; z: number };
  distance?: number;
  face?: 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';
  adjacentPosition?: { x: number; y: number; z: number };
} {
  try {
    const player = getNearestPlayer(bot);
    if (!player || !player.entity) {
      return { success: false };
    }

    const playerEntity = player.entity;
    const yaw = playerEntity.yaw;
    const pitch = playerEntity.pitch;

    // Player's eye position (1.62 blocks above feet)
    const eyePosition = playerEntity.position.offset(0, 1.62, 0);

    // Calculate look direction vector (mineflayer conventions)
    const direction = new Vec3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    // Raycast with small step size for accuracy (matching readyplayerx)
    const stepSize = 0.05;
    let lastBlockPos: Vec3 | null = null;
    let hitBlock: Block | null = null;
    let hitFace: 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west' = 'top';
    let hitDistance = 0;

    for (let dist = 0; dist <= maxDistance; dist += stepSize) {
      // Actual ray position (not floored)
      const currentPos = eyePosition.offset(
        direction.x * dist,
        direction.y * dist,
        direction.z * dist
      );

      // Block coordinates (floored)
      const blockPos = new Vec3(
        Math.floor(currentPos.x),
        Math.floor(currentPos.y),
        Math.floor(currentPos.z)
      );

      // Skip if we're still in the same block
      if (lastBlockPos && blockPos.equals(lastBlockPos)) {
        continue;
      }

      // Check block at this position
      const block = bot.bot.blockAt(blockPos);

      if (block && block.name !== 'air' && block.name !== 'water' && block.name !== 'lava') {
        // Hit a solid block!
        hitBlock = block;
        hitDistance = dist;

        // Determine which face was hit by checking which boundary we crossed
        if (lastBlockPos) {
          const dx = blockPos.x - lastBlockPos.x;
          const dy = blockPos.y - lastBlockPos.y;
          const dz = blockPos.z - lastBlockPos.z;

          if (dx !== 0 || dy !== 0 || dz !== 0) {
            // Use boundary-crossing direction (readyplayerx approach)
            // Priority: check the axis with the largest change first
            // For diagonal crossings, use the intersection point to resolve
            if (Math.abs(dy) >= Math.abs(dx) && Math.abs(dy) >= Math.abs(dz)) {
              hitFace = dy < 0 ? 'top' : 'bottom';
            } else if (Math.abs(dx) >= Math.abs(dz)) {
              hitFace = dx < 0 ? 'east' : 'west';
            } else {
              hitFace = dz < 0 ? 'south' : 'north';
            }

            // If multiple axes changed (diagonal entry), refine using
            // which face of the block the ray point is closest to
            if ((dx !== 0 ? 1 : 0) + (dy !== 0 ? 1 : 0) + (dz !== 0 ? 1 : 0) > 1) {
              const relX = currentPos.x - blockPos.x;
              const relY = currentPos.y - blockPos.y;
              const relZ = currentPos.z - blockPos.z;

              const distances = [
                { face: 'west' as const, d: relX },           // distance to x=0 face
                { face: 'east' as const, d: 1 - relX },       // distance to x=1 face
                { face: 'bottom' as const, d: relY },          // distance to y=0 face
                { face: 'top' as const, d: 1 - relY },        // distance to y=1 face
                { face: 'north' as const, d: relZ },           // distance to z=0 face
                { face: 'south' as const, d: 1 - relZ },      // distance to z=1 face
              ];

              // The face closest to the intersection point is the entry face
              distances.sort((a, b) => a.d - b.d);
              hitFace = distances[0].face;
            }
          }
        } else {
          // Fallback: determine face from intersection point relative to block center
          const relX = currentPos.x - blockPos.x - 0.5;
          const relY = currentPos.y - blockPos.y - 0.5;
          const relZ = currentPos.z - blockPos.z - 0.5;

          const absX = Math.abs(relX);
          const absY = Math.abs(relY);
          const absZ = Math.abs(relZ);

          if (absY > absX && absY > absZ) {
            hitFace = relY > 0 ? 'top' : 'bottom';
          } else if (absX > absZ) {
            hitFace = relX > 0 ? 'east' : 'west';
          } else {
            hitFace = relZ > 0 ? 'south' : 'north';
          }
        }

        break; // Found our block, stop raycast
      }

      // Track the last block position (this was air/water/lava or out of range)
      lastBlockPos = blockPos;
    }

    if (!hitBlock) {
      return { success: false };
    }

    // Calculate adjacent position based on face
    const adjacentPos = hitBlock.position.clone();
    switch (hitFace) {
      case 'top':    adjacentPos.y += 1; break;
      case 'bottom': adjacentPos.y -= 1; break;
      case 'north':  adjacentPos.z -= 1; break;
      case 'south':  adjacentPos.z += 1; break;
      case 'west':   adjacentPos.x -= 1; break;
      case 'east':   adjacentPos.x += 1; break;
    }

    logger.info(`Player raycast hit ${hitBlock.name} at (${hitBlock.position.x}, ${hitBlock.position.y}, ${hitBlock.position.z}), face: ${hitFace}, adjacent: (${adjacentPos.x}, ${adjacentPos.y}, ${adjacentPos.z})`);

    return {
      success: true,
      blockName: hitBlock.name,
      blockId: hitBlock.type,
      position: {
        x: hitBlock.position.x,
        y: hitBlock.position.y,
        z: hitBlock.position.z,
      },
      distance: hitDistance,
      face: hitFace,
      adjacentPosition: {
        x: adjacentPos.x,
        y: adjacentPos.y,
        z: adjacentPos.z,
      },
    };
  } catch (error) {
    logger.error('getBlockPlayerIsLookingAt error:', error);
    return { success: false };
  }
}

/**
 * Describe what the PLAYER is currently looking at
 */
export function describePlayerTarget(bot: MinecraftBot): string {
  const result = getBlockPlayerIsLookingAt(bot);
  if (result.success && result.blockName) {
    return `Player is looking at ${result.blockName} at (${result.position?.x}, ${result.position?.y}, ${result.position?.z}), ${result.distance?.toFixed(1)} blocks away, facing ${result.face} side. Adjacent position: (${result.adjacentPosition?.x}, ${result.adjacentPosition?.y}, ${result.adjacentPosition?.z})`;
  }

  return "Player is not looking at any block (probably sky or too far away)";
}

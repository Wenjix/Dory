import { MinecraftBot } from '../bot/minecraft-bot';
import { hasItem, placeBlock } from './helpers';
import { getBlockPlayerIsLookingAt } from './vision';
import { createLogger } from '@dory/shared';

const logger = createLogger('player-building');

/**
 * Compute the starting block position adjacent to the face the player is looking at
 * This is the key logic from readyplayerx: use the hit block + face to determine
 * where to build.
 */
function getStartPosition(
  hitBlockPos: { x: number; y: number; z: number },
  face: string
): { x: number; y: number; z: number } {
  const start = { ...hitBlockPos };
  switch (face) {
    case 'top':    start.y = hitBlockPos.y + 1; break;
    case 'bottom': start.y = hitBlockPos.y - 1; break;
    case 'north':  start.z = hitBlockPos.z - 1; break;
    case 'south':  start.z = hitBlockPos.z + 1; break;
    case 'east':   start.x = hitBlockPos.x + 1; break;
    case 'west':   start.x = hitBlockPos.x - 1; break;
    default:       start.y = hitBlockPos.y + 1; break; // Fallback to top
  }
  return start;
}

/**
 * Place a block where the PLAYER is looking
 */
export async function placeBlockWherePlayerLooking(
  bot: MinecraftBot,
  blockType: string
): Promise<{ success: boolean; message: string }> {
  try {
    const lookResult = getBlockPlayerIsLookingAt(bot);
    if (!lookResult.success || !lookResult.position || !lookResult.face) {
      return {
        success: false,
        message: 'Player is not looking at any block',
      };
    }

    // Calculate placement position adjacent to the face
    const placePos = getStartPosition(lookResult.position, lookResult.face);

    logger.info(`Placing ${blockType} adjacent to ${lookResult.face} face of ${lookResult.blockName} at (${lookResult.position.x}, ${lookResult.position.y}, ${lookResult.position.z}) → (${placePos.x}, ${placePos.y}, ${placePos.z})`);

    const result = await placeBlock(bot, blockType, placePos.x, placePos.y, placePos.z);
    return result;
  } catch (error) {
    return {
      success: false,
      message: `Failed to place block: ${(error as Error).message}`,
    };
  }
}

/**
 * Build a pillar where the PLAYER is looking
 * Uses the hit block + face to determine start position, then builds upward
 */
export async function buildPillarWherePlayerLooking(
  bot: MinecraftBot,
  height: number,
  blockType: string
): Promise<{ success: boolean; message: string }> {
  try {
    const lookResult = getBlockPlayerIsLookingAt(bot);
    if (!lookResult.success || !lookResult.position || !lookResult.face) {
      return {
        success: false,
        message: 'Player is not looking at any block',
      };
    }

    // Check if bot has enough blocks
    const itemCheck = hasItem(bot, blockType, height);
    if (!itemCheck.hasItem) {
      return {
        success: false,
        message: `Need ${height}x ${blockType}, only have ${itemCheck.count}`,
      };
    }

    // Calculate start position adjacent to the face the player is looking at
    const startPos = getStartPosition(lookResult.position, lookResult.face);

    logger.info(`Building ${height}-high pillar at (${startPos.x}, ${startPos.y}, ${startPos.z}) adjacent to ${lookResult.face} face of block at (${lookResult.position.x}, ${lookResult.position.y}, ${lookResult.position.z})`);

    let blocksPlaced = 0;

    // Build upward from start position
    for (let i = 0; i < height; i++) {
      const result = await placeBlock(bot, blockType, startPos.x, startPos.y + i, startPos.z);

      if (result.success) {
        blocksPlaced++;
        await new Promise((resolve) => setTimeout(resolve, 300));
      } else {
        logger.warn(`Failed at height ${i}: ${result.message}`);
        break;
      }
    }

    if (blocksPlaced === 0) {
      return {
        success: false,
        message: `Failed to build pillar`,
      };
    }

    return {
      success: true,
      message: `Built pillar: ${blocksPlaced}/${height} blocks at (${startPos.x}, ${startPos.y}, ${startPos.z})`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to build pillar: ${(error as Error).message}`,
    };
  }
}

/**
 * Build a wall starting from where the PLAYER is looking
 * Uses face to determine start position, player yaw for wall orientation
 */
export async function buildWallWherePlayerLooking(
  bot: MinecraftBot,
  length: number,
  height: number,
  blockType: string
): Promise<{ success: boolean; message: string }> {
  try {
    const lookResult = getBlockPlayerIsLookingAt(bot);
    if (!lookResult.success || !lookResult.position || !lookResult.face) {
      return {
        success: false,
        message: 'Player is not looking at any block',
      };
    }

    const totalBlocks = length * height;

    // Check if bot has enough blocks
    const itemCheck = hasItem(bot, blockType, totalBlocks);
    if (!itemCheck.hasItem) {
      return {
        success: false,
        message: `Need ${totalBlocks}x ${blockType}, only have ${itemCheck.count}`,
      };
    }

    // Get nearest player for yaw (wall orientation)
    const players = Object.values(bot.bot.players).filter(
      (p) => p.entity && p.username !== bot.username
    );
    if (players.length === 0) {
      return { success: false, message: 'No player found' };
    }

    const yaw = players[0].entity!.yaw;

    // Calculate start position adjacent to the face
    const startPos = getStartPosition(lookResult.position, lookResult.face);

    // Determine wall extension direction (perpendicular to player's view)
    let dx = 0;
    let dz = 0;
    if (yaw >= -Math.PI / 4 && yaw < Math.PI / 4) {
      dx = 1; dz = 0;
    } else if (yaw >= Math.PI / 4 && yaw < (3 * Math.PI) / 4) {
      dx = 0; dz = 1;
    } else if (yaw >= -(3 * Math.PI) / 4 && yaw < -Math.PI / 4) {
      dx = 0; dz = -1;
    } else {
      dx = -1; dz = 0;
    }

    logger.info(`Building ${length}x${height} wall at (${startPos.x}, ${startPos.y}, ${startPos.z}), face: ${lookResult.face}, extend: dx=${dx}, dz=${dz}`);

    let blocksPlaced = 0;

    // Build wall row by row, bottom to top (like readyplayerx)
    for (let h = 0; h < height; h++) {
      for (let l = 0; l < length; l++) {
        const targetX = startPos.x + dx * l;
        const targetY = startPos.y + h;
        const targetZ = startPos.z + dz * l;

        const result = await placeBlock(bot, blockType, targetX, targetY, targetZ);

        if (result.success) {
          blocksPlaced++;
          await new Promise((resolve) => setTimeout(resolve, 300));
        } else {
          logger.warn(`Failed at (${targetX}, ${targetY}, ${targetZ}): ${result.message}`);
        }
      }
    }

    if (blocksPlaced === 0) {
      return {
        success: false,
        message: `Failed to build wall`,
      };
    }

    return {
      success: true,
      message: `Built wall: ${blocksPlaced}/${totalBlocks} blocks placed`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to build wall: ${(error as Error).message}`,
    };
  }
}

import { MinecraftBot } from '../bot/minecraft-bot';
import { placeBlock, hasItem } from './helpers';
import { createLogger } from '@dory/shared';

const logger = createLogger('building');

/**
 * Build a vertical pillar at the bot's current position
 * Simple approach like readyplayerx - just call placeBlock repeatedly
 */
export async function buildPillar(
  bot: MinecraftBot,
  height: number,
  blockType: string
): Promise<{ success: boolean; message: string }> {
  try {
    const startPos = bot.bot.entity.position;
    const x = Math.floor(startPos.x);
    const y = Math.floor(startPos.y);
    const z = Math.floor(startPos.z);

    // Check if bot has enough blocks
    const itemCheck = hasItem(bot, blockType, height);
    if (!itemCheck.hasItem) {
      return {
        success: false,
        message: `Need ${height}x ${blockType}, only have ${itemCheck.count}`,
      };
    }

    let blocksPlaced = 0;

    // Build upward (simple loop, like readyplayerx)
    for (let i = 1; i <= height; i++) {
      const result = await placeBlock(bot, blockType, x, y + i, z);
      
      if (result.success) {
        blocksPlaced++;
        // Small delay between placements
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
      message: `Built pillar: ${blocksPlaced}/${height} ${blockType} blocks`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to build pillar: ${(error as Error).message}`,
    };
  }
}

/**
 * Build a wall in front of the bot
 * Simple approach like readyplayerx - just call placeBlock repeatedly
 */
export async function buildWall(
  bot: MinecraftBot,
  length: number,
  height: number,
  blockType: string
): Promise<{ success: boolean; message: string }> {
  try {
    const startPos = bot.bot.entity.position;
    const x = Math.floor(startPos.x);
    const y = Math.floor(startPos.y);
    const z = Math.floor(startPos.z);

    const totalBlocks = length * height;

    // Check if bot has enough blocks
    const itemCheck = hasItem(bot, blockType, totalBlocks);
    if (!itemCheck.hasItem) {
      return {
        success: false,
        message: `Need ${totalBlocks}x ${blockType}, only have ${itemCheck.count}`,
      };
    }

    // Determine wall direction based on bot's yaw (perpendicular to view)
    const yaw = bot.bot.entity.yaw;
    let dx = 0;
    let dz = 0;

    if (yaw >= -Math.PI / 4 && yaw < Math.PI / 4) {
      dx = 1; // North, wall goes east-west
      dz = 0;
    } else if (yaw >= Math.PI / 4 && yaw < (3 * Math.PI) / 4) {
      dx = 0; // East, wall goes north-south
      dz = 1;
    } else if (yaw >= -(3 * Math.PI) / 4 && yaw < -Math.PI / 4) {
      dx = 0; // West, wall goes north-south
      dz = -1;
    } else {
      dx = -1; // South, wall goes east-west
      dz = 0;
    }

    let blocksPlaced = 0;

    // Build wall row by row, bottom to top (like readyplayerx)
    for (let h = 0; h < height; h++) {
      for (let l = 0; l < length; l++) {
        const targetX = x + dx * l;
        const targetY = y + 1 + h; // Start 1 block above bot
        const targetZ = z + dz * l;

        const result = await placeBlock(bot, blockType, targetX, targetY, targetZ);
        
        if (result.success) {
          blocksPlaced++;
          // Small delay between placements
          await new Promise((resolve) => setTimeout(resolve, 300));
        } else {
          logger.warn(`Failed at (${targetX}, ${targetY}, ${targetZ}): ${result.message}`);
          // Continue trying other blocks
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
      message: `Built wall: ${blocksPlaced}/${totalBlocks} ${blockType} blocks`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to build wall: ${(error as Error).message}`,
    };
  }
}

/**
 * Build a floor (horizontal platform) at the bot's current position
 * Simple approach like readyplayerx - just call placeBlock repeatedly
 */
export async function buildFloor(
  bot: MinecraftBot,
  width: number,
  length: number,
  blockType: string
): Promise<{ success: boolean; message: string }> {
  try {
    const startPos = bot.bot.entity.position;
    const x = Math.floor(startPos.x);
    const y = Math.floor(startPos.y);
    const z = Math.floor(startPos.z);

    const totalBlocks = width * length;

    // Check if bot has enough blocks
    const itemCheck = hasItem(bot, blockType, totalBlocks);
    if (!itemCheck.hasItem) {
      return {
        success: false,
        message: `Need ${totalBlocks}x ${blockType}, only have ${itemCheck.count}`,
      };
    }

    let blocksPlaced = 0;

    // Build floor (simple nested loop)
    for (let w = 0; w < width; w++) {
      for (let l = 0; l < length; l++) {
        const targetX = x + w;
        const targetY = y; // Same level as bot
        const targetZ = z + l;

        const result = await placeBlock(bot, blockType, targetX, targetY, targetZ);
        
        if (result.success) {
          blocksPlaced++;
          // Small delay
          await new Promise((resolve) => setTimeout(resolve, 300));
        } else {
          logger.warn(`Failed at (${targetX}, ${targetY}, ${targetZ}): ${result.message}`);
        }
      }
    }

    if (blocksPlaced === 0) {
      return {
        success: false,
        message: `Failed to build floor`,
      };
    }

    return {
      success: true,
      message: `Built floor: ${blocksPlaced}/${totalBlocks} ${blockType} blocks`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to build floor: ${(error as Error).message}`,
    };
  }
}

/**
 * Build a roof (horizontal platform) above the bot
 * Simple approach like readyplayerx - just call placeBlock repeatedly
 */
export async function buildRoof(
  bot: MinecraftBot,
  width: number,
  length: number,
  heightAbove: number,
  blockType: string
): Promise<{ success: boolean; message: string }> {
  try {
    const startPos = bot.bot.entity.position;
    const x = Math.floor(startPos.x);
    const y = Math.floor(startPos.y);
    const z = Math.floor(startPos.z);

    const totalBlocks = width * length;

    // Check if bot has enough blocks
    const itemCheck = hasItem(bot, blockType, totalBlocks);
    if (!itemCheck.hasItem) {
      return {
        success: false,
        message: `Need ${totalBlocks}x ${blockType}, only have ${itemCheck.count}`,
      };
    }

    let blocksPlaced = 0;

    // Build roof at specified height above bot
    for (let w = 0; w < width; w++) {
      for (let l = 0; l < length; l++) {
        const targetX = x + w;
        const targetY = y + heightAbove;
        const targetZ = z + l;

        const result = await placeBlock(bot, blockType, targetX, targetY, targetZ);
        
        if (result.success) {
          blocksPlaced++;
          // Small delay
          await new Promise((resolve) => setTimeout(resolve, 300));
        } else {
          logger.warn(`Failed at (${targetX}, ${targetY}, ${targetZ}): ${result.message}`);
        }
      }
    }

    if (blocksPlaced === 0) {
      return {
        success: false,
        message: `Failed to build roof`,
      };
    }

    return {
      success: true,
      message: `Built roof: ${blocksPlaced}/${totalBlocks} ${blockType} blocks at height ${heightAbove}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to build roof: ${(error as Error).message}`,
    };
  }
}

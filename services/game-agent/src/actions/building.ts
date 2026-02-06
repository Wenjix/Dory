import { Vec3 } from 'vec3';
import { MinecraftBot } from '../bot/minecraft-bot';
import { equipItem, placeBlock, hasItem } from './helpers';
import { createLogger } from '@dory/shared';

const logger = createLogger('building');

/**
 * Build a vertical pillar at the bot's current position
 */
export async function buildPillar(
  bot: MinecraftBot,
  height: number,
  blockType: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Check if bot has enough blocks
    const itemCheck = hasItem(bot, blockType, height);
    if (!itemCheck.hasItem) {
      return {
        success: false,
        message: `Need ${height}x ${blockType}, only have ${itemCheck.count}`,
      };
    }

    // Equip the block
    const equipped = await equipItem(bot, blockType);
    if (!equipped) {
      return { success: false, message: `Failed to equip ${blockType}` };
    }

    const startPos = bot.bot.entity.position.floored();
    let blocksPlaced = 0;

    // Build upward
    for (let i = 1; i <= height; i++) {
      const targetPos = startPos.offset(0, i, 0);
      const targetBlock = bot.bot.blockAt(targetPos);

      // Skip if block already exists
      if (targetBlock && targetBlock.name !== 'air') {
        continue;
      }

      // Find reference block (block below target)
      const referenceBlock = bot.bot.blockAt(targetPos.offset(0, -1, 0));
      if (!referenceBlock || referenceBlock.name === 'air') {
        return {
          success: false,
          message: `No block to place against at height ${i}`,
        };
      }

      // Place the block
      try {
        await bot.bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
        blocksPlaced++;
      } catch (error) {
        logger.error(`Failed to place block at height ${i}:`, error);
        break;
      }

      // Small delay between placements
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      success: blocksPlaced > 0,
      message: `Built pillar: ${blocksPlaced}/${height} blocks placed`,
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
 */
export async function buildWall(
  bot: MinecraftBot,
  length: number,
  height: number,
  blockType: string
): Promise<{ success: boolean; message: string }> {
  try {
    const totalBlocks = length * height;

    // Check if bot has enough blocks
    const itemCheck = hasItem(bot, blockType, totalBlocks);
    if (!itemCheck.hasItem) {
      return {
        success: false,
        message: `Need ${totalBlocks}x ${blockType}, only have ${itemCheck.count}`,
      };
    }

    // Equip the block
    const equipped = await equipItem(bot, blockType);
    if (!equipped) {
      return { success: false, message: `Failed to equip ${blockType}` };
    }

    // Determine wall direction based on bot's yaw
    const yaw = bot.bot.entity.yaw;
    let dx = 0;
    let dz = 0;

    // Convert yaw to direction (simplified to 4 cardinal directions)
    if (yaw >= -Math.PI / 4 && yaw < Math.PI / 4) {
      // North (-Z)
      dx = 1;
      dz = 0;
    } else if (yaw >= Math.PI / 4 && yaw < (3 * Math.PI) / 4) {
      // East (+X)
      dx = 0;
      dz = 1;
    } else if (yaw >= -(3 * Math.PI) / 4 && yaw < -Math.PI / 4) {
      // West (-X)
      dx = 0;
      dz = -1;
    } else {
      // South (+Z)
      dx = -1;
      dz = 0;
    }

    const startPos = bot.bot.entity.position.floored();
    let blocksPlaced = 0;

    // Build wall layer by layer
    for (let y = 1; y <= height; y++) {
      for (let x = 0; x < length; x++) {
        const targetPos = startPos.offset(dx * x, y, dz * x);
        const targetBlock = bot.bot.blockAt(targetPos);

        // Skip if block already exists
        if (targetBlock && targetBlock.name !== 'air') {
          continue;
        }

        // Find reference block
        const referenceBlock = bot.bot.blockAt(targetPos.offset(0, -1, 0));
        if (!referenceBlock || referenceBlock.name === 'air') {
          logger.warn(`No reference block at (${targetPos.x}, ${targetPos.y - 1}, ${targetPos.z})`);
          continue;
        }

        // Place the block
        try {
          await bot.bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
          blocksPlaced++;
        } catch (error) {
          logger.error(`Failed to place block at (${targetPos.x}, ${targetPos.y}, ${targetPos.z}):`, error);
        }

        // Small delay
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return {
      success: blocksPlaced > 0,
      message: `Built wall: ${blocksPlaced}/${totalBlocks} blocks placed`,
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
 */
export async function buildFloor(
  bot: MinecraftBot,
  width: number,
  length: number,
  blockType: string
): Promise<{ success: boolean; message: string }> {
  try {
    const totalBlocks = width * length;

    // Check if bot has enough blocks
    const itemCheck = hasItem(bot, blockType, totalBlocks);
    if (!itemCheck.hasItem) {
      return {
        success: false,
        message: `Need ${totalBlocks}x ${blockType}, only have ${itemCheck.count}`,
      };
    }

    // Equip the block
    const equipped = await equipItem(bot, blockType);
    if (!equipped) {
      return { success: false, message: `Failed to equip ${blockType}` };
    }

    const startPos = bot.bot.entity.position.floored();
    let blocksPlaced = 0;

    // Build floor
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < length; z++) {
        const targetPos = startPos.offset(x, 0, z);
        const targetBlock = bot.bot.blockAt(targetPos);

        // Skip if block already exists
        if (targetBlock && targetBlock.name !== 'air') {
          continue;
        }

        // Find reference block (block below)
        const referenceBlock = bot.bot.blockAt(targetPos.offset(0, -1, 0));
        if (!referenceBlock || referenceBlock.name === 'air') {
          logger.warn(`No reference block at (${targetPos.x}, ${targetPos.y - 1}, ${targetPos.z})`);
          continue;
        }

        // Place the block
        try {
          await bot.bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
          blocksPlaced++;
        } catch (error) {
          logger.error(`Failed to place block at (${targetPos.x}, ${targetPos.y}, ${targetPos.z}):`, error);
        }

        // Small delay
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return {
      success: blocksPlaced > 0,
      message: `Built floor: ${blocksPlaced}/${totalBlocks} blocks placed`,
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
 */
export async function buildRoof(
  bot: MinecraftBot,
  width: number,
  length: number,
  height: number,
  blockType: string
): Promise<{ success: boolean; message: string }> {
  try {
    const totalBlocks = width * length;

    // Check if bot has enough blocks
    const itemCheck = hasItem(bot, blockType, totalBlocks);
    if (!itemCheck.hasItem) {
      return {
        success: false,
        message: `Need ${totalBlocks}x ${blockType}, only have ${itemCheck.count}`,
      };
    }

    // Equip the block
    const equipped = await equipItem(bot, blockType);
    if (!equipped) {
      return { success: false, message: `Failed to equip ${blockType}` };
    }

    const startPos = bot.bot.entity.position.floored();
    let blocksPlaced = 0;

    // Build roof at specified height
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < length; z++) {
        const targetPos = startPos.offset(x, height, z);
        const targetBlock = bot.bot.blockAt(targetPos);

        // Skip if block already exists
        if (targetBlock && targetBlock.name !== 'air') {
          continue;
        }

        // Find reference block (block below target)
        const referenceBlock = bot.bot.blockAt(targetPos.offset(0, -1, 0));
        if (!referenceBlock || referenceBlock.name === 'air') {
          logger.warn(`No reference block at (${targetPos.x}, ${targetPos.y - 1}, ${targetPos.z})`);
          continue;
        }

        // Place the block
        try {
          await bot.bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
          blocksPlaced++;
        } catch (error) {
          logger.error(`Failed to place block at (${targetPos.x}, ${targetPos.y}, ${targetPos.z}):`, error);
        }

        // Small delay
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return {
      success: blocksPlaced > 0,
      message: `Built roof: ${blocksPlaced}/${totalBlocks} blocks placed at height ${height}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to build roof: ${(error as Error).message}`,
    };
  }
}

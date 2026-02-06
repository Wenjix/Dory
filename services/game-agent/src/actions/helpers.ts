import { Vec3 } from 'vec3';
import { goals } from 'mineflayer-pathfinder';
import { MinecraftBot } from '../bot/minecraft-bot';
import { Block } from 'prismarine-block';
import { createLogger } from '@dory/shared';

const logger = createLogger('action-helpers');

/**
 * Navigate to a specific position
 */
export async function goToPosition(
  bot: MinecraftBot,
  x: number,
  y: number,
  z: number,
  minDistance: number = 2
): Promise<boolean> {
  try {
    const goal = new goals.GoalNear(x, y, z, minDistance);
    bot.bot.pathfinder.setGoal(goal);

    return new Promise((resolve) => {
      const onGoalReached = () => {
        cleanup();
        bot.stop();
        resolve(true);
      };

      const onPathUpdate = (results: any) => {
        if (results.status === 'noPath') {
          cleanup();
          bot.stop();
          resolve(false);
        }
      };

      const cleanup = () => {
        bot.bot.pathfinder.removeListener('goal_reached', onGoalReached);
        bot.bot.pathfinder.removeListener('path_update', onPathUpdate);
      };

      bot.bot.pathfinder.on('goal_reached', onGoalReached);
      bot.bot.pathfinder.on('path_update', onPathUpdate);

      // Timeout after 60 seconds
      setTimeout(() => {
        cleanup();
        bot.stop();
        resolve(false);
      }, 60000);
    });
  } catch (error) {
    logger.error('goToPosition error:', error);
    await bot.stop();
    return false;
  }
}

/**
 * Equip an item from inventory
 */
export async function equipItem(bot: MinecraftBot, itemName: string): Promise<boolean> {
  try {
    const item = bot.bot.inventory.items().find((i) => i.name === itemName);
    if (!item) {
      return false;
    }

    // Determine destination slot based on item type
    let destination: 'hand' | 'head' | 'torso' | 'legs' | 'feet' | 'off-hand' = 'hand';
    
    if (itemName.includes('helmet')) destination = 'head';
    else if (itemName.includes('chestplate')) destination = 'torso';
    else if (itemName.includes('leggings')) destination = 'legs';
    else if (itemName.includes('boots')) destination = 'feet';

    await bot.bot.equip(item, destination);
    return true;
  } catch (error) {
    logger.error('equipItem error:', error);
    return false;
  }
}

/**
 * Find nearest block of a specific type
 */
export function findNearestBlock(
  bot: MinecraftBot,
  blockType: string,
  maxDistance: number = 64
): Block | null {
  if (!bot.mcData) return null;

  const blockId = bot.mcData.blocksByName[blockType]?.id;
  if (!blockId) return null;

  const positions = bot.bot.findBlocks({
    matching: blockId,
    maxDistance,
    count: 1,
  });

  if (positions.length === 0) return null;

  return bot.bot.blockAt(positions[0]);
}

/**
 * Craft an item
 */
export async function craftItem(
  bot: MinecraftBot,
  itemName: string,
  count: number = 1
): Promise<{ success: boolean; message: string }> {
  try {
    if (!bot.mcData) {
      return { success: false, message: 'Minecraft data not loaded' };
    }

    const itemId = bot.mcData.itemsByName[itemName]?.id;
    if (!itemId) {
      return { success: false, message: `Unknown item: ${itemName}` };
    }

    // Find crafting table if needed
    const recipe = bot.bot.recipesFor(itemId, null, 1, null)[0];
    if (!recipe) {
      return { success: false, message: `No recipe found for ${itemName}` };
    }

    // Check if we need a crafting table
    if (recipe.requiresTable) {
      const craftingTable = findNearestBlock(bot, 'crafting_table', 32);
      if (!craftingTable) {
        return { success: false, message: 'Crafting table required but not found nearby' };
      }

      // Go to crafting table
      await goToPosition(
        bot,
        craftingTable.position.x,
        craftingTable.position.y,
        craftingTable.position.z,
        3
      );
    }

    // Craft the item
    await bot.bot.craft(recipe, count, null);
    return { success: true, message: `Crafted ${count}x ${itemName}` };
  } catch (error) {
    return { success: false, message: `Failed to craft: ${(error as Error).message}` };
  }
}

/**
 * Place a block at specific coordinates
 */
export async function placeBlock(
  bot: MinecraftBot,
  itemName: string,
  x: number,
  y: number,
  z: number
): Promise<{ success: boolean; message: string }> {
  try {
    // Equip the block
    const equipped = await equipItem(bot, itemName);
    if (!equipped) {
      return { success: false, message: `Don't have ${itemName} in inventory` };
    }

    // Get the block at target position
    const targetBlock = bot.bot.blockAt(new Vec3(x, y, z));
    if (!targetBlock || targetBlock.name === 'air') {
      // Find a reference block to place against
      const referenceBlock = bot.bot.blockAt(new Vec3(x, y - 1, z));
      if (!referenceBlock || referenceBlock.name === 'air') {
        return { success: false, message: 'No block to place against' };
      }

      // Go near the position
      await goToPosition(bot, x, y, z, 4);

      // Place the block
      await bot.bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
      return { success: true, message: `Placed ${itemName} at (${x}, ${y}, ${z})` };
    }

    return { success: false, message: 'Position is not empty' };
  } catch (error) {
    return { success: false, message: `Failed to place block: ${(error as Error).message}` };
  }
}

/**
 * Break a block at specific coordinates
 */
export async function breakBlock(
  bot: MinecraftBot,
  x: number,
  y: number,
  z: number
): Promise<{ success: boolean; message: string }> {
  try {
    const block = bot.bot.blockAt(new Vec3(x, y, z));
    if (!block || block.name === 'air') {
      return { success: false, message: 'No block at that position' };
    }

    // Go near the block
    await goToPosition(bot, x, y, z, 4);

    // Dig the block
    await bot.bot.dig(block);
    return { success: true, message: `Broke ${block.name}` };
  } catch (error) {
    return { success: false, message: `Failed to break block: ${(error as Error).message}` };
  }
}

/**
 * Store items in a nearby chest
 */
export async function storeItemInChest(
  bot: MinecraftBot,
  itemName: string,
  count: number = -1
): Promise<{ success: boolean; message: string }> {
  try {
    // Find nearest chest
    const chest = findNearestBlock(bot, 'chest', 32);
    if (!chest) {
      return { success: false, message: 'No chest found nearby' };
    }

    // Go to chest
    await goToPosition(bot, chest.position.x, chest.position.y, chest.position.z, 3);

    // Find items in inventory
    const items = bot.bot.inventory.items().filter((i) => i.name === itemName);
    if (items.length === 0) {
      return { success: false, message: `No ${itemName} in inventory` };
    }

    // Open chest
    const chestBlock = await bot.bot.openContainer(chest);

    // Deposit items
    let deposited = 0;
    for (const item of items) {
      const depositCount = count === -1 ? item.count : Math.min(item.count, count - deposited);
      await chestBlock.deposit(item.type, null, depositCount);
      deposited += depositCount;
      if (count !== -1 && deposited >= count) break;
    }

    chestBlock.close();
    return { success: true, message: `Stored ${deposited}x ${itemName} in chest` };
  } catch (error) {
    return { success: false, message: `Failed to store in chest: ${(error as Error).message}` };
  }
}

/**
 * Get items from a nearby chest
 */
export async function getItemFromChest(
  bot: MinecraftBot,
  itemName: string,
  count: number = -1
): Promise<{ success: boolean; message: string }> {
  try {
    // Find nearest chest
    const chest = findNearestBlock(bot, 'chest', 32);
    if (!chest) {
      return { success: false, message: 'No chest found nearby' };
    }

    // Go to chest
    await goToPosition(bot, chest.position.x, chest.position.y, chest.position.z, 3);

    // Open chest
    const chestBlock = await bot.bot.openContainer(chest);

    // Find items in chest
    if (!bot.mcData) {
      return { success: false, message: 'Minecraft data not loaded' };
    }

    const itemId = bot.mcData.itemsByName[itemName]?.id;
    if (!itemId) {
      return { success: false, message: `Unknown item: ${itemName}` };
    }

    const items = chestBlock.containerItems().filter((i) => i.type === itemId);
    if (items.length === 0) {
      chestBlock.close();
      return { success: false, message: `No ${itemName} in chest` };
    }

    // Withdraw items
    let withdrawn = 0;
    for (const item of items) {
      const withdrawCount = count === -1 ? item.count : Math.min(item.count, count - withdrawn);
      await chestBlock.withdraw(item.type, null, withdrawCount);
      withdrawn += withdrawCount;
      if (count !== -1 && withdrawn >= count) break;
    }

    chestBlock.close();
    return { success: true, message: `Retrieved ${withdrawn}x ${itemName} from chest` };
  } catch (error) {
    return { success: false, message: `Failed to get from chest: ${(error as Error).message}` };
  }
}

/**
 * Eat food from inventory
 */
export async function eatFood(bot: MinecraftBot): Promise<{ success: boolean; message: string }> {
  try {
    // Find food in inventory
    const food = bot.bot.inventory.items().find((item) => {
      // Check if item is food (has foodPoints property)
      return bot.mcData?.foodsByName[item.name] !== undefined;
    });

    if (!food) {
      return { success: false, message: 'No food in inventory' };
    }

    // Equip and eat
    await bot.bot.equip(food, 'hand');
    await bot.bot.consume();

    return { success: true, message: `Ate ${food.name}` };
  } catch (error) {
    return { success: false, message: `Failed to eat: ${(error as Error).message}` };
  }
}

/**
 * Check if bot has a specific item
 */
export function hasItem(
  bot: MinecraftBot,
  itemName: string,
  count: number = 1
): { success: boolean; hasItem: boolean; count: number; message: string } {
  const items = bot.bot.inventory.items().filter((i) => i.name === itemName);
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);

  return {
    success: true,
    hasItem: totalCount >= count,
    count: totalCount,
    message: totalCount >= count 
      ? `Has ${totalCount}x ${itemName}` 
      : `Only has ${totalCount}x ${itemName}, needs ${count}`,
  };
}

/**
 * List contents of a nearby chest
 */
export async function listChestContents(
  bot: MinecraftBot
): Promise<{ success: boolean; message: string; contents?: string }> {
  try {
    // Find nearest chest
    const chest = findNearestBlock(bot, 'chest', 32);
    if (!chest) {
      return { success: false, message: 'No chest found nearby' };
    }

    // Go to chest
    await goToPosition(bot, chest.position.x, chest.position.y, chest.position.z, 3);

    // Open chest
    const chestBlock = await bot.bot.openContainer(chest);

    // List items
    const items = chestBlock.containerItems();
    if (items.length === 0) {
      chestBlock.close();
      return { success: true, message: 'Chest is empty', contents: '' };
    }

    const itemsList = items.map((i) => `${i.count}x ${i.name}`).join(', ');
    chestBlock.close();

    return {
      success: true,
      message: `Chest contains: ${itemsList}`,
      contents: itemsList,
    };
  } catch (error) {
    return { success: false, message: `Failed to list chest: ${(error as Error).message}` };
  }
}

/**
 * Tool Registry - Defines all available tools in OpenAI function-calling format.
 * 
 * This format is compatible with OpenAI, Mistral, and Claude (with minor adapters).
 * Each tool maps to an actual bot action from our actions/ folder.
 */

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  default?: number | string | boolean;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required: string[];
    };
  };
}

// ─── Movement Tools ───────────────────────────────────────────────────────────

const followPlayer: ToolDefinition = {
  type: 'function',
  function: {
    name: 'follow_player',
    description:
      'Start continuously following a player. The bot will keep following them until told to stop. If no username is given, follows the nearest player.',
    parameters: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'The username of the player to follow. If not provided, follows the nearest player.',
        },
      },
      required: [],
    },
  },
};

const comeToMe: ToolDefinition = {
  type: 'function',
  function: {
    name: 'come_to_me',
    description:
      'Go to the nearest player once (not continuously). Useful when a player says "come here".',
    parameters: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'The username of the player to go to. If not provided, goes to the nearest player.',
        },
      },
      required: [],
    },
  },
};

const goToPosition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'go_to_position',
    description: 'Navigate the bot to specific x, y, z coordinates.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
        z: { type: 'number', description: 'Z coordinate' },
      },
      required: ['x', 'y', 'z'],
    },
  },
};

const stopAction: ToolDefinition = {
  type: 'function',
  function: {
    name: 'stop',
    description:
      'Stop all current actions: pathfinding, following, mining, building, etc. Use when the player says "stop", "cancel", or "nevermind".',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// ─── Collection & Mining Tools ────────────────────────────────────────────────

const collectResource: ToolDefinition = {
  type: 'function',
  function: {
    name: 'collect_resource',
    description:
      'Find and collect a specific type of block/resource nearby. The bot will walk to it, mine it, and pick it up.',
    parameters: {
      type: 'object',
      properties: {
        block_type: {
          type: 'string',
          description:
            'The Minecraft block name to collect (e.g. "oak_log", "cobblestone", "iron_ore", "diamond_ore")',
        },
        count: {
          type: 'number',
          description: 'How many to collect',
          minimum: 1,
          default: 1,
        },
      },
      required: ['block_type'],
    },
  },
};

const breakBlock: ToolDefinition = {
  type: 'function',
  function: {
    name: 'break_block',
    description: 'Break/mine a specific block at the given coordinates.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate of the block' },
        y: { type: 'number', description: 'Y coordinate of the block' },
        z: { type: 'number', description: 'Z coordinate of the block' },
      },
      required: ['x', 'y', 'z'],
    },
  },
};

// ─── Inventory & Crafting Tools ───────────────────────────────────────────────

const getInventory: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_inventory',
    description:
      'List all items currently in the bot\'s inventory with quantities. Use this to check what the bot has before crafting or building.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const hasItem: ToolDefinition = {
  type: 'function',
  function: {
    name: 'has_item',
    description: 'Check if the bot has a specific item and how many.',
    parameters: {
      type: 'object',
      properties: {
        item_name: {
          type: 'string',
          description: 'The Minecraft item name to check for (e.g. "oak_planks", "iron_ingot")',
        },
        count: {
          type: 'number',
          description: 'Minimum count required (default: 1)',
          minimum: 1,
          default: 1,
        },
      },
      required: ['item_name'],
    },
  },
};

const equipItem: ToolDefinition = {
  type: 'function',
  function: {
    name: 'equip_item',
    description:
      'Equip an item from inventory into the appropriate slot (hand, armor, etc.).',
    parameters: {
      type: 'object',
      properties: {
        item_name: {
          type: 'string',
          description: 'The Minecraft item name to equip (e.g. "diamond_sword", "iron_pickaxe")',
        },
      },
      required: ['item_name'],
    },
  },
};

const craftItem: ToolDefinition = {
  type: 'function',
  function: {
    name: 'craft_item',
    description:
      'Craft an item using available recipes. The bot will find a crafting table if needed.',
    parameters: {
      type: 'object',
      properties: {
        item_name: {
          type: 'string',
          description: 'The Minecraft item name to craft (e.g. "crafting_table", "oak_planks", "stick")',
        },
        count: {
          type: 'number',
          description: 'How many to craft (default: 1)',
          minimum: 1,
          default: 1,
        },
      },
      required: ['item_name'],
    },
  },
};

const eatFood: ToolDefinition = {
  type: 'function',
  function: {
    name: 'eat_food',
    description: 'Eat food from inventory to restore hunger. Picks the first available food item.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// ─── Chest / Storage Tools ────────────────────────────────────────────────────

const storeInChest: ToolDefinition = {
  type: 'function',
  function: {
    name: 'store_in_chest',
    description: 'Store items from inventory into the nearest chest.',
    parameters: {
      type: 'object',
      properties: {
        item_name: {
          type: 'string',
          description: 'The item to store (e.g. "cobblestone", "oak_log")',
        },
        count: {
          type: 'number',
          description: 'How many to store. Use -1 for all.',
          default: -1,
        },
      },
      required: ['item_name'],
    },
  },
};

const getFromChest: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_from_chest',
    description: 'Retrieve items from the nearest chest into inventory.',
    parameters: {
      type: 'object',
      properties: {
        item_name: {
          type: 'string',
          description: 'The item to retrieve (e.g. "iron_ingot", "diamond")',
        },
        count: {
          type: 'number',
          description: 'How many to retrieve. Use -1 for all.',
          default: -1,
        },
      },
      required: ['item_name'],
    },
  },
};

const listChestContents: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_chest_contents',
    description: 'Open the nearest chest and list all its contents.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// ─── Building Tools (Bot Position) ────────────────────────────────────────────

const placeBlock: ToolDefinition = {
  type: 'function',
  function: {
    name: 'place_block',
    description: 'Place a single block at specific coordinates. The bot must have the block in inventory.',
    parameters: {
      type: 'object',
      properties: {
        block_type: {
          type: 'string',
          description: 'The block item name to place (e.g. "cobblestone", "oak_planks")',
        },
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
        z: { type: 'number', description: 'Z coordinate' },
      },
      required: ['block_type', 'x', 'y', 'z'],
    },
  },
};

const buildPillar: ToolDefinition = {
  type: 'function',
  function: {
    name: 'build_pillar',
    description: 'Build a vertical pillar at the bot\'s current position.',
    parameters: {
      type: 'object',
      properties: {
        height: {
          type: 'number',
          description: 'Height of the pillar in blocks',
          minimum: 1,
          maximum: 20,
        },
        block_type: {
          type: 'string',
          description: 'The block to build with (e.g. "cobblestone", "stone_bricks")',
        },
      },
      required: ['height', 'block_type'],
    },
  },
};

const buildWall: ToolDefinition = {
  type: 'function',
  function: {
    name: 'build_wall',
    description: 'Build a wall in front of the bot. The wall direction is determined by the bot\'s facing direction.',
    parameters: {
      type: 'object',
      properties: {
        length: {
          type: 'number',
          description: 'Width/length of the wall in blocks',
          minimum: 1,
          maximum: 30,
        },
        height: {
          type: 'number',
          description: 'Height of the wall in blocks',
          minimum: 1,
          maximum: 20,
        },
        block_type: {
          type: 'string',
          description: 'The block to build with (e.g. "cobblestone", "stone_bricks")',
        },
      },
      required: ['length', 'height', 'block_type'],
    },
  },
};

const buildFloor: ToolDefinition = {
  type: 'function',
  function: {
    name: 'build_floor',
    description: 'Build a horizontal floor/platform at the bot\'s current Y level.',
    parameters: {
      type: 'object',
      properties: {
        width: {
          type: 'number',
          description: 'Width of the floor in blocks',
          minimum: 1,
          maximum: 30,
        },
        length: {
          type: 'number',
          description: 'Length of the floor in blocks',
          minimum: 1,
          maximum: 30,
        },
        block_type: {
          type: 'string',
          description: 'The block to build with (e.g. "oak_planks", "stone")',
        },
      },
      required: ['width', 'length', 'block_type'],
    },
  },
};

// ─── Building Tools (Player POV) ──────────────────────────────────────────────

const placeBlockWherePlayerLooking: ToolDefinition = {
  type: 'function',
  function: {
    name: 'place_block_where_player_looking',
    description:
      'Place a single block at the position the player is currently looking at. Uses the player\'s point of view for intuitive placement.',
    parameters: {
      type: 'object',
      properties: {
        block_type: {
          type: 'string',
          description: 'The block to place (e.g. "cobblestone", "oak_planks")',
        },
      },
      required: ['block_type'],
    },
  },
};

const buildPillarWherePlayerLooking: ToolDefinition = {
  type: 'function',
  function: {
    name: 'build_pillar_where_player_looking',
    description:
      'Build a vertical pillar starting from where the player is looking. The pillar grows upward from the targeted face.',
    parameters: {
      type: 'object',
      properties: {
        height: {
          type: 'number',
          description: 'Height of the pillar in blocks',
          minimum: 1,
          maximum: 20,
        },
        block_type: {
          type: 'string',
          description: 'The block to build with (e.g. "cobblestone", "stone_bricks")',
        },
      },
      required: ['height', 'block_type'],
    },
  },
};

const buildWallWherePlayerLooking: ToolDefinition = {
  type: 'function',
  function: {
    name: 'build_wall_where_player_looking',
    description:
      'Build a wall starting from where the player is looking. Wall extends perpendicular to the player\'s view direction.',
    parameters: {
      type: 'object',
      properties: {
        length: {
          type: 'number',
          description: 'Width of the wall in blocks',
          minimum: 1,
          maximum: 30,
        },
        height: {
          type: 'number',
          description: 'Height of the wall in blocks',
          minimum: 1,
          maximum: 20,
        },
        block_type: {
          type: 'string',
          description: 'The block to build with (e.g. "cobblestone", "stone_bricks")',
        },
      },
      required: ['length', 'height', 'block_type'],
    },
  },
};

// ─── Vision & Information Tools ───────────────────────────────────────────────

const whatAmILookingAt: ToolDefinition = {
  type: 'function',
  function: {
    name: 'what_am_i_looking_at',
    description:
      'Describe what the bot is currently looking at (block or entity). Returns block name, position, and distance.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const whatIsPlayerLookingAt: ToolDefinition = {
  type: 'function',
  function: {
    name: 'what_is_player_looking_at',
    description:
      'Describe what the nearest player is looking at from their point of view. Returns block name, position, face, and distance.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const scanArea: ToolDefinition = {
  type: 'function',
  function: {
    name: 'scan_area',
    description:
      'Scan the area around the bot and list nearby blocks and entities with counts. Useful for understanding the environment.',
    parameters: {
      type: 'object',
      properties: {
        range: {
          type: 'number',
          description: 'Scan radius in blocks (default: 16)',
          minimum: 4,
          maximum: 32,
          default: 16,
        },
      },
      required: [],
    },
  },
};

const getPosition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_position',
    description: 'Get the bot\'s current position (x, y, z coordinates), health, and food level.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const getNearbyPlayers: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_nearby_players',
    description: 'List all players currently visible to the bot with their positions and distances.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const sendChat: ToolDefinition = {
  type: 'function',
  function: {
    name: 'send_chat',
    description: 'Send a message in the Minecraft in-game chat.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to send in game chat',
        },
      },
      required: ['message'],
    },
  },
};

// ─── Full Registry ────────────────────────────────────────────────────────────

/**
 * All available tools, grouped by category for readability.
 * The flat array is what gets sent to the LLM.
 */
export const TOOL_CATEGORIES = {
  movement: [followPlayer, comeToMe, goToPosition, stopAction],
  collection: [collectResource, breakBlock],
  inventory: [getInventory, hasItem, equipItem, craftItem, eatFood],
  storage: [storeInChest, getFromChest, listChestContents],
  building: [placeBlock, buildPillar, buildWall, buildFloor],
  playerBuilding: [
    placeBlockWherePlayerLooking,
    buildPillarWherePlayerLooking,
    buildWallWherePlayerLooking,
  ],
  vision: [whatAmILookingAt, whatIsPlayerLookingAt, scanArea],
  info: [getPosition, getNearbyPlayers, sendChat],
} as const;

/**
 * Flat array of all tool definitions - ready to send to the LLM
 */
export const ALL_TOOLS: ToolDefinition[] = Object.values(TOOL_CATEGORIES).flat();

/**
 * Get a tool definition by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find((t) => t.function.name === name);
}

/**
 * Get all tool names
 */
export function getToolNames(): string[] {
  return ALL_TOOLS.map((t) => t.function.name);
}

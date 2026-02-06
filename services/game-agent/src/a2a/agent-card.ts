/**
 * Game Agent - Agent Card
 *
 * Describes the game agent's capabilities for A2A discovery.
 * Served at /.well-known/agent-card.json
 */

export const GAME_AGENT_CARD = {
  name: 'Minecraft Gamer',
  description:
    'An AI agent that controls a Minecraft bot. Can move, collect resources, craft items, build structures, and interact with the game world.',
  url: '', // Set dynamically based on server URL
  version: '0.1.0',
  capabilities: {
    streaming: false,
    pushNotifications: false,
  },
  skills: [
    {
      id: 'session',
      name: 'Bot Management',
      description:
        'Connect a Minecraft bot to a server or disconnect it. Must connect a bot before any in-game actions can be performed.',
      examples: [
        'Connect to the Minecraft server',
        'Join the game',
        'Disconnect the bot',
        'Leave the server',
      ],
    },
    {
      id: 'movement',
      name: 'Movement & Navigation',
      description:
        'Follow the player, come to the player, go to specific coordinates, stop moving.',
      examples: [
        'Follow me',
        'Come here',
        'Go to position 100, 64, -200',
        'Stop',
      ],
    },
    {
      id: 'collection',
      name: 'Resource Collection',
      description:
        'Collect and mine blocks like wood, stone, ores, sand, etc. Finds nearest resources automatically.',
      examples: [
        'Collect some wood',
        'Mine 5 cobblestone',
        'Get some sand',
      ],
    },
    {
      id: 'crafting',
      name: 'Crafting & Items',
      description:
        'Craft items using collected resources, equip items, eat food, manage inventory.',
      examples: [
        'Craft a crafting table',
        'Make wooden planks',
        'Craft a stone pickaxe',
        'What do you have in your inventory?',
      ],
    },
    {
      id: 'building',
      name: 'Building & Construction',
      description:
        'Build walls, pillars, floors, and place blocks. Can build at bot position or where the player is looking.',
      examples: [
        'Build a 5-block tall pillar here',
        'Build a cobblestone wall where I am looking',
        'Place a block here',
      ],
    },
    {
      id: 'vision',
      name: 'Vision & Awareness',
      description:
        'Look around, scan nearby blocks, report what the bot or player is looking at, find nearby players.',
      examples: [
        'What do you see?',
        'What am I looking at?',
        'Scan the area',
        'Where are you?',
      ],
    },
    {
      id: 'storage',
      name: 'Chest & Storage',
      description:
        'Store items in chests, retrieve items from chests, list chest contents.',
      examples: [
        'Store wood in the chest',
        'What is in the chest?',
        'Get iron from the chest',
      ],
    },
  ],
};

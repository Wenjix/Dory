import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { BotManager } from './bot/bot-manager';
import { createLogger } from '@dory/shared';
import * as helpers from './actions/helpers';
import * as vision from './actions/vision';
import * as building from './actions/building';
import * as playerBuilding from './actions/player-building';
import { handleMessage } from './agent';
import { getLLMClient } from './llm';

const logger = createLogger('websocket');

interface WebSocketMessage {
  type: 'command' | 'subscribe' | 'unsubscribe';
  sessionId?: string;
  command?: string;
  args?: any[];
}

// Active WebSocket connections per session
const sessionConnections = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    logger.info('WebSocket client connected');

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        await handleWebSocketMessage(ws, message);
      } catch (error) {
        logger.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: (error as Error).message,
        }));
      }
    });

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
      // Remove from all sessions
      sessionConnections.forEach((connections) => {
        connections.delete(ws);
      });
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'info',
      message: 'Connected to Dory Game Agent WebSocket',
      availableCommands: [
        'ask <sessionId> <message...> - Send message to AI (reasoning + tools)',
        'follow <sessionId>',
        'stop <sessionId>',
        'goto <sessionId> <x> <y> <z>',
        'collect <sessionId> <blockType> <count>',
        'craft <sessionId> <itemName> <count>',
        'place <sessionId> <blockType> <x> <y> <z>',
        'break <sessionId> <x> <y> <z>',
        'pillar <sessionId> <height> <blockType>',
        'wall <sessionId> <length> <height> <blockType>',
        'looking <sessionId>',
        'playerlooking <sessionId>',
        'placehere <sessionId> <blockType>',
        'pillarhere <sessionId> <height> <blockType>',
        'wallhere <sessionId> <length> <height> <blockType>',
        'scan <sessionId> <range>',
        'inventory <sessionId>',
        'position <sessionId>',
        'help - Show this message',
      ],
    }));
  });

  logger.info('WebSocket server setup on /ws');
}

async function handleWebSocketMessage(ws: WebSocket, message: WebSocketMessage) {
  if (message.type === 'subscribe' && message.sessionId) {
    // Subscribe to session events
    if (!sessionConnections.has(message.sessionId)) {
      sessionConnections.set(message.sessionId, new Set());
    }
    sessionConnections.get(message.sessionId)!.add(ws);
    
    ws.send(JSON.stringify({
      type: 'success',
      message: `Subscribed to session ${message.sessionId}`,
    }));
    return;
  }

  if (message.type === 'unsubscribe' && message.sessionId) {
    const connections = sessionConnections.get(message.sessionId);
    if (connections) {
      connections.delete(ws);
    }
    
    ws.send(JSON.stringify({
      type: 'success',
      message: `Unsubscribed from session ${message.sessionId}`,
    }));
    return;
  }

  if (message.type === 'command' && message.command) {
    await executeCommand(ws, message.command, message.args || []);
    return;
  }

  ws.send(JSON.stringify({
    type: 'error',
    error: 'Invalid message format',
  }));
}

async function executeCommand(ws: WebSocket, command: string, args: any[]) {
  const [cmd, ...cmdArgs] = command.split(' ');
  const allArgs = [...cmdArgs, ...args];

  try {
    switch (cmd.toLowerCase()) {
      case 'help':
        ws.send(JSON.stringify({
          type: 'help',
          commands: {
            'ask <sessionId> <message...>': 'Send natural language message to AI (uses LLM + tools)',
            'follow <sessionId>': 'Follow the nearest player',
            'stop <sessionId>': 'Stop all current actions',
            'goto <sessionId> <x> <y> <z>': 'Navigate to coordinates',
            'collect <sessionId> <blockType> <count>': 'Collect blocks',
            'craft <sessionId> <itemName> <count>': 'Craft an item',
            'place <sessionId> <blockType> <x> <y> <z>': 'Place a block',
            'break <sessionId> <x> <y> <z>': 'Break a block',
            'pillar <sessionId> <height> <blockType>': 'Build a pillar at bot position',
            'wall <sessionId> <length> <height> <blockType>': 'Build a wall at bot position',
            'floor <sessionId> <width> <length> <blockType>': 'Build a floor at bot position',
            'looking <sessionId>': 'Describe what bot is looking at',
            'playerlooking <sessionId>': 'Describe what PLAYER is looking at',
            'placehere <sessionId> <blockType>': 'Place block where PLAYER is looking',
            'pillarhere <sessionId> <height> <blockType>': 'Build pillar where PLAYER is looking',
            'wallhere <sessionId> <length> <height> <blockType>': 'Build wall where PLAYER is looking',
            'scan <sessionId> <range>': 'Scan area for blocks and entities',
            'inventory <sessionId>': 'Show bot inventory',
            'position <sessionId>': 'Show bot position',
            'sessions': 'List all active sessions',
          },
        }));
        break;

      case 'sessions':
        const sessions = BotManager.getActiveSessions();
        ws.send(JSON.stringify({
          type: 'result',
          command: 'sessions',
          data: { sessions, count: sessions.length },
        }));
        break;

      case 'follow': {
        const sessionId = allArgs[0];
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const players = Object.keys(bot.players).filter(p => p !== bot.username);
        if (players.length === 0) {
          ws.send(JSON.stringify({ type: 'error', error: 'No players nearby' }));
          return;
        }

        await bot.followPlayer(players[0]);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'follow',
          data: { success: true, following: players[0] },
        }));
        break;
      }

      case 'stop': {
        const sessionId = allArgs[0];
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        await bot.stop();
        ws.send(JSON.stringify({
          type: 'result',
          command: 'stop',
          data: { success: true },
        }));
        break;
      }

      case 'goto': {
        const [sessionId, x, y, z] = allArgs;
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const result = await helpers.goToPosition(bot, Number(x), Number(y), Number(z));
        ws.send(JSON.stringify({
          type: 'result',
          command: 'goto',
          data: { success: result, position: { x, y, z } },
        }));
        break;
      }

      case 'collect': {
        const [sessionId, blockType, count] = allArgs;
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const result = await bot.collectBlock(blockType, Number(count) || 1);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'collect',
          data: result,
        }));
        break;
      }

      case 'craft': {
        const [sessionId, itemName, count] = allArgs;
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const result = await helpers.craftItem(bot, itemName, Number(count) || 1);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'craft',
          data: result,
        }));
        break;
      }

      case 'place': {
        const [sessionId, blockType, x, y, z] = allArgs;
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const result = await helpers.placeBlock(bot, blockType, Number(x), Number(y), Number(z));
        ws.send(JSON.stringify({
          type: 'result',
          command: 'place',
          data: result,
        }));
        break;
      }

      case 'break': {
        const [sessionId, x, y, z] = allArgs;
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const result = await helpers.breakBlock(bot, Number(x), Number(y), Number(z));
        ws.send(JSON.stringify({
          type: 'result',
          command: 'break',
          data: result,
        }));
        break;
      }

      case 'pillar': {
        const [sessionId, height, blockType] = allArgs;
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const result = await building.buildPillar(bot, Number(height), blockType);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'pillar',
          data: result,
        }));
        break;
      }

      case 'wall': {
        const [sessionId, length, height, blockType] = allArgs;
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const result = await building.buildWall(bot, Number(length), Number(height), blockType);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'wall',
          data: result,
        }));
        break;
      }

      case 'floor': {
        const [sessionId, width, length, blockType] = allArgs;
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const result = await building.buildFloor(bot, Number(width), Number(length), blockType);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'floor',
          data: result,
        }));
        break;
      }

      case 'looking': {
        const sessionId = allArgs[0];
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const description = vision.describeTarget(bot);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'looking',
          data: { description },
        }));
        break;
      }

      case 'playerlooking': {
        const sessionId = allArgs[0];
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const description = vision.describePlayerTarget(bot);
        const details = vision.getBlockPlayerIsLookingAt(bot);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'playerlooking',
          data: { description, details },
        }));
        break;
      }

      case 'placehere': {
        const [sessionId, blockType] = allArgs;
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const result = await playerBuilding.placeBlockWherePlayerLooking(bot, blockType);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'placehere',
          data: result,
        }));
        break;
      }

      case 'pillarhere': {
        const [sessionId, height, blockType] = allArgs;
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const result = await playerBuilding.buildPillarWherePlayerLooking(bot, Number(height), blockType);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'pillarhere',
          data: result,
        }));
        break;
      }

      case 'wallhere': {
        const [sessionId, length, height, blockType] = allArgs;
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const result = await playerBuilding.buildWallWherePlayerLooking(bot, Number(length), Number(height), blockType);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'wallhere',
          data: result,
        }));
        break;
      }

      case 'scan': {
        const [sessionId, range] = allArgs;
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const result = vision.scanArea(bot, Number(range) || 16);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'scan',
          data: result,
        }));
        break;
      }

      case 'inventory': {
        const sessionId = allArgs[0];
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const items = bot.bot.inventory.items().map(i => ({
          name: i.name,
          count: i.count,
          slot: i.slot,
        }));
        ws.send(JSON.stringify({
          type: 'result',
          command: 'inventory',
          data: { items, count: items.length },
        }));
        break;
      }

      case 'position': {
        const sessionId = allArgs[0];
        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const pos = bot.position;
        ws.send(JSON.stringify({
          type: 'result',
          command: 'position',
          data: {
            position: { x: pos.x, y: pos.y, z: pos.z },
            health: bot.health,
            food: bot.food,
          },
        }));
        break;
      }

      case 'ask':
      case 'msg':
      case 'say': {
        const sessionId = allArgs[0];
        const userMessage = allArgs.slice(1).join(' ');

        if (!userMessage) {
          ws.send(JSON.stringify({ type: 'error', error: 'Usage: ask <sessionId> <message...>' }));
          return;
        }

        const bot = BotManager.getBot(sessionId);
        if (!bot) {
          ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
          return;
        }

        const llm = getLLMClient();
        if (!llm) {
          ws.send(JSON.stringify({ type: 'error', error: 'LLM not configured. Set API keys in .env' }));
          return;
        }

        // Send "thinking" indicator
        ws.send(JSON.stringify({ type: 'info', message: `Thinking... (${llm.name}/${llm.model})` }));

        const result = await handleMessage(sessionId, bot, llm, userMessage);
        ws.send(JSON.stringify({
          type: 'result',
          command: 'ask',
          data: {
            response: result.response,
            toolsExecuted: result.toolsExecuted,
            llmCalls: result.llmCalls,
          },
        }));
        break;
      }

      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: `Unknown command: ${cmd}. Type "help" for available commands.`,
        }));
    }
  } catch (error) {
    logger.error('Command execution error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: (error as Error).message,
    }));
  }
}

// Broadcast function for game events
export function broadcastToSession(sessionId: string, event: any) {
  const connections = sessionConnections.get(sessionId);
  if (connections) {
    const message = JSON.stringify({
      type: 'event',
      sessionId,
      event,
    });
    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

/**
 * Minecraft Event Listener
 *
 * Hooks into raw mineflayer bot events and emits standardized GameEvents
 * through the event bus. This is the detection layer.
 */

import { createLogger } from '@dory/shared';
import { MinecraftBot } from '../bot/minecraft-bot';
import { gameEventBus } from './event-bus';
import type {
  MinecraftDamageEvent,
  MinecraftDeathEvent,
  MinecraftRespawnEvent,
  MinecraftChatEvent,
  MinecraftItemPickupEvent,
  MinecraftPlayerJoinedEvent,
  MinecraftPlayerLeftEvent,
  MinecraftEntitySpawnEvent,
  BotConnectedEvent,
  BotDisconnectedEvent,
} from './event-types';

const logger = createLogger('EventListener');

/** Track previous health to detect damage */
let previousHealth = 20;

/**
 * Set up all mineflayer event listeners for a bot session.
 * Call this once after the bot connects.
 */
export function setupMinecraftEventListeners(
  mcBot: MinecraftBot,
  sessionId: string
): void {
  const bot = mcBot.bot;
  logger.info(`Setting up event listeners for session ${sessionId}`);

  // ── System: bot connected ─────────────────────────────────────────────────
  bot.once('login', () => {
    previousHealth = 20;
    const ev: BotConnectedEvent = {
      type: 'system:bot_connected',
      source: 'system',
      sessionId,
      timestamp: new Date(),
      data: {
        server: (bot as any).options?.host || 'localhost',
        port: (bot as any).options?.port || 25565,
        username: bot.username,
      },
    };
    gameEventBus.emit(ev);
  });

  // ── System: bot disconnected ──────────────────────────────────────────────
  bot.on('end', () => {
    gameEventBus.emit({
      type: 'system:bot_disconnected',
      source: 'system',
      sessionId,
      timestamp: new Date(),
      data: { reason: 'Connection ended' },
    } as BotDisconnectedEvent);
  });

  bot.on('kicked', (reason: any) => {
    gameEventBus.emit({
      type: 'system:bot_disconnected',
      source: 'system',
      sessionId,
      timestamp: new Date(),
      data: { reason: typeof reason === 'string' ? reason : JSON.stringify(reason) },
    } as BotDisconnectedEvent);
  });

  // ── Health changes (damage detection) ─────────────────────────────────────
  bot.on('health', () => {
    const health = bot.health;
    const food = bot.food;

    if (health < previousHealth) {
      const damage = previousHealth - health;
      const ev: MinecraftDamageEvent = {
        type: 'minecraft:damage',
        source: 'minecraft',
        sessionId,
        timestamp: new Date(),
        data: { damage, health, food },
      };
      gameEventBus.emit(ev);
    }
    previousHealth = health;
  });

  // ── Death ─────────────────────────────────────────────────────────────────
  bot.on('death', () => {
    const pos = bot.entity?.position;
    gameEventBus.emit({
      type: 'minecraft:death',
      source: 'minecraft',
      sessionId,
      timestamp: new Date(),
      data: {
        position: pos ? { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) } : { x: 0, y: 0, z: 0 },
      },
    } as MinecraftDeathEvent);
  });

  // ── Respawn ───────────────────────────────────────────────────────────────
  bot.on('respawn', () => {
    previousHealth = 20;
    const pos = bot.entity?.position;
    gameEventBus.emit({
      type: 'minecraft:respawn',
      source: 'minecraft',
      sessionId,
      timestamp: new Date(),
      data: {
        position: pos ? { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) } : { x: 0, y: 0, z: 0 },
      },
    } as MinecraftRespawnEvent);
  });

  // ── Chat (from other players, not the bot itself) ─────────────────────────
  bot.on('chat', (username: string, message: string) => {
    if (username === bot.username) return;
    gameEventBus.emit({
      type: 'minecraft:chat',
      source: 'minecraft',
      sessionId,
      timestamp: new Date(),
      data: { username, message },
    } as MinecraftChatEvent);
  });

  // ── Player joined ─────────────────────────────────────────────────────────
  bot.on('playerJoined', (player: any) => {
    if (player.username === bot.username) return;
    gameEventBus.emit({
      type: 'minecraft:player_joined',
      source: 'minecraft',
      sessionId,
      timestamp: new Date(),
      data: { username: player.username || 'unknown' },
    } as MinecraftPlayerJoinedEvent);
  });

  // ── Player left ───────────────────────────────────────────────────────────
  bot.on('playerLeft', (player: any) => {
    gameEventBus.emit({
      type: 'minecraft:player_left',
      source: 'minecraft',
      sessionId,
      timestamp: new Date(),
      data: { username: player.username || 'unknown' },
    } as MinecraftPlayerLeftEvent);
  });

  // ── Hostile mob spawn nearby (within 16 blocks) ───────────────────────────
  const HOSTILE_MOBS = new Set([
    'zombie', 'skeleton', 'creeper', 'spider', 'enderman',
    'witch', 'phantom', 'drowned', 'husk', 'stray',
    'pillager', 'vindicator', 'ravager', 'blaze', 'ghast',
  ]);

  bot.on('entitySpawn', (entity: any) => {
    if (!entity.name || !HOSTILE_MOBS.has(entity.name)) return;
    const botPos = bot.entity?.position;
    const entPos = entity.position;
    if (!botPos || !entPos) return;

    const dist = botPos.distanceTo(entPos);
    if (dist > 16) return; // Only care about nearby hostiles

    gameEventBus.emit({
      type: 'minecraft:entity_spawn',
      source: 'minecraft',
      sessionId,
      timestamp: new Date(),
      data: {
        entity: { type: entity.name, name: entity.name },
        position: { x: Math.round(entPos.x), y: Math.round(entPos.y), z: Math.round(entPos.z) },
      },
    } as MinecraftEntitySpawnEvent);
  });

  logger.info(`Event listeners ready for session ${sessionId}`);
}

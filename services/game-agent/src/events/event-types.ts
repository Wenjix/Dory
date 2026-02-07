/**
 * Game Event Type Definitions
 *
 * All event types emitted by the game agent event system.
 * Sources: minecraft (raw mineflayer), custom (our code), system (lifecycle)
 */

export type EventSource = 'minecraft' | 'custom' | 'system';
export type EventPriority = 'critical' | 'high' | 'medium' | 'low';

// ── Base ──────────────────────────────────────────────────────────────────────

export interface BaseEvent {
  type: string;
  source: EventSource;
  sessionId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// ── Minecraft Events (raw mineflayer) ─────────────────────────────────────────

export interface MinecraftDamageEvent extends BaseEvent {
  type: 'minecraft:damage';
  source: 'minecraft';
  data: { damage: number; attacker?: string; health: number; food: number };
}

export interface MinecraftDeathEvent extends BaseEvent {
  type: 'minecraft:death';
  source: 'minecraft';
  data: { reason?: string; position: { x: number; y: number; z: number } };
}

export interface MinecraftRespawnEvent extends BaseEvent {
  type: 'minecraft:respawn';
  source: 'minecraft';
  data: { position: { x: number; y: number; z: number } };
}

export interface MinecraftChatEvent extends BaseEvent {
  type: 'minecraft:chat';
  source: 'minecraft';
  data: { username: string; message: string };
}

export interface MinecraftItemPickupEvent extends BaseEvent {
  type: 'minecraft:item_pickup';
  source: 'minecraft';
  data: { item: { name: string; count: number } };
}

export interface MinecraftPlayerJoinedEvent extends BaseEvent {
  type: 'minecraft:player_joined';
  source: 'minecraft';
  data: { username: string };
}

export interface MinecraftPlayerLeftEvent extends BaseEvent {
  type: 'minecraft:player_left';
  source: 'minecraft';
  data: { username: string };
}

export interface MinecraftEntitySpawnEvent extends BaseEvent {
  type: 'minecraft:entity_spawn';
  source: 'minecraft';
  data: {
    entity: { type: string; name?: string };
    position: { x: number; y: number; z: number };
  };
}

// ── Custom Events (emitted by our action code) ───────────────────────────────

export interface ResourceCollectedEvent extends BaseEvent {
  type: 'custom:resource_collected';
  source: 'custom';
  data: { blockType: string; amount: number; totalCollected: number };
}

export interface TaskCompletedEvent extends BaseEvent {
  type: 'custom:task_completed';
  source: 'custom';
  data: { taskName: string; success: boolean; message?: string; duration?: number };
}

export interface TaskFailedEvent extends BaseEvent {
  type: 'custom:task_failed';
  source: 'custom';
  data: { taskName: string; error: string; duration?: number };
}

export interface ItemCraftedEvent extends BaseEvent {
  type: 'custom:item_crafted';
  source: 'custom';
  data: { itemName: string; count: number };
}

export interface StructureBuiltEvent extends BaseEvent {
  type: 'custom:structure_built';
  source: 'custom';
  data: {
    structureType: 'wall' | 'pillar' | 'platform' | 'other';
    blockType: string;
    blocksPlaced: number;
  };
}

// ── System Events ─────────────────────────────────────────────────────────────

export interface BotConnectedEvent extends BaseEvent {
  type: 'system:bot_connected';
  source: 'system';
  data: { server: string; port: number; username: string };
}

export interface BotDisconnectedEvent extends BaseEvent {
  type: 'system:bot_disconnected';
  source: 'system';
  data: { reason?: string };
}

// ── Union Types ───────────────────────────────────────────────────────────────

export type MinecraftEvent =
  | MinecraftDamageEvent
  | MinecraftDeathEvent
  | MinecraftRespawnEvent
  | MinecraftChatEvent
  | MinecraftItemPickupEvent
  | MinecraftPlayerJoinedEvent
  | MinecraftPlayerLeftEvent
  | MinecraftEntitySpawnEvent;

export type CustomEvent =
  | ResourceCollectedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | ItemCraftedEvent
  | StructureBuiltEvent;

export type SystemEvent =
  | BotConnectedEvent
  | BotDisconnectedEvent;

export type GameEvent = MinecraftEvent | CustomEvent | SystemEvent;

// ── Handler / Filter types ────────────────────────────────────────────────────

export type EventHandler = (event: GameEvent) => void | Promise<void>;
export type EventFilter = (event: GameEvent) => boolean;

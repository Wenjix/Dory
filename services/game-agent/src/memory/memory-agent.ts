/**
 * Memory Agent
 *
 * Filters game events, converts them to typed Memory documents,
 * scores importance, and stores them in MongoDB.
 *
 * Adapted from readyplayerx — no embeddings, no associations.
 */

import type { GameEvent } from '../events/event-types.js';
import type { Memory, EpisodicMemory } from './types.js';
import { extractTextFromMemory } from './text-extractor.js';
import { getMemoriesCollection } from './database.js';
import { ObjectId } from 'mongodb';

// ---------------------------------------------------------------------------
// Filter — should this event become a memory?
// ---------------------------------------------------------------------------

export function shouldStoreMemory(
  event: GameEvent,
  context?: { conversationKeywords?: string[] }
): boolean {
  // Always store high-significance events
  if (
    event.type === 'minecraft:death' ||
    event.type === 'minecraft:inventory_change' ||
    event.type === 'custom:task_completed' ||
    event.type === 'custom:task_failed' ||
    event.type === 'custom:structure_built' ||
    event.type === 'custom:item_crafted'
  ) {
    return true;
  }

  // Chat from other players
  if (event.type === 'minecraft:chat') return true;

  // Player join (social context)
  if (event.type === 'minecraft:player_joined') return true;

  // User explicitly said something memorable
  if (context?.conversationKeywords) {
    const important = ['remember', 'important', 'always', 'never', 'prefer', 'like', 'dislike'];
    if (context.conversationKeywords.some((kw) => important.includes(kw.toLowerCase()))) {
      return true;
    }
  }

  // Resource collection is handled by the resource batcher — skip here
  if (event.type === 'custom:resource_collected') return false;

  // Everything else: skip
  return false;
}

// ---------------------------------------------------------------------------
// Importance scoring (0-1)
// ---------------------------------------------------------------------------

export function calculateImportance(event: GameEvent): number {
  switch (event.type) {
    case 'minecraft:death':
      return 0.9;
    case 'minecraft:inventory_change':
      return 0.8;
    case 'custom:task_failed':
      return 0.8;
    case 'custom:structure_built':
      return 0.8;
    case 'custom:task_completed':
      return 0.7;
    case 'custom:item_crafted':
      return 0.6;
    case 'custom:resource_collected':
      return 0.5;
    case 'minecraft:damage':
      return 0.5;
    case 'minecraft:chat':
      return 0.4;
    case 'minecraft:player_joined':
      return 0.3;
    default:
      return 0.3;
  }
}

// ---------------------------------------------------------------------------
// Encode — turn a GameEvent into a typed Memory document
// ---------------------------------------------------------------------------

export function encodeEventToMemory(
  event: GameEvent,
  userId: string,
  sessionId: string
): Memory | null {
  const importance = calculateImportance(event);
  const timestamp = event.timestamp || new Date();
  const tags = buildTags(event);

  switch (event.type) {
    // ── Deaths ──────────────────────────────────────────────────────────
    case 'minecraft:death': {
      const pos = event.data.position;
      const mem: EpisodicMemory = {
        sessionId,
        userId,
        type: 'episodic',
        timestamp,
        lastAccessed: timestamp,
        importance: 0.9,
        tags: [...tags, 'death', 'danger'],
        textContent: '',
        source: 'event',
        data: {
          event: 'death',
          description: `Bot died at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)})`,
          location: pos,
          outcome: 'failure',
          emotionalWeight: 0.9,
        },
      };
      mem.textContent = extractTextFromMemory(mem);
      return mem;
    }

    // ── Precious/important item gained ─────────────────────────────────
    case 'minecraft:inventory_change': {
      const item = event.data.item;
      const prev = event.data.previousItem;
      if (!item) return null;
      const gained = prev ? item.count - prev.count : item.count;
      const description =
        gained > 0
          ? `Received ${gained > 1 ? `${gained}x ` : ''}${item.name}`
          : `Inventory change: ${item.name} (${item.count})`;

      const mem: EpisodicMemory = {
        sessionId,
        userId,
        type: 'episodic',
        timestamp,
        lastAccessed: timestamp,
        importance: 0.8,
        tags: [...tags, 'inventory', 'precious', item.name],
        textContent: '',
        source: 'event',
        data: {
          event: 'precious_item_gained',
          description,
          outcome: 'success',
          emotionalWeight: 0.8,
        },
      };
      mem.textContent = extractTextFromMemory(mem);
      return mem;
    }

    // ── Task completed ──────────────────────────────────────────────────
    case 'custom:task_completed': {
      const mem: EpisodicMemory = {
        sessionId,
        userId,
        type: 'episodic',
        timestamp,
        lastAccessed: timestamp,
        importance,
        tags: [...tags, 'task', 'completion'],
        textContent: '',
        source: 'event',
        data: {
          event: 'task_completed',
          description: `Task "${event.data.taskName}" completed${event.data.message ? `: ${event.data.message}` : ''}`,
          outcome: event.data.success ? 'success' : 'failure',
          emotionalWeight: event.data.success ? 0.7 : 0.5,
        },
      };
      mem.textContent = extractTextFromMemory(mem);
      return mem;
    }

    // ── Task failed ─────────────────────────────────────────────────────
    case 'custom:task_failed': {
      const mem: EpisodicMemory = {
        sessionId,
        userId,
        type: 'episodic',
        timestamp,
        lastAccessed: timestamp,
        importance: 0.8,
        tags: [...tags, 'task', 'failure'],
        textContent: '',
        source: 'event',
        data: {
          event: 'task_failed',
          description: `Task "${event.data.taskName}" failed: ${event.data.error}`,
          outcome: 'failure',
          emotionalWeight: 0.6,
        },
      };
      mem.textContent = extractTextFromMemory(mem);
      return mem;
    }

    // ── Item crafted ────────────────────────────────────────────────────
    case 'custom:item_crafted': {
      const mem: EpisodicMemory = {
        sessionId,
        userId,
        type: 'episodic',
        timestamp,
        lastAccessed: timestamp,
        importance,
        tags: [...tags, 'crafting', 'item'],
        textContent: '',
        source: 'event',
        data: {
          event: 'item_crafted',
          description: `Crafted ${event.data.count}x ${event.data.itemName}`,
          outcome: 'success',
          emotionalWeight: 0.5,
        },
      };
      mem.textContent = extractTextFromMemory(mem);
      return mem;
    }

    // ── Structure built ─────────────────────────────────────────────────
    case 'custom:structure_built': {
      const mem: EpisodicMemory = {
        sessionId,
        userId,
        type: 'episodic',
        timestamp,
        lastAccessed: timestamp,
        importance: 0.8,
        tags: [...tags, 'building', 'construction', event.data.structureType],
        textContent: '',
        source: 'event',
        data: {
          event: 'structure_built',
          description: `Built a ${event.data.structureType} using ${event.data.blocksPlaced}x ${event.data.blockType}`,
          outcome: 'success',
          emotionalWeight: 0.6,
        },
      };
      mem.textContent = extractTextFromMemory(mem);
      return mem;
    }

    // ── Resource collected (usually batched, but encodable) ─────────────
    case 'custom:resource_collected': {
      const mem: EpisodicMemory = {
        sessionId,
        userId,
        type: 'episodic',
        timestamp,
        lastAccessed: timestamp,
        importance,
        tags: [...tags, 'resource', 'collection'],
        textContent: '',
        source: 'event',
        data: {
          event: 'resource_collected',
          description: `Collected ${event.data.amount}x ${event.data.blockType} (total: ${event.data.totalCollected})`,
          outcome: 'success',
          emotionalWeight: 0.3,
        },
      };
      mem.textContent = extractTextFromMemory(mem);
      return mem;
    }

    // ── Chat from another player ────────────────────────────────────────
    case 'minecraft:chat': {
      const mem: EpisodicMemory = {
        sessionId,
        userId,
        type: 'episodic',
        timestamp,
        lastAccessed: timestamp,
        importance: 0.4,
        tags: [...tags, 'social', 'chat'],
        textContent: '',
        source: 'event',
        data: {
          event: 'player_chat',
          description: `${event.data.username} said: "${event.data.message}"`,
          participants: [event.data.username],
          outcome: 'neutral',
          emotionalWeight: 0.3,
        },
      };
      mem.textContent = extractTextFromMemory(mem);
      return mem;
    }

    // ── Player joined ───────────────────────────────────────────────────
    case 'minecraft:player_joined': {
      const mem: EpisodicMemory = {
        sessionId,
        userId,
        type: 'episodic',
        timestamp,
        lastAccessed: timestamp,
        importance: 0.3,
        tags: [...tags, 'social', 'player'],
        textContent: '',
        source: 'event',
        data: {
          event: 'player_joined',
          description: `Player ${event.data.username} joined the game`,
          participants: [event.data.username],
          outcome: 'neutral',
          emotionalWeight: 0.2,
        },
      };
      mem.textContent = extractTextFromMemory(mem);
      return mem;
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Store a memory in MongoDB
// ---------------------------------------------------------------------------

export async function storeMemory(memory: Memory): Promise<ObjectId> {
  console.log(
    `[Memory Agent] Storing [${memory.type}]: ${memory.textContent.substring(0, 80)}...`
  );

  const collection = getMemoriesCollection();
  const result = await collection.insertOne(memory as any);

  console.log(
    `[Memory Agent] Stored ${result.insertedId} | importance=${memory.importance.toFixed(2)} | tags=[${memory.tags.join(', ')}]`
  );

  return result.insertedId;
}

// ---------------------------------------------------------------------------
// Top-level entry: process an event end-to-end
// ---------------------------------------------------------------------------

export async function processEvent(
  event: GameEvent,
  userId: string,
  sessionId: string,
  context?: { conversationKeywords?: string[] }
): Promise<ObjectId | null> {
  if (!shouldStoreMemory(event, context)) return null;

  console.log(`[Memory Agent] Event passed filter: ${event.type}`);

  const memory = encodeEventToMemory(event, userId, sessionId);
  if (!memory) {
    console.log(`[Memory Agent] No encoder for event type: ${event.type}`);
    return null;
  }

  console.log(
    `[Memory Agent] Encoded -> ${memory.type}: ${memory.textContent.substring(0, 60)}...`
  );

  return storeMemory(memory);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTags(event: GameEvent): string[] {
  const tags: string[] = [];
  const [source, name] = event.type.split(':');
  if (source) tags.push(source);
  if (name) tags.push(name);
  return tags;
}

/**
 * A2A Event Forwarder
 *
 * Listens to all events on the event bus and forwards them to the voice agent
 * with priority-based handling:
 *
 * - critical: Send immediately → voice agent interrupts and speaks
 * - high: Send immediately → voice agent injects at next turn
 * - medium: Batch → voice agent stores as context
 * - low: Batch → voice agent stores silently
 */

import { createLogger } from '@dory/shared';
import { gameEventBus } from './event-bus';
import type { GameEvent, EventPriority } from './event-types';

const logger = createLogger('A2AEventForwarder');

const VOICE_AGENT_URL = process.env.VOICE_AGENT_URL || 'http://localhost:4001';

// ── Priority Assignment ─────────────────────────────────────────────────────

interface FormattedEvent {
  message: string;
  priority: EventPriority;
}

/**
 * Assign priority and format a human-readable message for each event type
 */
function formatEvent(event: GameEvent): FormattedEvent | null {
  switch (event.type) {
    // ── CRITICAL ─────────────────────────────────────────────────────────
    case 'minecraft:death':
      return {
        priority: 'critical',
        message: `The bot died at (${event.data.position.x}, ${event.data.position.y}, ${event.data.position.z})!`,
      };

    case 'minecraft:damage': {
      const isLow = event.data.health <= 6;
      return {
        priority: isLow ? 'critical' : 'medium',
        message: `Bot took ${event.data.damage.toFixed(1)} damage! Health: ${event.data.health.toFixed(1)}/20${isLow ? ' — CRITICAL!' : ''}`,
      };
    }

    // ── HIGH ─────────────────────────────────────────────────────────────
    case 'custom:task_completed':
      return {
        priority: 'high',
        message: event.data.success
          ? `Task completed: ${event.data.taskName}${event.data.message ? ` — ${event.data.message}` : ''}`
          : `Task failed: ${event.data.taskName}${event.data.message ? ` — ${event.data.message}` : ''}`,
      };

    case 'custom:task_failed':
      return {
        priority: 'high',
        message: `Task failed: ${event.data.taskName} — ${event.data.error}`,
      };

    case 'custom:structure_built':
      return {
        priority: 'high',
        message: `Built a ${event.data.structureType} using ${event.data.blockType} (${event.data.blocksPlaced} blocks)`,
      };

    case 'system:bot_connected':
      return {
        priority: 'high',
        message: `Bot connected to ${event.data.server}:${event.data.port} as ${event.data.username}`,
      };

    case 'minecraft:inventory_change': {
      const item = event.data.item;
      if (!item) return null;
      const prev = event.data.previousItem;
      const gained = prev ? item.count - prev.count : item.count;
      return {
        priority: 'high',
        message: `Received a special item: ${gained > 1 ? `${gained}x ` : ''}${item.name}!`,
      };
    }

    // ── MEDIUM ───────────────────────────────────────────────────────────
    case 'minecraft:respawn':
      return {
        priority: 'medium',
        message: `Bot respawned at (${event.data.position.x}, ${event.data.position.y}, ${event.data.position.z})`,
      };

    case 'minecraft:chat':
      return {
        priority: 'medium',
        message: `In-game chat — ${event.data.username}: ${event.data.message}`,
      };

    case 'minecraft:player_joined':
      // Skip — arrives late and sounds unnatural ("oh X just joined" a minute later)
      return null;

    case 'custom:item_crafted':
      return {
        priority: 'medium',
        message: `Crafted ${event.data.count}x ${event.data.itemName}`,
      };

    case 'minecraft:entity_spawn':
      return {
        priority: 'medium',
        message: `Hostile mob nearby: ${event.data.entity.type} at (${event.data.position.x}, ${event.data.position.y}, ${event.data.position.z})`,
      };

    // ── LOW ──────────────────────────────────────────────────────────────
    case 'custom:resource_collected':
      return {
        priority: 'low',
        message: `Collected ${event.data.amount}x ${event.data.blockType} (total: ${event.data.totalCollected})`,
      };

    case 'minecraft:player_left':
      return {
        priority: 'low',
        message: `Player ${event.data.username} left the game`,
      };

    // Ignore
    case 'system:bot_disconnected':
    default:
      return null;
  }
}

// ── Resource Collection Batching ─────────────────────────────────────────────
// Aggregates resource_collected events by block type within a time window,
// then sends a single summary: "Collected 5x oak_log, 3x stone"

interface ResourceBatch {
  /** blockType → total amount collected */
  collected: Map<string, number>;
  timer: ReturnType<typeof setTimeout> | null;
  startTime: number;
}

const resourceBatches = new Map<string, ResourceBatch>();
const RESOURCE_BATCH_WINDOW_MS = 5_000; // 5-second window
const RESOURCE_BATCH_MAX_TYPES = 6;     // flush if too many distinct types

function queueResourceEvent(sessionId: string, blockType: string, amount: number): void {
  let batch = resourceBatches.get(sessionId);
  if (!batch) {
    batch = { collected: new Map(), timer: null, startTime: Date.now() };
    resourceBatches.set(sessionId, batch);
  }

  batch.collected.set(blockType, (batch.collected.get(blockType) || 0) + amount);

  // Flush if too many types
  if (batch.collected.size >= RESOURCE_BATCH_MAX_TYPES) {
    flushResourceBatch(sessionId);
    return;
  }

  // Start / reset timer
  if (batch.timer) clearTimeout(batch.timer);
  batch.timer = setTimeout(() => flushResourceBatch(sessionId), RESOURCE_BATCH_WINDOW_MS);
}

async function flushResourceBatch(sessionId: string): Promise<void> {
  const batch = resourceBatches.get(sessionId);
  if (!batch || batch.collected.size === 0) return;

  if (batch.timer) {
    clearTimeout(batch.timer);
    batch.timer = null;
  }

  // Build summary: "Collected 5x oak_log, 3x stone, 2x dirt"
  const parts: string[] = [];
  for (const [blockType, amount] of batch.collected) {
    parts.push(`${amount}x ${blockType}`);
  }
  const message = `Collected ${parts.join(', ')}`;
  const elapsed = ((Date.now() - batch.startTime) / 1000).toFixed(0);

  logger.info(`[RESOURCE BATCH] ${message} (over ${elapsed}s)`);
  batch.collected.clear();

  await sendToVoiceAgent(sessionId, 'low', message);
}

// ── Generic Batching (medium/low non-resource events) ───────────────────────

interface PendingBatch {
  events: FormattedEvent[];
  timer: ReturnType<typeof setTimeout> | null;
}

const pendingBatches = new Map<string, PendingBatch>();
const BATCH_INTERVAL_MS = 15_000; // Flush every 15s
const MAX_BATCH_SIZE = 5;

function queueBatchedEvent(sessionId: string, event: FormattedEvent): void {
  let batch = pendingBatches.get(sessionId);
  if (!batch) {
    batch = { events: [], timer: null };
    pendingBatches.set(sessionId, batch);
  }

  batch.events.push(event);

  if (batch.events.length >= MAX_BATCH_SIZE) {
    flushBatch(sessionId);
    return;
  }

  if (!batch.timer) {
    batch.timer = setTimeout(() => flushBatch(sessionId), BATCH_INTERVAL_MS);
  }
}

async function flushBatch(sessionId: string): Promise<void> {
  const batch = pendingBatches.get(sessionId);
  if (!batch || batch.events.length === 0) return;

  if (batch.timer) {
    clearTimeout(batch.timer);
    batch.timer = null;
  }

  const events = [...batch.events];
  batch.events = [];

  for (const ev of events) {
    await sendToVoiceAgent(sessionId, ev.priority, ev.message);
  }
}

// ── HTTP sender ─────────────────────────────────────────────────────────────

async function sendToVoiceAgent(
  sessionId: string,
  priority: EventPriority,
  message: string
): Promise<void> {
  try {
    const resp = await fetch(`${VOICE_AGENT_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, priority, message }),
    });

    if (!resp.ok) {
      logger.warn(`Voice agent returned ${resp.status} for event`);
    }
  } catch (err) {
    // Voice agent might not be running — that's fine, events are fire-and-forget
    logger.warn(`Failed to send event to voice agent: ${(err as Error).message}`);
  }
}

// ── Setup ───────────────────────────────────────────────────────────────────

/**
 * Register a wildcard handler on the event bus that forwards events
 * to the voice agent with priority-based handling.
 */
export function setupA2AEventForwarder(sessionId: string): void {
  logger.info(`Setting up A2A event forwarder for session ${sessionId}`);

  gameEventBus.on('*', async (event: GameEvent) => {
    if (event.sessionId !== sessionId) return;

    // Special handling: resource_collected goes through type-based aggregation
    if (event.type === 'custom:resource_collected') {
      queueResourceEvent(sessionId, event.data.blockType, event.data.amount);
      return;
    }

    const formatted = formatEvent(event);
    if (!formatted) return;

    const { priority, message } = formatted;

    if (priority === 'critical' || priority === 'high') {
      // Send immediately
      logger.info(`[${priority.toUpperCase()}] → voice-agent: ${message.substring(0, 80)}`);
      await sendToVoiceAgent(sessionId, priority, message);
    } else {
      // Queue for generic batching
      queueBatchedEvent(sessionId, formatted);
    }
  });
}

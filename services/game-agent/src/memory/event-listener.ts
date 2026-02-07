/**
 * Memory Event Listener
 *
 * Subscribes to the gameEventBus and routes events into the memory system:
 *   - resource_collected -> resource batcher (aggregated storage)
 *   - everything else   -> memory-agent (filter -> encode -> store)
 */

import { gameEventBus } from '../events/event-bus.js';
import type { GameEvent, ResourceCollectedEvent } from '../events/event-types.js';
import { processEvent } from './memory-agent.js';
import { initializeBatching, addToBatch, flushBatch } from './resource-batcher.js';

const NOISY = new Set(['minecraft:entity_spawn', 'minecraft:item_pickup']);

/**
 * Wire up the memory system for a session.
 * Call once after the bot logs in.
 */
export function setupMemoryEventListener(sessionId: string, userId: string): void {
  console.log(`[Memory Events] Setting up for session ${sessionId}, user ${userId}`);

  // Prepare resource batching
  initializeBatching(sessionId, userId);

  // Subscribe to all events on the bus
  gameEventBus.on('*', async (event: GameEvent) => {
    if (event.sessionId !== sessionId) return;

    if (!NOISY.has(event.type)) {
      console.log(`[Memory Events] Received: ${event.type}`);
    }

    try {
      // Resource events go through the batcher
      if (event.type === 'custom:resource_collected') {
        addToBatch(event as ResourceCollectedEvent, userId, sessionId);
        return;
      }

      // Everything else goes through the standard pipeline
      const memoryId = await processEvent(event, userId, sessionId);
      if (memoryId) {
        console.log(`[Memory Events] Created memory from ${event.type}: ${memoryId}`);
      }
    } catch (error) {
      console.error(`[Memory Events] Error processing ${event.type}:`, error);
    }
  });

  console.log(`[Memory Events] Listener active for session ${sessionId}`);
}

/**
 * Tear down memory listener for a session (flush pending batches).
 */
export async function removeMemoryEventListener(sessionId: string): Promise<void> {
  await flushBatch(sessionId);
  console.log(`[Memory Events] Cleaned up for session ${sessionId}`);
}

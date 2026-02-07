/**
 * Resource Collection Batcher
 *
 * Batches resource_collected events to avoid spamming the database
 * with one memory per block mined.
 *
 * Stores when:
 *   - 10+ total items accumulated, OR
 *   - 60 seconds since first event in batch
 * With 5-second debounce to coalesce rapid mining.
 */

import type { ResourceCollectedEvent } from '../events/event-types.js';
import { processEvent } from './memory-agent.js';
import { ObjectId } from 'mongodb';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BatchedResource {
  blockType: string;
  totalAmount: number;
  firstTimestamp: Date;
  lastTimestamp: Date;
}

interface SessionBatch {
  sessionId: string;
  userId: string;
  resources: Map<string, BatchedResource>; // key = blockType
  lastStored: Date;
  pendingTimeout: ReturnType<typeof setTimeout> | null;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const sessionBatches = new Map<string, SessionBatch>();

const BATCH_THRESHOLD = 10; // store after 10+ items
const BATCH_TIMEOUT_MS = 60_000; // or after 1 minute
const DEBOUNCE_MS = 5_000; // wait 5s before flushing

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initializeBatching(sessionId: string, userId: string): void {
  console.log(`[Resource Batcher] Initializing for session ${sessionId}`);
  sessionBatches.set(sessionId, {
    sessionId,
    userId,
    resources: new Map(),
    lastStored: new Date(0),
    pendingTimeout: null,
  });
}

export function addToBatch(
  event: ResourceCollectedEvent,
  userId: string,
  sessionId: string
): void {
  let batch = sessionBatches.get(sessionId);
  if (!batch) {
    initializeBatching(sessionId, userId);
    batch = sessionBatches.get(sessionId)!;
  }

  const { blockType, amount } = event.data;
  const timestamp = event.timestamp || new Date();

  let entry = batch.resources.get(blockType);
  if (!entry) {
    entry = {
      blockType,
      totalAmount: 0,
      firstTimestamp: timestamp,
      lastTimestamp: timestamp,
    };
    batch.resources.set(blockType, entry);
  }

  entry.totalAmount += amount;
  entry.lastTimestamp = timestamp;

  // Check flush conditions
  const totalItems = [...batch.resources.values()].reduce((s, r) => s + r.totalAmount, 0);
  const elapsed = Date.now() - entry.firstTimestamp.getTime();

  if (totalItems >= BATCH_THRESHOLD || elapsed >= BATCH_TIMEOUT_MS) {
    const sinceLast = Date.now() - batch.lastStored.getTime();
    if (sinceLast < DEBOUNCE_MS && elapsed < BATCH_TIMEOUT_MS) {
      // Debounce — schedule for later
      if (batch.pendingTimeout) clearTimeout(batch.pendingTimeout);
      batch.pendingTimeout = setTimeout(() => storeBatch(sessionId), DEBOUNCE_MS - sinceLast);
    } else {
      storeBatch(sessionId);
    }
  }
}

export async function flushBatch(sessionId: string): Promise<void> {
  const batch = sessionBatches.get(sessionId);
  if (!batch) return;

  if (batch.resources.size > 0) {
    console.log(`[Resource Batcher] Flushing batch for session ${sessionId}`);
    await storeBatch(sessionId);
  }

  if (batch.pendingTimeout) clearTimeout(batch.pendingTimeout);
  sessionBatches.delete(sessionId);
  console.log(`[Resource Batcher] Cleaned up for session ${sessionId}`);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function storeBatch(sessionId: string): Promise<void> {
  const batch = sessionBatches.get(sessionId);
  if (!batch || batch.resources.size === 0) return;

  if (batch.pendingTimeout) {
    clearTimeout(batch.pendingTimeout);
    batch.pendingTimeout = null;
  }

  const entries = [...batch.resources.values()];
  const total = entries.reduce((s, r) => s + r.totalAmount, 0);
  console.log(
    `[Resource Batcher] Storing batch: ${entries.length} types, ${total} items`
  );

  const stored: ObjectId[] = [];

  for (const entry of entries) {
    const syntheticEvent: ResourceCollectedEvent = {
      type: 'custom:resource_collected',
      source: 'custom',
      sessionId,
      timestamp: entry.lastTimestamp,
      data: {
        blockType: entry.blockType,
        amount: entry.totalAmount,
        totalCollected: entry.totalAmount,
      },
    };

    try {
      // processEvent will skip shouldStoreMemory filter for resource_collected,
      // so we call encodeEventToMemory + storeMemory directly
      const { encodeEventToMemory, storeMemory } = await import('./memory-agent.js');
      const memory = encodeEventToMemory(syntheticEvent, batch.userId, sessionId);
      if (memory) {
        const id = await storeMemory(memory);
        stored.push(id);
        console.log(
          `[Resource Batcher] Stored: ${entry.totalAmount}x ${entry.blockType} -> ${id}`
        );
      }
    } catch (error) {
      console.error(
        `[Resource Batcher] Failed to store ${entry.blockType}:`,
        error
      );
    }
  }

  batch.resources.clear();
  batch.lastStored = new Date();
  console.log(`[Resource Batcher] Batch done: ${stored.length} memories created`);
}

/**
 * Custom Event Emitters
 *
 * Helper functions to emit custom events from action code.
 * These are called explicitly after actions succeed/fail/complete.
 */

import { gameEventBus } from './event-bus';
import type {
  ResourceCollectedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  ItemCraftedEvent,
  StructureBuiltEvent,
} from './event-types';

export function emitResourceCollected(
  sessionId: string,
  blockType: string,
  amount: number,
  totalCollected: number
): void {
  gameEventBus.emit({
    type: 'custom:resource_collected',
    source: 'custom',
    sessionId,
    timestamp: new Date(),
    data: { blockType, amount, totalCollected },
  } as ResourceCollectedEvent);
}

export function emitTaskCompleted(
  sessionId: string,
  taskName: string,
  success: boolean,
  message?: string,
  duration?: number
): void {
  gameEventBus.emit({
    type: 'custom:task_completed',
    source: 'custom',
    sessionId,
    timestamp: new Date(),
    data: { taskName, success, message, duration },
  } as TaskCompletedEvent);
}

export function emitTaskFailed(
  sessionId: string,
  taskName: string,
  error: string,
  duration?: number
): void {
  gameEventBus.emit({
    type: 'custom:task_failed',
    source: 'custom',
    sessionId,
    timestamp: new Date(),
    data: { taskName, error, duration },
  } as TaskFailedEvent);
}

export function emitItemCrafted(
  sessionId: string,
  itemName: string,
  count: number
): void {
  gameEventBus.emit({
    type: 'custom:item_crafted',
    source: 'custom',
    sessionId,
    timestamp: new Date(),
    data: { itemName, count },
  } as ItemCraftedEvent);
}

export function emitStructureBuilt(
  sessionId: string,
  structureType: 'wall' | 'pillar' | 'platform' | 'other',
  blockType: string,
  blocksPlaced: number
): void {
  gameEventBus.emit({
    type: 'custom:structure_built',
    source: 'custom',
    sessionId,
    timestamp: new Date(),
    data: { structureType, blockType, blocksPlaced },
  } as StructureBuiltEvent);
}

/**
 * Game Event Bus
 *
 * Central event distribution system.
 * Receives events from Minecraft listeners and custom emitters,
 * distributes them to registered handlers (including A2A forwarding).
 */

import { createLogger } from '@dory/shared';
import type { GameEvent, EventHandler, EventFilter } from './event-types';

const logger = createLogger('EventBus');

/** Events that fire too frequently to log individually */
const NOISY_EVENTS = new Set([
  'minecraft:entity_spawn',
  'minecraft:item_pickup',
]);

export class GameEventBus {
  private handlers = new Map<string, EventHandler[]>();
  private filters = new Map<string, EventFilter[]>();

  /** Emit a game event to all matching handlers */
  emit(event: GameEvent): boolean {
    // Log non-noisy events
    if (!NOISY_EVENTS.has(event.type)) {
      logger.info(`${event.type} [${event.sessionId}]`, { data: (event as any).data });
    }

    // Apply filters
    const typeFilters = this.filters.get(event.type) || [];
    if (!typeFilters.every((f) => f(event))) {
      return false;
    }

    // Type-specific handlers
    const typeHandlers = this.handlers.get(event.type) || [];
    for (const handler of typeHandlers) {
      try {
        handler(event);
      } catch (err) {
        logger.error(`Handler error for ${event.type}: ${(err as Error).message}`);
      }
    }

    // Wildcard handlers (listen to all events)
    const wildcardHandlers = this.handlers.get('*') || [];
    for (const handler of wildcardHandlers) {
      try {
        handler(event);
      } catch (err) {
        logger.error(`Wildcard handler error: ${(err as Error).message}`);
      }
    }

    return true;
  }

  /** Register a handler for a specific event type (or '*' for all) */
  on(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /** Remove a handler */
  off(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx > -1) handlers.splice(idx, 1);
    }
  }

  /** Add a filter that can suppress events */
  addFilter(eventType: string, filter: EventFilter): void {
    if (!this.filters.has(eventType)) {
      this.filters.set(eventType, []);
    }
    this.filters.get(eventType)!.push(filter);
  }

  /** Remove all handlers (used on session cleanup) */
  clear(): void {
    this.handlers.clear();
    this.filters.clear();
  }
}

/** Global singleton event bus */
export const gameEventBus = new GameEventBus();

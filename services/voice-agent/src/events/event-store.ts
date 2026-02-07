/**
 * Game Event Store
 *
 * In-memory storage for game events received from the game agent.
 * Uses a single global queue (no per-session keying) since Dory
 * is a single-player companion — one voice session, one game session.
 *
 * Note: This module lives in the main process (Express server).
 * The agent worker (forked child) fetches events via HTTP GET /api/events.
 */

export type EventPriority = 'critical' | 'high' | 'medium' | 'low';

export interface StoredGameEvent {
  timestamp: Date;
  priority: EventPriority;
  message: string;
  announced: boolean;
}

/** Single global event queue */
let events: StoredGameEvent[] = [];
const MAX_EVENTS = 50;

/** Store a game event (sessionId accepted but ignored — single global queue) */
export function storeEvent(
  priority: EventPriority,
  message: string,
  _sessionId?: string
): void {
  events.push({
    timestamp: new Date(),
    priority,
    message,
    announced: false,
  });

  // Trim old events
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

/** Get all unannounced events */
export function getUnannounced(_sessionId?: string): StoredGameEvent[] {
  return events.filter((e) => !e.announced);
}

/** Get unannounced events by priority */
export function getUnannouncedByPriority(
  priority: EventPriority,
  _sessionId?: string
): StoredGameEvent[] {
  return events.filter((e) => !e.announced && e.priority === priority);
}

/** Mark events as announced */
export function markAnnounced(
  _sessionId?: string,
  filter?: (e: StoredGameEvent) => boolean
): void {
  for (const ev of events) {
    if (!filter || filter(ev)) {
      ev.announced = true;
    }
  }
}

/** Clear all events */
export function clearEvents(_sessionId?: string): void {
  events = [];
}

/** Get recent events for context */
export function getRecent(count = 10, _sessionId?: string): StoredGameEvent[] {
  return events.slice(-count);
}

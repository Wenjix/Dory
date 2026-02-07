/**
 * Game Event Store
 *
 * In-memory storage for game events received from the game agent.
 * Events are stored per-session with priority and announcement tracking.
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

const store = new Map<string, StoredGameEvent[]>();
const MAX_EVENTS = 50;

/** Default session key for when no session is specified */
const DEFAULT_SESSION = '_default';

/** Store a game event */
export function storeEvent(
  priority: EventPriority,
  message: string,
  sessionId?: string
): void {
  const key = sessionId || DEFAULT_SESSION;
  let events = store.get(key);
  if (!events) {
    events = [];
    store.set(key, events);
  }

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

/** Get all unannounced events that should be delivered (critical + high + medium) */
export function getUnannounced(sessionId?: string): StoredGameEvent[] {
  const key = sessionId || DEFAULT_SESSION;
  const events = store.get(key) || [];
  return events.filter((e) => !e.announced);
}

/** Get unannounced events by priority */
export function getUnannouncedByPriority(
  priority: EventPriority,
  sessionId?: string
): StoredGameEvent[] {
  const key = sessionId || DEFAULT_SESSION;
  const events = store.get(key) || [];
  return events.filter((e) => !e.announced && e.priority === priority);
}

/** Mark events as announced */
export function markAnnounced(
  sessionId?: string,
  filter?: (e: StoredGameEvent) => boolean
): void {
  const key = sessionId || DEFAULT_SESSION;
  const events = store.get(key);
  if (!events) return;
  for (const ev of events) {
    if (!filter || filter(ev)) {
      ev.announced = true;
    }
  }
}

/** Clear all events for a session */
export function clearEvents(sessionId?: string): void {
  const key = sessionId || DEFAULT_SESSION;
  store.delete(key);
}

/** Get recent events for context */
export function getRecent(count = 10, sessionId?: string): StoredGameEvent[] {
  const key = sessionId || DEFAULT_SESSION;
  const events = store.get(key) || [];
  return events.slice(-count);
}

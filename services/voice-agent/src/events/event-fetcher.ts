/**
 * Event Fetcher (for agent worker process)
 *
 * Since the LiveKit agent worker runs in a forked child process,
 * it can't directly access the main process's event store.
 * Instead, it polls the Express server via HTTP for pending events.
 */

const VOICE_AGENT_URL = `http://localhost:${process.env.PORT || 4001}`;

export interface FetchedEvent {
  timestamp: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  announced: boolean;
}

/**
 * Fetch all unannounced events from the event store
 */
export async function fetchPendingEvents(): Promise<FetchedEvent[]> {
  try {
    const resp = await fetch(`${VOICE_AGENT_URL}/api/events`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.events || [];
  } catch {
    return [];
  }
}

/**
 * Acknowledge events so they don't get fetched again.
 * Can filter by priority.
 */
export async function acknowledgeEvents(priorities?: string[]): Promise<void> {
  try {
    await fetch(`${VOICE_AGENT_URL}/api/events/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priorities }),
    });
  } catch {
    // Ignore errors
  }
}

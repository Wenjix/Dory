/**
 * Memory Context Service
 *
 * HTTP calls from the voice agent worker to the game agent's memory API.
 *
 *   - sendConversationContext:  POST conversation history for LLM extraction
 *   - fetchUserProfile:        GET system-context text for prompt enrichment
 *   - notifySessionEnd:        POST trigger session-end summaries
 */

const GAME_AGENT_URL = process.env.GAME_AGENT_URL || 'http://localhost:3000';
const FETCH_TIMEOUT_MS = 5000; // 5s timeout for all game-agent HTTP calls

// ---------------------------------------------------------------------------
// Send conversation history for memory extraction
// ---------------------------------------------------------------------------

export async function sendConversationContext(
  userId: string,
  sessionId: string,
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>
): Promise<{ success: boolean; memoriesCreated?: number }> {
  try {
    const resp = await fetch(`${GAME_AGENT_URL}/api/memory/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        sessionId,
        conversationHistory,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) {
      console.log(`[ContextService] Memory API returned ${resp.status}`);
      return { success: false };
    }

    const data = await resp.json();
    console.log(
      `[ContextService] Sent ${conversationHistory.length} messages -> ${data.memoriesCreated || 0} memories created`
    );
    return { success: true, memoriesCreated: data.memoriesCreated };
  } catch (err) {
    // Game agent might not be running — non-fatal
    console.log(
      `[ContextService] Could not send context: ${(err as Error).message}`
    );
    return { success: false };
  }
}

// ---------------------------------------------------------------------------
// Fetch user profile / system context for prompt enrichment
// ---------------------------------------------------------------------------

export async function fetchSystemContext(
  userId: string
): Promise<string | null> {
  try {
    const resp = await fetch(
      `${GAME_AGENT_URL}/api/memory/system-context/${encodeURIComponent(userId)}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    );

    if (!resp.ok) return null;

    const data = await resp.json();
    if (data.success && data.context) {
      console.log(
        `[ContextService] Fetched system context (${data.context.length} chars)`
      );
      return data.context;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Notify game agent that the voice session ended
// ---------------------------------------------------------------------------

export async function notifySessionEnd(
  userId: string,
  sessionId: string
): Promise<void> {
  try {
    await fetch(`${GAME_AGENT_URL}/api/memory/session-end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, sessionId }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    console.log(`[ContextService] Session end notified for ${sessionId}`);
  } catch {
    // Non-fatal
  }
}

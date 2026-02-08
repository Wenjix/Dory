/**
 * Session State Management
 *
 * Tracks current mode and conversation context for each session.
 * Sessions are identified by sessionId (typically from WebSocket connection).
 * No authentication - all users are treated as authenticated (hardcoded user-123).
 */

/** Application modes for state machine */
export type AppMode = 'GATEKEEPER' | 'PERSONA_BUILDER' | 'GAMER_AGENT';

/** Summary of a persona for selection UI */
export interface PersonaSummary {
  /** Unique persona ID */
  id: string;
  /** Display name */
  name: string;
  /** Short tagline/subtitle */
  tagline?: string;
  /** Brief description */
  description?: string;
  /** Avatar/profile image URL for display */
  imageUrl?: string | null;
}

export interface SessionState {
  /** Current application mode */
  currentMode: AppMode;
  /** Pending personas for user selection */
  pendingPersonas?: PersonaSummary[];
  /** Selected persona ID for gaming session */
  selectedPersonaId?: string;
  /** Flag set when fetchPopularPersonas runs this turn (prevents changeMode in same turn) */
  personasFetchedThisTurn?: boolean;
  /** Conversation summary from previous agent (handoff context) */
  conversationSummary?: string;
  /** Rolling summary of older conversation context (for context management) */
  rollingSummary?: string;
  /** Conversation history for LLM context */
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** Session creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

const sessions = new Map<string, SessionState>();

/**
 * Get or create a session state
 */
export function getSession(sessionId: string): SessionState {
  let session = sessions.get(sessionId);

  if (!session) {
    session = {
      currentMode: 'GATEKEEPER',
      messages: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
    sessions.set(sessionId, session);
  }

  return session;
}

/**
 * Update session state
 */
export function updateSession(sessionId: string, updates: Partial<SessionState>): SessionState {
  const session = getSession(sessionId);

  Object.assign(session, updates, { lastActivityAt: new Date() });

  return session;
}

/**
 * Add a message to the session's conversation history
 */
export function addMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): void {
  const session = getSession(sessionId);
  session.messages.push({ role, content });
  session.lastActivityAt = new Date();

  // Keep only the last 20 messages to prevent context overflow
  if (session.messages.length > 20) {
    session.messages = session.messages.slice(-20);
  }
}

/**
 * Get conversation messages for LLM context
 */
export function getMessages(sessionId: string): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  return getSession(sessionId).messages;
}

/**
 * Clear a session (e.g., on disconnect)
 */
export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Check if session is authenticated - always returns true (no auth in Dory)
 */
export function isAuthenticated(_sessionId: string): boolean {
  return true;
}

/**
 * Get current application mode
 */
export function getCurrentMode(sessionId: string): AppMode {
  return getSession(sessionId).currentMode;
}

/**
 * Set current application mode
 */
export function setCurrentMode(sessionId: string, mode: AppMode): void {
  updateSession(sessionId, { currentMode: mode });
}

/**
 * Store pending personas for selection
 */
export function setPendingPersonas(sessionId: string, personas: PersonaSummary[]): void {
  updateSession(sessionId, { pendingPersonas: personas });
}

/**
 * Get pending personas for selection
 */
export function getPendingPersonas(sessionId: string): PersonaSummary[] | undefined {
  return getSession(sessionId).pendingPersonas;
}

/**
 * Set selected persona ID
 */
export function setSelectedPersonaId(sessionId: string, personaId: string): void {
  updateSession(sessionId, { selectedPersonaId: personaId });
}

/**
 * Validate session is ready for gaming transition.
 * Only checks that a persona has been selected (no auth checks in Dory).
 */
export function canTransitionToGaming(sessionId: string): {
  canTransition: boolean;
  reason?: string;
} {
  const session = getSession(sessionId);

  if (!session.selectedPersonaId) {
    return {
      canTransition: false,
      reason: 'No persona selected',
    };
  }

  return { canTransition: true };
}

/**
 * Set conversation summary from a previous agent handoff
 */
export function setConversationSummary(sessionId: string, summary: string): void {
  const session = getSession(sessionId);
  session.conversationSummary = summary;
  session.lastActivityAt = new Date();
  console.log(`[Session] Set conversation summary for session: ${sessionId} (${summary.length} chars)`);
}

/**
 * Get conversation summary (from previous agent handoff)
 */
export function getConversationSummary(sessionId: string): string | undefined {
  return getSession(sessionId).conversationSummary;
}

/**
 * Clear conversation summary (after it's been consumed by the LLM)
 */
export function clearConversationSummary(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.conversationSummary = undefined;
  }
}

/**
 * Get session summary for debugging
 */
export function getSessionSummary(sessionId: string): object {
  const session = getSession(sessionId);
  return {
    sessionId,
    currentMode: session.currentMode,
    selectedPersonaId: session.selectedPersonaId,
    pendingPersonasCount: session.pendingPersonas?.length || 0,
    messageCount: session.messages.length,
    lastActivity: session.lastActivityAt,
  };
}

/**
 * Clean up stale sessions (older than 1 hour)
 */
function cleanupStaleSessions(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  for (const [sessionId, session] of sessions) {
    if (session.lastActivityAt < oneHourAgo) {
      sessions.delete(sessionId);
    }
  }
}

// Run cleanup every 15 minutes
setInterval(cleanupStaleSessions, 15 * 60 * 1000);

/**
 * Mark that personas were fetched this turn (prevents changeMode in same turn)
 */
export function setPersonasFetchedThisTurn(sessionId: string): void {
  const session = getSession(sessionId);
  session.personasFetchedThisTurn = true;
}

/**
 * Check if personas were fetched this turn
 */
export function werePersonasFetchedThisTurn(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  return session?.personasFetchedThisTurn ?? false;
}

/**
 * Clear the per-turn flags (call at start of each new turn)
 */
export function clearTurnFlags(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.personasFetchedThisTurn = false;
  }
}

/**
 * Append to rolling conversation summary (for context management)
 */
export function appendConversationSummary(sessionId: string, summary: string): void {
  const session = getSession(sessionId);
  if (session.rollingSummary) {
    session.rollingSummary += '\n' + summary;
  } else {
    session.rollingSummary = summary;
  }
  session.lastActivityAt = new Date();
  console.log(`[Session] Updated rolling summary for session: ${sessionId} (${session.rollingSummary.length} chars)`);
}

/**
 * Get rolling conversation summary
 */
export function getRollingSummary(sessionId: string): string | undefined {
  return getSession(sessionId).rollingSummary;
}

/**
 * Trim oldest messages from conversation history
 */
export function trimOldestMessages(sessionId: string, count: number): void {
  const session = getSession(sessionId);
  if (session.messages.length > count) {
    session.messages = session.messages.slice(count);
    session.lastActivityAt = new Date();
    console.log(`[Session] Trimmed ${count} oldest messages, ${session.messages.length} remaining`);
  }
}

/**
 * Clear stale state when conversation gets stuck
 */
export function clearStaleState(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    // Clear pending personas if they've been there too long
    if (session.pendingPersonas && session.pendingPersonas.length > 0) {
      const lastActivity = session.lastActivityAt;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (lastActivity < fiveMinutesAgo) {
        console.log(`[Session] Clearing stale pending personas for session: ${sessionId}`);
        session.pendingPersonas = undefined;
      }
    }
    session.lastActivityAt = new Date();
  }
}

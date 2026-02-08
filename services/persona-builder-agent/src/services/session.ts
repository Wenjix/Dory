/**
 * Session State Management
 *
 * Tracks authentication state, conversation context, and draft persona
 * for each session. Sessions are identified by sessionId from WebSocket.
 *
 * Note: Auth is hardcoded - always authenticated as 'user-123'.
 */

import {
  PersonaData,
  DEFAULT_PERSONA,
  PersonaIdentity,
  PersonaPersonality,
  PersonaCommunication,
  PersonaGaming,
  PersonaVoice,
  PersonaVisual,
  PersonaExamples,
} from '../types/persona.js';
import {
  loadConversation,
  saveConversation,
  saveDraftPersona,
  saveMessage as saveMessageToDB,
  updateLastActivity,
} from './db/conversation-db.js';
import { attemptDraftRecovery } from './draft-recovery.js';

/**
 * Draft persona being built in the current session
 * Uses optional/partial fields internally, but getFullPersona() returns complete object
 */
export interface DraftPersona {
  identity?: Partial<PersonaIdentity>;
  personality?: Partial<PersonaPersonality>;
  communication?: Partial<PersonaCommunication>;
  gaming?: Partial<PersonaGaming>;
  voice?: Partial<PersonaVoice>;
  visualIdentity?: Partial<PersonaVisual>;
  examples?: Partial<PersonaExamples>;
  description?: string;
  // Human-readable descriptions for frontend (generated after each phase)
  personalityDescription?: string;
  gamingDescription?: string;
}

export interface SessionState {
  /** Whether user has successfully authenticated (always true) */
  authenticated: boolean;
  /** User ID (always 'user-123') */
  userId?: string;
  /** Draft persona being built in this session */
  draftPersona: DraftPersona;
  /** ID of existing persona being edited (null if creating new) */
  editingPersonaId?: string | null;
  /** Flag set when a tool returns requiresAuth error (no-op in Dory) */
  authErrorOccurred?: boolean;
  /** Flag set when persona was saved this turn (prevents playWithPersona in same turn) */
  personaSavedThisTurn?: boolean;
  /** Flag set when mode transition to GAMER_AGENT occurred (stops processing) */
  modeTransitionOccurred?: boolean;
  /** Conversation history for LLM context */
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** Rolling summary of older conversation context */
  conversationSummary: string;
  /** Session creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

const sessions = new Map<string, SessionState>();

/**
 * Get or create a session state
 * Checks memory first, then database, then creates new session
 */
export async function getSession(sessionId: string): Promise<SessionState> {
  // Check memory first (for active sessions)
  let session = sessions.get(sessionId);
  if (session) {
    return session;
  }

  // Try to load from database (for reconnections)
  const dbSession = await loadConversation(sessionId);
  if (dbSession) {
    // Always set authenticated and userId for Dory
    dbSession.authenticated = true;
    dbSession.userId = 'user-123';
    sessions.set(sessionId, dbSession);
    console.log(`[Session] Restored session from DB: ${sessionId}`);
    return dbSession;
  }

  // Create new session (always authenticated as user-123)
  session = {
    authenticated: true,
    userId: 'user-123',
    draftPersona: {},
    messages: [],
    conversationSummary: '',
    createdAt: new Date(),
    lastActivityAt: new Date(),
  };
  sessions.set(sessionId, session);

  // Persist new session to DB (async, fire-and-forget)
  saveConversation(sessionId, session).catch(err => {
    console.error(`[Session] Failed to persist new session:`, err);
  });

  return session;
}

/**
 * Synchronous version of getSession for backward compatibility
 * Use only when you're certain the session exists in memory
 */
export function getSessionSync(sessionId: string): SessionState {
  let session = sessions.get(sessionId);
  if (!session) {
    // Fallback: create temporary session (always authenticated)
    session = {
      authenticated: true,
      userId: 'user-123',
      draftPersona: {},
      messages: [],
      conversationSummary: '',
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
export async function updateSession(sessionId: string, updates: Partial<SessionState>): Promise<SessionState> {
  const session = await getSession(sessionId);

  Object.assign(session, updates, { lastActivityAt: new Date() });

  // Persist to DB (async, fire-and-forget)
  saveConversation(sessionId, session).catch(err => {
    console.error(`[Session] Failed to persist session update:`, err);
  });

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
  const session = getSessionSync(sessionId);
  session.messages.push({ role, content });
  session.lastActivityAt = new Date();

  // Keep only the last 30 messages to prevent context overflow
  if (session.messages.length > 30) {
    session.messages = session.messages.slice(-30);
  }

  // Persist to DB (async, fire-and-forget)
  saveMessageToDB(sessionId, role, content).catch(err => {
    console.error(`[Session] Failed to persist message:`, err);
  });
}

/**
 * Get conversation messages for LLM context
 */
export function getMessages(sessionId: string): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  return getSessionSync(sessionId).messages;
}

/**
 * Get the conversation summary
 */
export function getConversationSummary(sessionId: string): string {
  return getSessionSync(sessionId).conversationSummary;
}

/**
 * Append to the conversation summary
 */
export async function appendConversationSummary(sessionId: string, newSummary: string): Promise<void> {
  const session = await getSession(sessionId);
  if (session.conversationSummary) {
    session.conversationSummary += '\n' + newSummary;
  } else {
    session.conversationSummary = newSummary;
  }
  session.lastActivityAt = new Date();
  console.log(`[Session] Updated conversation summary for session: ${sessionId}`);

  // Persist to DB (async, fire-and-forget)
  saveConversation(sessionId, session).catch(err => {
    console.error(`[Session] Failed to persist summary update:`, err);
  });
}

/**
 * Remove the oldest N messages from the conversation history
 * Used after summarization to trim the context
 */
export async function trimOldestMessages(sessionId: string, count: number): Promise<void> {
  const session = await getSession(sessionId);
  if (count > 0 && session.messages.length > count) {
    session.messages = session.messages.slice(count);
    console.log(`[Session] Trimmed ${count} oldest messages, ${session.messages.length} remaining`);

    // Persist to DB (async, fire-and-forget)
    saveConversation(sessionId, session).catch(err => {
      console.error(`[Session] Failed to persist trimmed messages:`, err);
    });
  }
}

/**
 * Clear a session (e.g., on disconnect)
 */
export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Check if session is authenticated (always true in Dory)
 */
export function isAuthenticated(sessionId: string): boolean {
  return true;
}

/**
 * Get user ID from session (always 'user-123' in Dory)
 */
export function getUserId(sessionId: string): string | undefined {
  return 'user-123';
}

/**
 * Helper to clean undefined values from nested objects
 * Prevents undefined values from overwriting existing data during merge
 */
function cleanUndefinedValues(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj;

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' && !Array.isArray(value) && value !== null
        ? cleanUndefinedValues(value)
        : value;
    }
  }
  return cleaned;
}

/**
 * Update the draft persona in session (deep merge)
 */
export function updateDraftPersona(sessionId: string, updates: Partial<DraftPersona>): DraftPersona {
  const session = getSessionSync(sessionId);
  const existing = session.draftPersona;

  // Log the update (summary)
  console.log(`[Session] Updating draft persona for session: ${sessionId}`);
  const updateKeys = Object.keys(updates).filter(k => updates[k as keyof DraftPersona] !== undefined);
  console.log(`[Session]   → Updating: ${updateKeys.join(', ')}`);

  // Clean updates to remove undefined values (prevents overwriting existing data)
  const cleanedUpdates = cleanUndefinedValues(updates);

  // Deep merge each section (only merge defined values)
  session.draftPersona = {
    identity: { ...existing.identity, ...(cleanedUpdates.identity || {}) },
    personality: { ...existing.personality, ...(cleanedUpdates.personality || {}) },
    communication: { ...existing.communication, ...(cleanedUpdates.communication || {}) },
    gaming: { ...existing.gaming, ...(cleanedUpdates.gaming || {}) },
    voice: { ...existing.voice, ...(cleanedUpdates.voice || {}) },
    visualIdentity: { ...existing.visualIdentity, ...(cleanedUpdates.visualIdentity || {}) },
    examples: { ...existing.examples, ...(cleanedUpdates.examples || {}) },
    description: cleanedUpdates.description ?? existing.description,
    personalityDescription: cleanedUpdates.personalityDescription ?? existing.personalityDescription,
    gamingDescription: cleanedUpdates.gamingDescription ?? existing.gamingDescription,
  };
  session.lastActivityAt = new Date();

  // Persist draft to database (async, fire-and-forget)
  saveDraftPersona(sessionId, session.draftPersona).catch(err => {
    console.error(`[Session] Failed to persist draft:`, err);
  });

  return session.draftPersona;
}

/**
 * Get the draft persona from session
 */
export function getDraftPersona(sessionId: string): DraftPersona {
  const session = getSessionSync(sessionId);
  const draft = session.draftPersona;

  // If draft appears empty but we have conversation history, attempt recovery
  // BUT skip recovery if mode transition occurred (user is in gaming mode now)
  const hasAnyDraftData = draft.identity || draft.description || draft.visualIdentity ||
                          draft.personality || draft.gaming || draft.communication;
  const hasMessages = session.messages.length > 0;
  const modeTransitioned = hasModeTransitionOccurred(sessionId);

  if (!hasAnyDraftData && hasMessages && !modeTransitioned) {
    // Draft appears lost - attempt recovery (async, fire-and-forget)
    // Only if mode transition hasn't occurred (user is still in persona builder)
    attemptDraftRecovery(sessionId).then(recovered => {
      if (recovered) {
        console.log(`[Session] ✅ Recovered draft persona from conversation history`);
        // SAFE MERGE: Only fill in fields that are STILL empty in the current draft.
        // The LLM's tool calls may have already populated fields while recovery was running.
        const current = session.draftPersona;

        // Helper: merge only missing fields from recovered into current
        const safeMergeObj = <T extends Record<string, unknown>>(
          existing: T | undefined,
          recovered: T | undefined
        ): T | undefined => {
          if (!recovered) return existing;
          if (!existing) return recovered;
          const merged = { ...existing };
          for (const [key, value] of Object.entries(recovered)) {
            if (value !== undefined && (merged as any)[key] === undefined) {
              (merged as any)[key] = value;
            }
          }
          return merged;
        };

        // Only set top-level fields if they're still empty
        if (!current.description && recovered.description) {
          current.description = recovered.description;
        }
        if (!current.personalityDescription && recovered.personalityDescription) {
          current.personalityDescription = recovered.personalityDescription;
        }

        // Safe merge nested objects — only fill missing sub-fields
        current.identity = safeMergeObj(current.identity, recovered.identity) as typeof current.identity;
        current.visualIdentity = safeMergeObj(current.visualIdentity, recovered.visualIdentity) as typeof current.visualIdentity;
        current.personality = safeMergeObj(current.personality, recovered.personality) as typeof current.personality;
        current.gaming = safeMergeObj(current.gaming, recovered.gaming) as typeof current.gaming;

        console.log(`[Session] Draft after safe merge:`, {
          species: current.identity?.species || 'missing',
          name: current.identity?.name || 'missing',
          description: current.description ? `${current.description.substring(0, 30)}...` : 'missing',
          artStyle: current.visualIdentity?.artStyle || 'missing',
        });

        // Persist recovered draft
        saveDraftPersona(sessionId, current).catch(err => {
          console.error(`[Session] Failed to persist recovered draft:`, err);
        });
      }
    }).catch(err => {
      console.error(`[Session] Draft recovery failed:`, err);
    });
  }

  return draft;
}

/**
 * Get the full persona with all fields populated (merges draft with defaults)
 * This is what gets sent to the client - always complete, never partial
 */
export function getFullPersona(sessionId: string): PersonaData {
  const draft = getDraftPersona(sessionId);
  const d = DEFAULT_PERSONA;

  return {
    identity: {
      name: draft.identity?.name ?? d.identity.name,
      tagline: draft.identity?.tagline ?? d.identity.tagline,
      backstory: draft.identity?.backstory ?? d.identity.backstory,
      species: draft.identity?.species ?? d.identity.species,
      ageImpression: draft.identity?.ageImpression ?? d.identity.ageImpression,
    },
    personality: {
      archetype: draft.personality?.archetype ?? d.personality.archetype,
      traits: draft.personality?.traits ?? d.personality.traits,
      emotionalTendency: draft.personality?.emotionalTendency ?? d.personality.emotionalTendency,
      quirks: draft.personality?.quirks ?? d.personality.quirks,
      values: draft.personality?.values ?? d.personality.values,
      fears: draft.personality?.fears ?? d.personality.fears,
      catchphrases: draft.personality?.catchphrases ?? d.personality.catchphrases,
    },
    communication: {
      tone: draft.communication?.tone ?? d.communication.tone,
      responseLength: draft.communication?.responseLength ?? d.communication.responseLength,
      formality: draft.communication?.formality ?? d.communication.formality,
      humorStyle: draft.communication?.humorStyle ?? d.communication.humorStyle,
      encouragementStyle: draft.communication?.encouragementStyle ?? d.communication.encouragementStyle,
      errorHandling: draft.communication?.errorHandling ?? d.communication.errorHandling,
      vocabulary: draft.communication?.vocabulary ?? d.communication.vocabulary,
      usesEmotes: draft.communication?.usesEmotes ?? d.communication.usesEmotes,
    },
    gaming: {
      playstyle: draft.gaming?.playstyle ?? d.gaming.playstyle,
      skills: draft.gaming?.skills ?? d.gaming.skills,
      preferences: draft.gaming?.preferences ?? d.gaming.preferences,
      riskTolerance: draft.gaming?.riskTolerance ?? d.gaming.riskTolerance,
      teamworkStyle: draft.gaming?.teamworkStyle ?? d.gaming.teamworkStyle,
      winReaction: draft.gaming?.winReaction ?? d.gaming.winReaction,
      loseReaction: draft.gaming?.loseReaction ?? d.gaming.loseReaction,
      challengeApproach: draft.gaming?.challengeApproach ?? d.gaming.challengeApproach,
      favoriteActivities: draft.gaming?.favoriteActivities ?? d.gaming.favoriteActivities,
    },
    voice: {
      pitch: draft.voice?.pitch ?? d.voice.pitch,
      speed: draft.voice?.speed ?? d.voice.speed,
      accent: draft.voice?.accent ?? d.voice.accent,
      energy: draft.voice?.energy ?? d.voice.energy,
      mannerisms: draft.voice?.mannerisms ?? d.voice.mannerisms,
      elevenLabsVoiceId: draft.voice?.elevenLabsVoiceId,
      elevenLabsVoiceName: draft.voice?.elevenLabsVoiceName,
    },
    visualIdentity: {
      primary: draft.visualIdentity?.primary ?? d.visualIdentity.primary,
      secondary: draft.visualIdentity?.secondary ?? d.visualIdentity.secondary,
      avatarUrl: draft.visualIdentity?.avatarUrl ?? d.visualIdentity.avatarUrl,
      skinUrl: draft.visualIdentity?.skinUrl ?? d.visualIdentity.skinUrl,
      artStyle: draft.visualIdentity?.artStyle ?? d.visualIdentity.artStyle,
    },
    examples: {
      greeting: draft.examples?.greeting ?? d.examples.greeting,
      farewell: draft.examples?.farewell ?? d.examples.farewell,
      celebration: draft.examples?.celebration ?? d.examples.celebration,
      setback: draft.examples?.setback ?? d.examples.setback,
      encouragement: draft.examples?.encouragement ?? d.examples.encouragement,
      confusion: draft.examples?.confusion ?? d.examples.confusion,
    },
    description: draft.description ?? d.description,
    personalityDescription: draft.personalityDescription,
    gamingDescription: draft.gamingDescription,
  };
}

/**
 * Get persona name (convenience helper)
 */
export function getPersonaName(sessionId: string): string {
  return getDraftPersona(sessionId).identity?.name ?? '';
}

/**
 * Simplified persona for frontend
 * Only includes essential fields for UI display
 */
export interface SimplifiedPersona {
  id?: string;
  name?: string;
  imageUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  personalityDescription?: string;
  gamingDescription?: string;
}

/**
 * Get a simplified version of the persona for frontend
 * Reduces data sent over WebSocket to only what's needed for UI
 */
export function getSimplifiedPersona(sessionId: string): SimplifiedPersona {
  const full = getFullPersona(sessionId);
  const editingId = getEditingPersonaId(sessionId);

  return {
    id: editingId || undefined,
    name: full.identity.name || undefined,
    imageUrl: full.visualIdentity.avatarUrl || undefined,
    primaryColor: full.visualIdentity.primary || undefined,
    secondaryColor: full.visualIdentity.secondary || undefined,
    personalityDescription: full.personalityDescription || undefined,
    gamingDescription: full.gamingDescription || undefined,
  };
}

/**
 * Clear the draft persona (after saving or discarding)
 */
export function clearDraftPersona(sessionId: string): void {
  const session = getSessionSync(sessionId);
  session.draftPersona = {};
  session.editingPersonaId = null;

  // Persist to DB (async, fire-and-forget)
  saveConversation(sessionId, session).catch(err => {
    console.error(`[Session] Failed to persist cleared draft:`, err);
  });
}

/**
 * Set the ID of the persona being edited
 */
export async function setEditingPersonaId(sessionId: string, personaId: string | null): Promise<void> {
  const session = await getSession(sessionId);
  session.editingPersonaId = personaId;
  session.lastActivityAt = new Date();
  console.log(`[Session] Set editing persona ID for session ${sessionId}: ${personaId || 'null (new persona)'}`);

  // Persist to DB (async, fire-and-forget)
  saveConversation(sessionId, session).catch(err => {
    console.error(`[Session] Failed to persist editing persona ID:`, err);
  });
}

/**
 * Get the ID of the persona being edited (null if creating new)
 */
export function getEditingPersonaId(sessionId: string): string | null {
  return getSessionSync(sessionId).editingPersonaId ?? null;
}

/**
 * Check if session is in editing mode
 */
export function isEditingExisting(sessionId: string): boolean {
  return !!getSessionSync(sessionId).editingPersonaId;
}

/**
 * Clean up stale sessions (older than 2 hours)
 */
export function cleanupStaleSessions(): void {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  for (const [sessionId, session] of sessions) {
    if (session.lastActivityAt < twoHoursAgo) {
      sessions.delete(sessionId);
    }
  }
}

// Run cleanup every 15 minutes
setInterval(cleanupStaleSessions, 15 * 60 * 1000);

/**
 * Set auth error flag (no-op in Dory - always authenticated)
 */
export async function setAuthErrorOccurred(sessionId: string): Promise<void> {
  // No-op: always authenticated in Dory
}

/**
 * Check if an auth error occurred during this turn (always false in Dory)
 */
export function hasAuthErrorOccurred(sessionId: string): boolean {
  return false;
}

/**
 * Clear auth error flag (no-op in Dory)
 */
export function clearAuthError(sessionId: string): void {
  // No-op
}

/**
 * Set flag that persona was saved this turn
 */
export function setPersonaSavedThisTurn(sessionId: string): void {
  const session = getSessionSync(sessionId);
  session.personaSavedThisTurn = true;
  session.lastActivityAt = new Date();
}

/**
 * Check if persona was saved this turn
 */
export function wasPersonaSavedThisTurn(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  return session?.personaSavedThisTurn ?? false;
}

/**
 * Set flag that mode transition to GAMER_AGENT occurred
 */
export function setModeTransitionOccurred(sessionId: string): void {
  const session = getSessionSync(sessionId);
  session.modeTransitionOccurred = true;
  session.lastActivityAt = new Date();
}

/**
 * Check if mode transition occurred
 */
export function hasModeTransitionOccurred(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  return session?.modeTransitionOccurred ?? false;
}

/**
 * Clear the per-turn flags (call at start of each new turn)
 */
export function clearTurnFlags(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.authErrorOccurred = false;
    session.personaSavedThisTurn = false;
    // Note: modeTransitionOccurred is not cleared here as it should persist until session ends
    // It's a session-level flag, not a turn-level flag
  }
}

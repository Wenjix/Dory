/**
 * Database Service Layer for Conversations
 *
 * Handles persistent storage and retrieval of conversation history,
 * draft personas, and session state using MongoDB via Prisma.
 */

import { prisma } from '../../db/prisma.js';
import type { SessionState, DraftPersona } from '../session.js';
import type { Prisma } from '@prisma/client';

/**
 * Load conversation from database by sessionId
 */
export async function loadConversation(sessionId: string): Promise<SessionState | null> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { sessionId },
    });

    if (!conversation) {
      return null;
    }

    // Convert database record to SessionState
    const messages = (conversation.messages as Prisma.JsonArray) || [];
    const draftPersona = (conversation.draftPersona as DraftPersona | null) || {};

    return {
      authenticated: true, // Always authenticated in Dory
      userId: 'user-123',
      draftPersona,
      editingPersonaId: conversation.editingPersonaId || null,
      authErrorOccurred: false,
      messages: messages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content as string,
      })),
      conversationSummary: conversation.summary || '',
      createdAt: conversation.createdAt,
      lastActivityAt: conversation.lastActivityAt,
    };
  } catch (error) {
    console.error(`[DB] Failed to load conversation for session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Save conversation state to database
 */
export async function saveConversation(sessionId: string, session: SessionState): Promise<void> {
  try {
    await prisma.conversation.upsert({
      where: { sessionId },
      create: {
        sessionId,
        userId: session.userId || null,
        messages: session.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date().toISOString(),
        })),
        summary: session.conversationSummary || null,
        draftPersona: session.draftPersona as Prisma.JsonObject,
        editingPersonaId: session.editingPersonaId || null,
        authenticated: session.authenticated,
        authErrorOccurred: session.authErrorOccurred || false,
        lastActivityAt: session.lastActivityAt,
      },
      update: {
        userId: session.userId || null,
        messages: session.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date().toISOString(),
        })),
        summary: session.conversationSummary || null,
        draftPersona: session.draftPersona as Prisma.JsonObject,
        editingPersonaId: session.editingPersonaId || null,
        authenticated: session.authenticated,
        authErrorOccurred: session.authErrorOccurred || false,
        lastActivityAt: session.lastActivityAt,
      },
    });
  } catch (error) {
    console.error(`[DB] Failed to save conversation for session ${sessionId}:`, error);
    // Don't throw - this is fire-and-forget
  }
}

/**
 * Save draft persona to database (async, fire-and-forget)
 */
export async function saveDraftPersona(sessionId: string, draft: DraftPersona): Promise<void> {
  try {
    await prisma.conversation.update({
      where: { sessionId },
      data: {
        draftPersona: draft as Prisma.JsonObject,
        lastActivityAt: new Date(),
      },
    });
  } catch (error) {
    // If conversation doesn't exist yet, create it
    if ((error as any)?.code === 'P2025') {
      try {
        await prisma.conversation.create({
          data: {
            sessionId,
            draftPersona: draft as Prisma.JsonObject,
            messages: [],
            authenticated: true,
            authErrorOccurred: false,
            lastActivityAt: new Date(),
          },
        });
      } catch (createError) {
        console.error(`[DB] Failed to create conversation for draft save:`, createError);
      }
    } else {
      console.error(`[DB] Failed to save draft persona for session ${sessionId}:`, error);
    }
  }
}

/**
 * Load draft persona from database
 */
export async function loadDraftPersona(sessionId: string): Promise<DraftPersona | null> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { sessionId },
      select: { draftPersona: true },
    });

    if (!conversation || !conversation.draftPersona) {
      return null;
    }

    return conversation.draftPersona as DraftPersona;
  } catch (error) {
    console.error(`[DB] Failed to load draft persona for session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Update last activity timestamp
 */
export async function updateLastActivity(sessionId: string): Promise<void> {
  try {
    await prisma.conversation.update({
      where: { sessionId },
      data: {
        lastActivityAt: new Date(),
      },
    });
  } catch (error) {
    // Ignore if conversation doesn't exist yet
    if ((error as any)?.code !== 'P2025') {
      console.error(`[DB] Failed to update last activity for session ${sessionId}:`, error);
    }
  }
}

/**
 * Save a single message to conversation
 */
export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { sessionId },
      select: { messages: true },
    });

    const existingMessages = (conversation?.messages as Prisma.JsonArray) || [];
    const newMessages = [
      ...existingMessages,
      {
        role,
        content,
        timestamp: new Date().toISOString(),
      },
    ];

    // Keep only last 30 messages
    const trimmedMessages = newMessages.slice(-30);

    await prisma.conversation.upsert({
      where: { sessionId },
      create: {
        sessionId,
        messages: trimmedMessages,
        authenticated: true,
        authErrorOccurred: false,
        lastActivityAt: new Date(),
      },
      update: {
        messages: trimmedMessages,
        lastActivityAt: new Date(),
      },
    });
  } catch (error) {
    console.error(`[DB] Failed to save message for session ${sessionId}:`, error);
    // Don't throw - this is fire-and-forget
  }
}

/**
 * Restore session state from database record
 * Helper function to convert DB record to SessionState
 */
export function restoreSessionFromDB(sessionId: string, conversation: any): SessionState {
  const messages = (conversation.messages as Prisma.JsonArray) || [];
  const draftPersona = (conversation.draftPersona as DraftPersona | null) || {};

  return {
    authenticated: true, // Always authenticated in Dory
    userId: 'user-123',
    draftPersona,
    editingPersonaId: conversation.editingPersonaId || null,
    authErrorOccurred: false,
    messages: messages.map((msg: any) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content as string,
    })),
    conversationSummary: conversation.summary || '',
    createdAt: conversation.createdAt,
    lastActivityAt: conversation.lastActivityAt,
  };
}

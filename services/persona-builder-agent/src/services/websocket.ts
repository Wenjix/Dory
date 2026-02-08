/**
 * WebSocket Service
 *
 * Handles WebSocket connections for the Persona Builder Agent.
 * No JWT authentication - always authenticated as user-123.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { handleUserMessage } from '../agent/persona-builder.js';
import { getSession, appendConversationSummary, getMessages, getSimplifiedPersona } from './session.js';
import type { OutgoingMessage } from '../types/persona.js';

// Re-export types for convenience
export type { PersonaData, OutgoingMessage } from '../types/persona.js';
export { DEFAULT_PERSONA } from '../types/persona.js';

interface WSClient {
  id: string;
  ws: WebSocket;
  sessionId: string;
}

interface IncomingMessage {
  type: 'chat' | 'message' | 'user' | 'init';
  text?: string;
  message?: string;
  content?: string;
  sessionId?: string;
  accessToken?: string;  // For init type (ignored - no auth)
  conversationSummary?: string;  // Context from previous agent handoff
  initialPrompt?: string;  // Initial prompt from gatekeeper handoff
}

const wsClients = new Map<string, Set<WSClient>>();
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initWebSocketServer(httpServer: Server): WebSocketServer {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    const clientId = uuidv4();
    let sessionId: string;
    let client: WSClient | undefined;

    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      sessionId = url.searchParams.get('sessionId') || uuidv4();
      const conversationSummary = url.searchParams.get('conversationSummary') || undefined;
      const initialPrompt = url.searchParams.get('initialPrompt') || undefined;

      client = { id: clientId, ws, sessionId };

      // Track client by session
      if (!wsClients.has(sessionId)) {
        wsClients.set(sessionId, new Set());
      }
      wsClients.get(sessionId)!.add(client);

      console.log(`[WebSocket] Client connected: ${clientId} (session: ${sessionId})`);

      // Check if conversation exists in DB and restore session state
      // getSession will automatically load from DB if not in memory
      const session = await getSession(sessionId);
      if (session.messages.length > 0) {
        console.log(`[WebSocket] ✅ Session loaded: ${sessionId} (${session.messages.length} messages from ${session.createdAt})`);
      }

      // No JWT verification needed - always authenticated as user-123

      // Store conversation context from URL params (handoff from gatekeeper)
      if (conversationSummary) {
        console.log(`[WebSocket] 📝 Conversation context from URL (${conversationSummary.length} chars)`);
        await appendConversationSummary(sessionId, decodeURIComponent(conversationSummary));
      }

      // Check if this is a truly new session (no existing messages)
      const existingMessages = getMessages(sessionId);
      const isNewSession = existingMessages.length === 0;

      // Trigger agent greeting on connection for a smooth transition
      // Only if this is a truly new session (no existing conversation)
      if (isNewSession) {
        if (initialPrompt) {
          // Gatekeeper passed the user's creative idea — wrap it with system hint to follow phase flow
          const decodedPrompt = decodeURIComponent(initialPrompt);
          console.log(`[WebSocket] 🎨 Initial prompt from URL: "${decodedPrompt.substring(0, 50)}..."`);
          const contextualPrompt = `[System: User wants to create a persona. Their idea: "${decodedPrompt}". Follow Phase 1 Step 1 - acknowledge their concept and ask about visual details. Do NOT skip the name step.]`;
          try {
            await handleUserMessage(sessionId, contextualPrompt, (response) => {
              broadcastToSession(sessionId, response);
            });
          } catch (error) {
            console.error(`[WebSocket] ❌ Error handling initial prompt for session ${sessionId}:`, error);
            // Send error to client but don't crash
            sendToClient(client, {
              type: 'error',
              text: 'Failed to process initial prompt. Please try sending a message.',
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          // No initial prompt — generate a greeting from the agent
          const greeting = conversationSummary
            ? '[System: The user just arrived from the gatekeeper. Greet them briefly and guide them to start building a persona based on the conversation context.]'
            : '[System: New session started. Greet the user and ask what kind of persona they want to create.]';
          console.log(`[WebSocket] 🎙️ Triggering agent greeting for session: ${sessionId}`);
          try {
            await handleUserMessage(sessionId, greeting, (response) => {
              broadcastToSession(sessionId, response);
            });
          } catch (error) {
            console.error(`[WebSocket] ❌ Error generating greeting for session ${sessionId}:`, error);
            // Send error to client but don't crash
            sendToClient(client, {
              type: 'error',
              text: 'Failed to generate greeting. Please try sending a message.',
              timestamp: new Date().toISOString(),
            });
          }
        }
      } else {
        // Reconnection with existing conversation — skip greeting
        console.log(`[WebSocket] 🔄 Reconnection detected for session: ${sessionId} (${existingMessages.length} existing messages). Skipping greeting.`);

        // Send conversation history to frontend for restoration
        try {
          const persona = getSimplifiedPersona(sessionId);
          sendToClient(client, {
            type: 'chat',
            role: 'system',
            text: `Conversation restored (${existingMessages.length} messages)`,
            persona,
            timestamp: new Date().toISOString(),
          } as any);
          console.log(`[WebSocket] ✅ Sent conversation restoration notice to client`);
        } catch (error) {
          console.error(`[WebSocket] Failed to send conversation restoration:`, error);
        }
      }
    } catch (error) {
      console.error(`[WebSocket] ❌ Fatal error in connection handler for client ${clientId}:`, error);
      // Try to send error to client if possible
      if (client && ws.readyState === WebSocket.OPEN) {
        try {
          sendToClient(client, {
            type: 'error',
            text: 'Connection error occurred. Please reconnect.',
            timestamp: new Date().toISOString(),
          });
        } catch (sendError) {
          console.error(`[WebSocket] Failed to send error message:`, sendError);
        }
      }
      // Don't crash - just log and continue
      return;
    }

    ws.on('message', async (data) => {
      const rawMessage = data.toString();
      console.log(`[WebSocket] Raw message received:`, rawMessage);

      try {
        const message = JSON.parse(rawMessage) as IncomingMessage;
        console.log(`[WebSocket] Parsed message:`, message);
        await handleIncomingMessage(client, message);
      } catch (error) {
        console.error('[WebSocket] ❌ Error processing message:', error);
        // Try to send error to client, but don't crash if it fails
        try {
          sendToClient(client, {
            type: 'error',
            text: error instanceof Error ? `Error: ${error.message}` : 'Invalid message format',
            timestamp: new Date().toISOString(),
          });
        } catch (sendError) {
          console.error('[WebSocket] Failed to send error message to client:', sendError);
        }
      }
    });

    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected: ${clientId}`);
      wsClients.get(sessionId)?.delete(client);

      if (wsClients.get(sessionId)?.size === 0) {
        wsClients.delete(sessionId);
        // Keep session for potential reconnection
      }
    });

    ws.on('error', (error) => {
      console.error(`[WebSocket] Client error:`, error);
    });
  });

  console.log('✅ WebSocket server initialized on /ws');
  return wss;
}

/**
 * Handle incoming message from client
 */
async function handleIncomingMessage(client: WSClient, message: IncomingMessage): Promise<void> {
  try {
    console.log(`[WebSocket] handleIncomingMessage called with type: ${message.type}`);

    // Handle init message (reconnection with conversation context from previous agent)
    if (message.type === 'init') {
      console.log(`[WebSocket] Received init message for session: ${client.sessionId}`);
      // No JWT verification needed - always authenticated

      if (message.conversationSummary) {
        console.log(`[WebSocket] 📝 Received conversation context (${message.conversationSummary.length} chars)`);
        await appendConversationSummary(client.sessionId, message.conversationSummary);
      }
      // Generate an agent greeting for a smooth transition
      if (message.initialPrompt) {
        // Gatekeeper sent a creative idea — use it as the first message
        console.log(`[WebSocket] 🎨 Received initial prompt: "${message.initialPrompt.substring(0, 50)}..."`);
        try {
          await handleUserMessage(client.sessionId, message.initialPrompt, (response) => {
            broadcastToSession(client.sessionId, response);
          });
        } catch (error) {
          console.error(`[WebSocket] ❌ Error handling initial prompt in init message:`, error);
          sendToClient(client, {
            type: 'error',
            text: 'Failed to process initial prompt. Please try sending a message.',
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // No initial prompt — greet the user based on context
        const greeting = message.conversationSummary
          ? '[System: The user just arrived from the gatekeeper. Greet them briefly and guide them to start building a persona based on the conversation context.]'
          : '[System: New session started. Greet the user and ask what kind of persona they want to create.]';
        console.log(`[WebSocket] 🎙️ Triggering agent greeting for session: ${client.sessionId}`);
        try {
          await handleUserMessage(client.sessionId, greeting, (response) => {
            broadcastToSession(client.sessionId, response);
          });
        } catch (error) {
          console.error(`[WebSocket] ❌ Error generating greeting in init message:`, error);
          sendToClient(client, {
            type: 'error',
            text: 'Failed to generate greeting. Please try sending a message.',
            timestamp: new Date().toISOString(),
          });
        }
      }
      return;
    }

    // Accept 'chat', 'message', or 'user' as valid message types
    if (message.type !== 'chat' && message.type !== 'message' && message.type !== 'user') {
      console.log(`[WebSocket] Ignoring message with type: ${message.type}`);
      return;
    }

    // Support multiple field names for message content
    const text = (message.text || message.message || message.content)?.trim();
    if (!text) {
      console.log(`[WebSocket] Ignoring empty message`);
      return;
    }

    console.log(`[WebSocket] Processing message: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" for session: ${client.sessionId}`);

    // Process with agent
    try {
      console.log(`[WebSocket] Calling handleUserMessage...`);
      await handleUserMessage(client.sessionId, text, (response) => {
        console.log(`[WebSocket] Broadcasting response type: ${response.type}`);
        broadcastToSession(client.sessionId, response);
      });
      console.log(`[WebSocket] ✅ handleUserMessage completed`);
    } catch (error) {
      console.error('[WebSocket] ❌ Agent error:', error);
      console.error('[WebSocket] Error name:', (error as Error).name);
      console.error('[WebSocket] Error message:', (error as Error).message);
      console.error('[WebSocket] Error stack:', (error as Error).stack);

      // Send error to client but don't crash
      try {
        sendToClient(client, {
          type: 'error',
          text: 'Something went wrong. Please try again.',
          timestamp: new Date().toISOString(),
        });
      } catch (sendError) {
        console.error('[WebSocket] Failed to send error message to client:', sendError);
      }
    }
  } catch (error) {
    // Catch any other unexpected errors in handleIncomingMessage
    console.error(`[WebSocket] ❌ Unexpected error in handleIncomingMessage:`, error);
    try {
      sendToClient(client, {
        type: 'error',
        text: 'An unexpected error occurred. Please try again.',
        timestamp: new Date().toISOString(),
      });
    } catch (sendError) {
      console.error(`[WebSocket] Failed to send error message:`, sendError);
    }
  }
}

/**
 * Send message to a specific client
 */
function sendToClient(client: WSClient, message: OutgoingMessage): void {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast message to all clients in a session
 */
export function broadcastToSession(sessionId: string, message: OutgoingMessage): void {
  const clients = wsClients.get(sessionId);
  if (!clients) return;

  const payload = JSON.stringify({
    ...message,
    timestamp: message.timestamp || new Date().toISOString(),
  });

  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}

/**
 * Check if session has connected clients
 */
export function hasClients(sessionId: string): boolean {
  return (wsClients.get(sessionId)?.size ?? 0) > 0;
}

/**
 * WebSocket Service
 *
 * Handles WebSocket connections for the gatekeeper agent.
 * No authentication required - all users are treated as authenticated.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { handleUserMessage } from '../agent/gatekeeper.js';
import { getSession, clearSession, setConversationSummary } from './session.js';
import type { AppMode, PersonaSummary } from './session.js';

interface WSClient {
  id: string;
  ws: WebSocket;
  sessionId: string;
}

interface IncomingMessage {
  type: 'chat' | 'message' | 'user' | 'persona_select' | 'init';
  text?: string;
  message?: string;  // Alternative field name
  content?: string;  // Another alternative
  sessionId?: string;
  personaId?: string;  // For persona_select type
  conversationSummary?: string;  // Context from previous agent handoff
}

export interface OutgoingMessage {
  type: 'chat' | 'mode_change' | 'persona_list' | 'system' | 'error';
  role?: 'assistant' | 'user' | 'system';
  text?: string;
  /** Current application mode */
  mode?: AppMode;
  /** Selected persona ID (for GAMER_AGENT mode) */
  personaId?: string;
  /** Available personas for selection */
  personas?: PersonaSummary[];
  /** Initial prompt for persona builder handoff */
  initialPrompt?: string;
  /** Conversation summary for context preservation across agent transitions */
  conversationSummary?: string;
  /** ISO 8601 timestamp */
  timestamp?: string;
}

const wsClients = new Map<string, Set<WSClient>>();
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initWebSocketServer(httpServer: Server): WebSocketServer {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientId = uuidv4();
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId') || uuidv4();

    const client: WSClient = { id: clientId, ws, sessionId };

    // Track client by session
    if (!wsClients.has(sessionId)) {
      wsClients.set(sessionId, new Set());
    }
    wsClients.get(sessionId)!.add(client);

    console.log(`[WebSocket] Client connected: ${clientId} (session: ${sessionId})`);

    // Send welcome message with current mode
    const session = getSession(sessionId);
    sendToClient(client, {
      type: 'system',
      text: 'Connected to Gatekeeper',
      mode: session.currentMode,
      timestamp: new Date().toISOString(),
    });

    ws.on('message', async (data) => {
      const rawMessage = data.toString();
      console.log(`[WebSocket] Raw message received:`, rawMessage);

      try {
        const message = JSON.parse(rawMessage) as IncomingMessage;
        console.log(`[WebSocket] Parsed message:`, message);
        await handleIncomingMessage(client, message);
      } catch (error) {
        console.error('[WebSocket] Message parse error:', error);
        sendToClient(client, {
          type: 'error',
          text: 'Invalid message format',
          timestamp: new Date().toISOString(),
        });
      }
    });

    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected: ${clientId}`);
      wsClients.get(sessionId)?.delete(client);

      if (wsClients.get(sessionId)?.size === 0) {
        wsClients.delete(sessionId);
        // Don't clear session immediately - allow reconnection
        // Sessions are cleaned up by the stale session cleanup
      }
    });

    ws.on('error', (error) => {
      console.error(`[WebSocket] Client error:`, error);
    });
  });

  console.log('WebSocket server initialized on /ws');
  return wss;
}

/**
 * Handle incoming message from client
 */
async function handleIncomingMessage(client: WSClient, message: IncomingMessage): Promise<void> {
  console.log(`[WebSocket] handleIncomingMessage called with type: ${message.type}`);

  // Handle init message (reconnection + conversation context from previous agent)
  if (message.type === 'init') {
    console.log(`[WebSocket] Received init message for session: ${client.sessionId}`);
    if (message.conversationSummary) {
      console.log(`[WebSocket] Received conversation context (${message.conversationSummary.length} chars)`);
      setConversationSummary(client.sessionId, message.conversationSummary);
    }
    // Generate a greeting from the agent so the transition feels smooth
    // The conversation summary is already stored and will be injected into the system prompt
    const greeting = message.conversationSummary
      ? '[System: The user just returned from another agent. Greet them briefly and pick up from where they left off based on the conversation context.]'
      : '[System: New session started. Greet the user briefly.]';
    console.log(`[WebSocket] Triggering agent greeting for session: ${client.sessionId}`);
    await handleUserMessage(client.sessionId, greeting, (response) => {
      broadcastToSession(client.sessionId, response);
    });
    return;
  }

  // Handle persona selection from client UI
  if (message.type === 'persona_select' && message.personaId) {
    console.log(`[WebSocket] Persona selected: ${message.personaId}`);
    // Forward as a text message for the agent to process
    const text = `I choose persona ${message.personaId}`;
    await handleUserMessage(client.sessionId, text, (response) => {
      broadcastToSession(client.sessionId, response);
    });
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
    console.log(`[WebSocket] Ignoring empty message - no text/message/content field found`);
    return;
  }

  console.log(`[WebSocket] Processing message: "${text}" for session: ${client.sessionId}`);

  // NOTE: We do NOT echo user messages back - the client handles displaying its own messages.
  // Only broadcast agent responses.

  // Process with agent
  try {
    await handleUserMessage(client.sessionId, text, (response) => {
      broadcastToSession(client.sessionId, response);
    });
  } catch (error) {
    console.error('[WebSocket] Agent error:', error);
    sendToClient(client, {
      type: 'error',
      text: 'Something went wrong. Please try again.',
      timestamp: new Date().toISOString(),
    });
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

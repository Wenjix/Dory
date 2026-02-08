/**
 * WebSocket Manager
 * Centralized WebSocket connection management for all agents
 * Based on MULTI_AGENT_FRONTEND_PLAN.md Task 1.2
 */

import type { AppMode, WSMessage, InitMessage, ConnectionStatus } from '@/types/agent.types'

export type MessageHandler = (message: WSMessage) => void
export type ConnectionHandler = (status: ConnectionStatus) => void

/**
 * WebSocketManager - Manages all agent WebSocket connections
 *
 * Features:
 * - Connection pooling via Map<AppMode, WebSocket>
 * - Automatic reconnection with exponential backoff
 * - Event-driven message handling
 * - Connection status tracking
 */
export class WebSocketManager {
  private connections: Map<AppMode, WebSocket> = new Map()
  private messageHandlers: Map<AppMode, MessageHandler[]> = new Map()
  private connectionHandlers: Map<AppMode, ConnectionHandler[]> = new Map()
  private reconnectAttempts: Map<AppMode, number> = new Map()
  private initMessages: Map<AppMode, InitMessage> = new Map() // Store for reconnection
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000

  constructor(private agentUrls: Record<AppMode, string>) {}

  /**
   * Connect to an agent's WebSocket
   */
  async connect(
    mode: AppMode,
    initMessage: InitMessage
  ): Promise<void> {
    const baseUrl = this.agentUrls[mode]
    if (!baseUrl) {
      throw new Error(`No URL configured for mode: ${mode}`)
    }

    // Don't create new connection if already open or connecting
    const existingWs = this.connections.get(mode)
    if (existingWs?.readyState === WebSocket.OPEN || existingWs?.readyState === WebSocket.CONNECTING) {
      console.log(`[WebSocketManager] Already connected/connecting to ${mode}, skipping`)
      return
    }

    // Store init message for potential reconnection
    this.initMessages.set(mode, initMessage)

    // Build WebSocket URL with query parameters per backend spec
    // Backend expects: ws://host:port/ws?sessionId=<uuid>&token=<jwt>&conversationSummary=...&initialPrompt=...
    const url = new URL(baseUrl)
    url.searchParams.set('sessionId', initMessage.sessionId)
    // Add conversationSummary to URL for PERSONA_BUILDER and GATEKEEPER (not GAMER_AGENT)
    if (mode !== 'GAMER_AGENT' && initMessage.conversationSummary) {
      url.searchParams.set('conversationSummary', initMessage.conversationSummary)
      console.log(`[WebSocketManager] Adding conversationSummary to URL (${initMessage.conversationSummary.length} chars)`)
    }

    // Add initialPrompt to URL for PERSONA_BUILDER
    if (mode === 'PERSONA_BUILDER' && initMessage.initialPrompt) {
      url.searchParams.set('initialPrompt', initMessage.initialPrompt)
      console.log(`[WebSocketManager] Adding initialPrompt to URL: ${initMessage.initialPrompt.substring(0, 50)}...`)
    }

    const wsUrl = url.toString()
    console.log(`[WebSocketManager] Connecting to ${mode} at ${baseUrl}`)
    this.updateConnectionStatus(mode, 'connecting')

    try {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log(`[WebSocketManager] Connected to ${mode}`)
        this.updateConnectionStatus(mode, 'connected')
        this.reconnectAttempts.set(mode, 0)

        // Only send init message if:
        // 1. Not GATEKEEPER (other agents need init for mode transitions)
        // 2. OR has conversationSummary/initialPrompt (coming from mode change)
        const hasContext = !!(initMessage.conversationSummary || initMessage.initialPrompt)
        const shouldSendInit = mode !== 'GATEKEEPER' || hasContext

        if (shouldSendInit) {
          console.log(`[WebSocketManager] Sending init to ${mode} with conversationSummary:`, !!initMessage.conversationSummary)
          if (initMessage.conversationSummary) {
            console.log(`[WebSocketManager] ConversationSummary length: ${initMessage.conversationSummary.length} chars`)
          }
          this.sendMessage(mode, initMessage)
        } else {
          console.log(`[WebSocketManager] Skipping init for fresh GATEKEEPER session - waiting for user message`)
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage
          console.log(`[WebSocketManager] Message from ${mode}:`, message.type)
          this.handleMessage(mode, message)
        } catch (error) {
          console.error(`[WebSocketManager] Failed to parse message from ${mode}:`, error)
        }
      }

      ws.onerror = (error) => {
        console.error(`[WebSocketManager] Error on ${mode}:`, error)
        this.updateConnectionStatus(mode, 'error')
      }

      ws.onclose = (event) => {
        console.log(`[WebSocketManager] Disconnected from ${mode}:`, event.code, event.reason)
        this.updateConnectionStatus(mode, 'disconnected')
        this.connections.delete(mode)

        // Attempt reconnection if not intentional close (codes 1000 and 1001 are normal)
        if (event.code !== 1000 && event.code !== 1001) {
          this.attemptReconnect(mode)
        }
      }

      this.connections.set(mode, ws)
    } catch (error) {
      console.error(`[WebSocketManager] Connection failed for ${mode}:`, error)
      this.updateConnectionStatus(mode, 'error')
      throw error
    }
  }

  /**
   * Disconnect from an agent
   */
  disconnect(mode: AppMode): void {
    const ws = this.connections.get(mode)
    if (ws) {
      console.log(`[WebSocketManager] Disconnecting from ${mode}`)
      ws.close(1000, 'Client initiated disconnect')
      this.connections.delete(mode)
      this.initMessages.delete(mode)
    }
  }

  /**
   * Send a message to an agent
   */
  sendMessage(mode: AppMode, message: Partial<WSMessage>): void {
    const ws = this.connections.get(mode)
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error(`[WebSocketManager] Cannot send message - not connected to ${mode}`)
      return
    }

    const fullMessage = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    }

    console.log(`[WebSocketManager] Sending to ${mode}:`, fullMessage.type)
    ws.send(JSON.stringify(fullMessage))
  }

  /**
   * Register a message handler for an agent
   * Returns unsubscribe function
   */
  onMessage(mode: AppMode, handler: MessageHandler): () => void {
    const handlers = this.messageHandlers.get(mode) || []
    handlers.push(handler)
    this.messageHandlers.set(mode, handlers)

    // Return unsubscribe function
    return () => {
      const updatedHandlers = this.messageHandlers.get(mode)?.filter(h => h !== handler) || []
      this.messageHandlers.set(mode, updatedHandlers)
    }
  }

  /**
   * Register a connection status handler for an agent
   * Returns unsubscribe function
   */
  onConnectionChange(mode: AppMode, handler: ConnectionHandler): () => void {
    const handlers = this.connectionHandlers.get(mode) || []
    handlers.push(handler)
    this.connectionHandlers.set(mode, handlers)

    // Return unsubscribe function
    return () => {
      const updatedHandlers = this.connectionHandlers.get(mode)?.filter(h => h !== handler) || []
      this.connectionHandlers.set(mode, updatedHandlers)
    }
  }

  /**
   * Get connection status for an agent
   */
  getConnectionStatus(mode: AppMode): ConnectionStatus {
    const ws = this.connections.get(mode)
    if (!ws) return 'disconnected'

    switch (ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting'
      case WebSocket.OPEN:
        return 'connected'
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected'
      default:
        return 'error'
    }
  }

  /**
   * Check if connected to a specific agent
   */
  isConnected(mode: AppMode): boolean {
    return this.getConnectionStatus(mode) === 'connected'
  }

  /**
   * Disconnect all connections
   */
  disconnectAll(): void {
    console.log('[WebSocketManager] Disconnecting all connections')
    this.connections.forEach((_, mode) => this.disconnect(mode))
  }

  /**
   * Reconnect to all previously connected agents
   * Useful after network interruption
   */
  reconnectAll(): void {
    console.log('[WebSocketManager] Reconnecting all agents')
    this.initMessages.forEach((initMessage, mode) => {
      if (!this.isConnected(mode)) {
        this.connect(mode, initMessage).catch(error => {
          console.error(`[WebSocketManager] Failed to reconnect to ${mode}:`, error)
        })
      }
    })
  }

  /**
   * Handle incoming message from WebSocket
   */
  private handleMessage(mode: AppMode, message: WSMessage): void {
    const handlers = this.messageHandlers.get(mode) || []
    handlers.forEach(handler => {
      try {
        handler(message)
      } catch (error) {
        console.error(`[WebSocketManager] Error in message handler for ${mode}:`, error)
      }
    })
  }

  /**
   * Update connection status and notify handlers
   */
  private updateConnectionStatus(mode: AppMode, status: ConnectionStatus): void {
    const handlers = this.connectionHandlers.get(mode) || []
    handlers.forEach(handler => {
      try {
        handler(status)
      } catch (error) {
        console.error(`[WebSocketManager] Error in connection handler for ${mode}:`, error)
      }
    })
  }

  /**
   * Attempt to reconnect to an agent with exponential backoff
   */
  private async attemptReconnect(mode: AppMode): Promise<void> {
    const attempts = this.reconnectAttempts.get(mode) || 0
    const initMessage = this.initMessages.get(mode)

    if (!initMessage) {
      console.warn(`[WebSocketManager] No init message stored for ${mode}, cannot reconnect`)
      return
    }

    if (attempts >= this.maxReconnectAttempts) {
      console.error(`[WebSocketManager] Max reconnect attempts reached for ${mode}`)
      return
    }

    console.log(`[WebSocketManager] Reconnecting to ${mode} (attempt ${attempts + 1}/${this.maxReconnectAttempts})`)
    this.reconnectAttempts.set(mode, attempts + 1)

    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
    const delay = this.reconnectDelay * Math.pow(2, attempts)
    await new Promise(resolve => setTimeout(resolve, delay))

    try {
      await this.connect(mode, initMessage)
    } catch (error) {
      console.error(`[WebSocketManager] Reconnect failed for ${mode}:`, error)
    }
  }
}

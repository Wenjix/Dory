/**
 * Voice Agent WebSocket Service
 * Connects to the voice/gaming agent via WebSocket
 * Supports text mode (WebSocket) with future LiveKit voice mode
 */

import { AgentMessage, parseAgentMessage } from './agentMessage'

export interface VoiceAgentServiceConfig {
  url: string
  onMessage: (message: AgentMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

export class VoiceAgentService {
  private ws: WebSocket | null = null
  private config: VoiceAgentServiceConfig
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isIntentionalClose = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: VoiceAgentServiceConfig) {
    this.config = config
  }

  connect(): void {
    // Don't create new connection if already open or connecting
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('[VoiceAgentService] Already connected or connecting, skipping')
      return
    }

    this.isIntentionalClose = false
    this.clearReconnectTimer()

    console.log('[VoiceAgentService] Connecting to:', this.config.url)

    try {
      this.ws = new WebSocket(this.config.url)

      this.ws.onopen = () => {
        console.log('[VoiceAgentService] Connected successfully')
        this.reconnectAttempts = 0
        this.config.onConnect?.()
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.config.onMessage(parseAgentMessage(data))
        } catch {
          this.config.onMessage({
            type: 'agent',
            content: event.data,
            timestamp: new Date().toISOString(),
          })
        }
      }

      this.ws.onclose = (event) => {
        console.log('[VoiceAgentService] Disconnected:', event.code, event.reason)
        this.config.onDisconnect?.()

        if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect()
        }
      }

      this.ws.onerror = (error) => {
        console.error('[VoiceAgentService] WebSocket error:', error)
        this.config.onError?.(error)
      }
    } catch (error) {
      console.error('[VoiceAgentService] Failed to connect:', error)
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`[VoiceAgentService] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      if (!this.isIntentionalClose) {
        this.connect()
      }
    }, delay)
  }

  send(message: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[VoiceAgentService] Cannot send message, not connected')
      return
    }

    const payload = JSON.stringify({
      type: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    })

    this.ws.send(payload)
  }

  disconnect(): void {
    console.log('[VoiceAgentService] Disconnecting...')
    this.isIntentionalClose = true
    this.clearReconnectTimer()
    this.reconnectAttempts = 0

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

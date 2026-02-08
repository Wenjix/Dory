/**
 * useVoiceAgent Hook
 * Manages WebSocket connection to the voice/gaming agent
 * Supports text mode with future LiveKit voice integration
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { VoiceAgentService, AgentMessage, convertToDisplayRole } from '../services'

const VOICE_AGENT_WS_URL = process.env.NEXT_PUBLIC_VOICE_AGENT_WS_URL || 'ws://localhost:4001/ws'

export interface VoiceAgentMessage {
  id: string
  role: 'user' | 'model' | 'system'
  text: string
  timestamp: Date
  suggestions?: string[]
}

/** Companion statuses for UI feedback */
export enum CompanionStatus {
  IDLE = 'idle',
  LISTENING = 'listening',
  TALKING = 'talking',
  CONNECTING = 'connecting',
}

/** Game state tracked by the agent */
export interface GameState {
  isPlaying: boolean
  gameName: string | null
  coverUrl: string | null
}

interface UseVoiceAgentOptions {
  autoConnect?: boolean
  onMessage?: (message: VoiceAgentMessage) => void
}

interface UseVoiceAgentReturn {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  companionStatus: CompanionStatus
  gameState: GameState
  sendMessage: (text: string) => void
  connect: () => void
  disconnect: () => void
  setCompanionStatus: (status: CompanionStatus) => void
  setGameState: (state: GameState) => void
}

const generateId = () => Math.random().toString(36).substring(2, 9)

export const useVoiceAgent = (
  options: UseVoiceAgentOptions = {}
): UseVoiceAgentReturn => {
  const { autoConnect = false, onMessage } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companionStatus, setCompanionStatus] = useState<CompanionStatus>(CompanionStatus.IDLE)
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    gameName: null,
    coverUrl: null,
  })

  const serviceRef = useRef<VoiceAgentService | null>(null)
  const onMessageRef = useRef(onMessage)
  const hasInitialized = useRef(false)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  // Create service only once
  useEffect(() => {
    if (hasInitialized.current) {
      console.log('[useVoiceAgent] Already initialized, skipping')
      return
    }
    hasInitialized.current = true
    console.log('[useVoiceAgent] Initializing service...')

    serviceRef.current = new VoiceAgentService({
      url: VOICE_AGENT_WS_URL,
      onMessage: (agentMsg: AgentMessage) => {
        const message: VoiceAgentMessage = {
          id: generateId(),
          role: convertToDisplayRole(agentMsg.type),
          text: agentMsg.content,
          timestamp: new Date(agentMsg.timestamp || Date.now()),
          suggestions: agentMsg.suggestions,
        }

        // Handle function calls from the agent (e.g. launch_game)
        if (agentMsg.metadata?.functionCalls) {
          const functionCalls = agentMsg.metadata.functionCalls as Array<{
            name: string
            args: Record<string, unknown>
          }>
          for (const fc of functionCalls) {
            if (fc.name === 'launch_game') {
              const { game_name, cover_image } = fc.args as {
                game_name: string
                cover_image?: string
              }
              setGameState({
                isPlaying: true,
                gameName: game_name,
                coverUrl: cover_image || null,
              })
            }
          }
        }

        onMessageRef.current?.(message)
      },
      onConnect: () => {
        setIsConnected(true)
        setIsConnecting(false)
        setCompanionStatus(CompanionStatus.IDLE)
        setError(null)
      },
      onDisconnect: () => {
        setIsConnected(false)
        setCompanionStatus(CompanionStatus.CONNECTING)
      },
      onError: () => {
        setError('Connection error')
        setIsConnecting(false)
      },
    })

    if (autoConnect) {
      setIsConnecting(true)
      setCompanionStatus(CompanionStatus.CONNECTING)
      serviceRef.current.connect()
    }

    return () => {
      serviceRef.current?.disconnect()
      serviceRef.current = null
      hasInitialized.current = false
    }
  }, [])

  const connect = useCallback(() => {
    console.log('[useVoiceAgent] connect() called', {
      hasService: !!serviceRef.current,
      isConnected,
      isConnecting,
    })

    if (!serviceRef.current) {
      console.warn('[useVoiceAgent] Service not initialized')
      return
    }

    if (isConnected) {
      console.log('[useVoiceAgent] Already connected, skipping')
      return
    }

    if (isConnecting) {
      console.log('[useVoiceAgent] Already connecting, skipping')
      return
    }

    setIsConnecting(true)
    setCompanionStatus(CompanionStatus.CONNECTING)
    setError(null)
    serviceRef.current.connect()
  }, [isConnected, isConnecting])

  const disconnect = useCallback(() => {
    serviceRef.current?.disconnect()
    setIsConnected(false)
    setCompanionStatus(CompanionStatus.IDLE)
  }, [])

  const sendMessage = useCallback((text: string) => {
    if (!serviceRef.current?.isConnected) {
      return
    }
    setCompanionStatus(CompanionStatus.LISTENING)
    serviceRef.current.send(text)

    // Simulate talking status after agent responds (will be updated by actual messages)
    setTimeout(() => {
      setCompanionStatus(CompanionStatus.TALKING)
      setTimeout(() => setCompanionStatus(CompanionStatus.IDLE), 1000)
    }, 500)
  }, [])

  return {
    isConnected,
    isConnecting,
    error,
    companionStatus,
    gameState,
    sendMessage,
    connect,
    disconnect,
    setCompanionStatus,
    setGameState,
  }
}

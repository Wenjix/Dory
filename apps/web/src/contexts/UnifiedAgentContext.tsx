/**
 * Unified Agent Context
 * Single context provider for the multi-agent system
 */

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { StateMachine } from '@/services/state-machine'
import { AGENT_URLS, VOICE_AGENT_CONFIG } from '@/config/agent-urls'
import type {
  AppMode,
  ClientState,
  PersonaSummary,
  PersonaData,
} from '@/types/agent.types'

interface UnifiedAgentContextValue {
  state: ClientState
  currentMode: AppMode
  isConnected: boolean
  sendMessage: (text: string) => void
  switchMode: (mode: AppMode, options?: any) => Promise<void>
  resetSession: () => Promise<void>
  personas: PersonaSummary[] | null
  activePersona: { id: string; name: string; tagline?: string; avatar: string | null } | null
  personaData: PersonaData | null
  setPersonaData: (data: Partial<PersonaData>) => void
  resetPersona: () => void
  conversationSummary: string | undefined
  onAuthError: (callback: (message: string) => void) => () => void
  onOperationStatus: (callback: (operation: string, statusText: string, persona?: any) => void) => () => void
  stateMachine: StateMachine | null
}

const UnifiedAgentContext = createContext<UnifiedAgentContextValue | undefined>(undefined)

export function useUnifiedAgent(): UnifiedAgentContextValue {
  const context = useContext(UnifiedAgentContext)
  if (!context) {
    throw new Error('useUnifiedAgent must be used within UnifiedAgentProvider')
  }
  return context
}

interface UnifiedAgentProviderProps {
  children: ReactNode
}

export function UnifiedAgentProvider({ children }: UnifiedAgentProviderProps) {
  const stateMachineRef = useRef<StateMachine | null>(null)
  const fetchingPersonaRef = useRef<string | null>(null) // Track which personaId we're currently fetching

  const [state, setState] = useState<ClientState | null>(null)
  const [personas, setPersonas] = useState<PersonaSummary[] | null>(null)
  const [activePersona, setActivePersona] = useState<{
    id: string
    name: string
    tagline?: string
    avatar: string | null
  } | null>(null)
  const [personaData, setPersonaDataState] = useState<PersonaData | null>(null)
  const [conversationSummary, setConversationSummary] = useState<string | undefined>(undefined)

  // Sync activePersona with state.activePersonaId
  useEffect(() => {
    if (!state?.activePersonaId) {
      if (activePersona) setActivePersona(null)
      return
    }

    if (activePersona && activePersona.id === state.activePersonaId) return

    // Source 1: personas list
    if (personas && personas.length > 0) {
      const persona = personas.find(p => p.id === state.activePersonaId)
      if (persona) {
        setActivePersona({
          id: persona.id,
          name: persona.name,
          tagline: persona.tagline,
          avatar: persona.imageUrl || null,
        })
        return
      }
    }

    // Source 2: personaData from PersonaBuilder
    if (personaData && personaData.name) {
      setActivePersona({
        id: state.activePersonaId,
        name: personaData.name,
        avatar: personaData.imageUrl || null,
      })
      return
    }

    // Source 3: Fetch from API if not found in local sources (e.g., coming from gatekeeper)
    // This ensures personaId is available even if personas list is empty
    // Use a ref to track if we're already fetching to avoid duplicate requests
    if (fetchingPersonaRef.current === state.activePersonaId) {
      // Already fetching this persona, skip
      return
    }

    const fetchPersonaDetails = async () => {
      fetchingPersonaRef.current = state.activePersonaId

      try {
        // Extract base URL from PERSONA_BUILDER WebSocket URL (ws://host:port -> http://host:port)
        const personaWsUrl = AGENT_URLS.PERSONA_BUILDER
        const personaBuilderUrl = personaWsUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '')
        
        console.log(`[UnifiedAgentContext] 🔍 Fetching persona details for ${state.activePersonaId} from ${personaBuilderUrl}`)
        
        const response = await fetch(`${personaBuilderUrl}/api/personas/public/${state.activePersonaId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (response.ok) {
          const data = await response.json()
          const persona = data.persona || data
          
          setActivePersona({
            id: state.activePersonaId,
            name: persona.identity?.name || 'Companion',
            tagline: persona.identity?.tagline,
            avatar: persona.visualIdentity?.avatarUrl || null,
          })
          console.log(`[UnifiedAgentContext] ✅ Fetched persona details from API: ${persona.identity?.name || state.activePersonaId}`)
        } else {
          // API fetch failed, use minimal fallback
          setActivePersona({
            id: state.activePersonaId,
            name: 'Companion',
            avatar: null,
          })
          console.warn(`[UnifiedAgentContext] ⚠️ Failed to fetch persona details (${response.status}), using fallback`)
        }
      } catch (error) {
        console.error('[UnifiedAgentContext] Error fetching persona details:', error)
        // On error, use minimal fallback
        setActivePersona({
          id: state.activePersonaId,
          name: 'Companion',
          avatar: null,
        })
      } finally {
        fetchingPersonaRef.current = null
      }
    }

    fetchPersonaDetails()
  }, [state?.activePersonaId, personas, activePersona, personaData])

  // Initialize state machine only once
  useEffect(() => {
    const stateMachine = new StateMachine(AGENT_URLS, VOICE_AGENT_CONFIG)
    stateMachineRef.current = stateMachine

    const unsubscribeState = stateMachine.onStateChange((newState) => setState(newState))
    const unsubscribePersonas = stateMachine.onPersonaList((newPersonas) => setPersonas(newPersonas))
    const unsubscribeAgentReady = stateMachine.onAgentReady((persona) => setActivePersona(persona))
    const unsubscribePersonaUpdate = stateMachine.onPersonaUpdate((personaUpdate) => {
      setPersonaDataState(prev => ({ ...prev, ...personaUpdate }))
    })

    stateMachine.initialize().then(() => {
      setState(stateMachine.getState())
    })

    return () => {
      unsubscribeState()
      unsubscribePersonas()
      unsubscribeAgentReady()
      unsubscribePersonaUpdate()
      stateMachine.destroy()
    }
  }, [])

  // Sync conversationSummary from StateMachine
  useEffect(() => {
    if (!stateMachineRef.current) return
    const interval = setInterval(() => {
      const summary = stateMachineRef.current?.getConversationSummary()
      if (summary !== conversationSummary) setConversationSummary(summary)
    }, 1000)
    return () => clearInterval(interval)
  }, [conversationSummary])

  const sendMessage = (text: string) => stateMachineRef.current?.sendChatMessage(text)

  const switchMode = async (mode: AppMode, options?: any) => {
    await stateMachineRef.current?.switchMode(mode, options)
  }

  const resetSession = async () => {
    setPersonaDataState(null)
    setPersonas(null)
    setActivePersona(null)
    setConversationSummary(undefined)
    await stateMachineRef.current?.resetSession()
  }

  const setPersonaData = (data: Partial<PersonaData>) => {
    setPersonaDataState(prev => ({ ...prev, ...data }))
  }

  const resetPersona = () => setPersonaDataState(null)

  const onAuthError = (callback: (message: string) => void) => {
    if (stateMachineRef.current) return stateMachineRef.current.onAuthError(callback)
    return () => {}
  }

  const onOperationStatus = (callback: (operation: string, statusText: string, persona?: any) => void) => {
    if (stateMachineRef.current) return stateMachineRef.current.onOperationStatus(callback)
    return () => {}
  }

  const contextValue: UnifiedAgentContextValue = {
    state: state || {
      currentMode: 'GATEKEEPER',
      activePersonaId: null,
      sessionId: '',
      isAuthenticated: true,
    },
    currentMode: state?.currentMode || 'GATEKEEPER',
    isConnected: !!state,
    sendMessage,
    switchMode,
    resetSession,
    personas,
    activePersona,
    personaData,
    setPersonaData,
    resetPersona,
    conversationSummary,
    onAuthError,
    onOperationStatus,
    stateMachine: stateMachineRef.current,
  }

  return (
    <UnifiedAgentContext.Provider value={contextValue}>
      {children}
    </UnifiedAgentContext.Provider>
  )
}

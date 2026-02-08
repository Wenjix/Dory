/**
 * State Machine
 * Central orchestrator for the multi-agent system
 * Based on MULTI_AGENT_FRONTEND_PLAN.md Task 1.3
 *
 * Features:
 * - Centralized state management
 * - WebSocket connection management via WebSocketManager
 * - LiveKit room management for voice mode
 * - State persistence to localStorage
 * - Event-driven architecture
 * - Conversation context preservation between agents
 * - Token expiry handling
 */

import { WebSocketManager, type MessageHandler } from './websocket-manager'
// LiveKit Room type - using any to avoid direct dependency
type Room = any
import type {
  AppMode,
  ClientState,
  WSMessage,
  ModeChangeMessage,
  PersonaListMessage,
  AgentReadyMessage,
  InitMessage,
  VoiceMode,
  VoiceAgentConfig,
  PersonaSummary,
  ErrorMessage,
  PersonaUpdateMessage,
  OperationStatusMessage,
  PersonaData,
} from '@/types/agent.types'

// ==================== LISTENER TYPES ====================

export type StateChangeListener = (state: ClientState) => void
export type ModeChangeListener = (oldMode: AppMode, newMode: AppMode) => void
export type PersonaListListener = (personas: PersonaSummary[]) => void
export type AgentReadyListener = (data: AgentReadyMessage['persona']) => void
export type AuthErrorListener = (message: string) => void
export type PersonaUpdateListener = (data: Partial<PersonaData>) => void
export type OperationStatusListener = (operation: string, statusText: string, persona?: Partial<PersonaData>) => void

// ==================== STATE MACHINE ====================

/**
 * StateMachine - Core orchestrator for multi-agent system
 */
export class StateMachine {
  private state: ClientState
  private wsManager: WebSocketManager
  private liveKitRoom: Room | null = null
  private voiceMode: VoiceMode = 'text'
  private conversationSummary: string | undefined

  // Event listeners
  private stateChangeListeners: StateChangeListener[] = []
  private modeChangeListeners: ModeChangeListener[] = []
  private personaListListeners: PersonaListListener[] = []
  private agentReadyListeners: AgentReadyListener[] = []
  private authErrorListeners: AuthErrorListener[] = []
  private personaUpdateListeners: PersonaUpdateListener[] = []
  private operationStatusListeners: OperationStatusListener[] = []

  // Handler tracking to prevent duplicates
  private registeredHandlers: Map<AppMode, () => void> = new Map()

  constructor(
    agentUrls: Record<AppMode, string>,
    private voiceAgentConfig: VoiceAgentConfig,
    initialState?: Partial<ClientState>
  ) {
    // Initialize state
    const initialMode = (initialState?.currentMode || 'GATEKEEPER') as AppMode
    this.state = {
      currentMode: initialMode,
      activePersonaId: null,
      sessionId: this.getOrCreateSessionId(initialMode),
      isAuthenticated: true,
      ...initialState,
    }

    // Initialize WebSocket manager
    this.wsManager = new WebSocketManager(agentUrls)

    // Restore state from localStorage if available
    this.restoreStateFromStorage()
    
    // On page load/refresh, always create a NEW sessionId (intentional reset - start fresh)
    // Don't restore from localStorage - page refresh = user wants fresh start
    // For unintentional disconnects, WebSocketManager uses stored initMessage with old sessionId
    this.state.sessionId = this.generateSessionId()
    localStorage.setItem(`agent_session_${this.state.currentMode}`, this.state.sessionId)
    console.log('[StateMachine] Created new sessionId on initialization (page load = intentional reset)')
    
    // Clear ALL old sessionIds for non-GATEKEEPER modes on page load
    // Prevents stale sessionIds from being reused when switching modes later
    const modesToClear: AppMode[] = ['PERSONA_BUILDER', 'GAMER_AGENT']
    modesToClear.forEach(mode => {
      localStorage.removeItem(`agent_session_${mode}`)
    })
    
    // Clear conversation summary on page load (new session = fresh start)
    // Stale conversation context from a previous session confuses the backend
    this.conversationSummary = undefined
    localStorage.removeItem('agent_conversationSummary')
    console.log('[StateMachine] Cleared stale conversation summary and non-GATEKEEPER sessionIds on page load')
  }

  // ==================== PUBLIC API ====================

  /**
   * Initialize the state machine and connect to initial agent
   */
  async initialize(): Promise<void> {
    console.log('[StateMachine] Initializing...')
    await this.connectToCurrentMode()
  }

  /**
   * Switch to a different mode
   */
  async switchMode(
    newMode: AppMode,
    options?: {
      personaId?: string
      initialPrompt?: string
    }
  ): Promise<void> {
    const oldMode = this.state.currentMode

    if (oldMode === newMode) {
      console.log(`[StateMachine] Already in ${newMode} mode`)
      return
    }

    console.log(`[StateMachine] Switching from ${oldMode} to ${newMode}`)

    // Disconnect from old agent
    this.wsManager.disconnect(oldMode)

    // Unsubscribe message handler for old mode
    const unsubscribe = this.registeredHandlers.get(oldMode)
    if (unsubscribe) {
      console.log(`[StateMachine] Unsubscribing message handler for ${oldMode}`)
      unsubscribe()
      this.registeredHandlers.delete(oldMode)
    }

    // Get or create sessionId for the new mode
    const newSessionId = this.getOrCreateSessionId(newMode)

    // Update state
    const updates: Partial<ClientState> = {
      currentMode: newMode,
      sessionId: newSessionId,
    }

    if (options?.personaId) {
      updates.activePersonaId = options.personaId
    }

    this.updateState(updates)

    // Connect to new agent
    await this.connectToCurrentMode(options?.initialPrompt)

    // Notify mode change listeners
    this.notifyModeChangeListeners(oldMode, newMode)
  }

  /**
   * Send a chat message to the current agent
   */
  sendChatMessage(text: string): void {
    this.wsManager.sendMessage(this.state.currentMode, {
      type: 'chat',
      role: 'user',
      text,
    })
  }

  /**
   * Get current state (readonly)
   */
  getState(): Readonly<ClientState> {
    return { ...this.state }
  }

  /**
   * Get conversation summary (if available)
   */
  getConversationSummary(): string | undefined {
    return this.conversationSummary
  }

  /**
   * Set conversation summary (for fallback when backend doesn't provide)
   */
  setConversationSummary(summary: string): void {
    this.conversationSummary = summary
    console.log(`[StateMachine] 📝 Conversation summary set manually (${summary.length} chars)`)
  }

  /**
   * Reset session
   * - Generates new session ID
   * - Clears conversation context
   * - Disconnects all agents
   * - Returns to GATEKEEPER mode
   * - Keeps auth token intact
   * - Clears ALL sessionIds for all modes (intentional reset - start fresh)
   */
  async resetSession(): Promise<void> {
    console.log('[StateMachine] 🔄 Resetting session (intentional reset - starting fresh)...')

    // Disconnect all agents
    console.log('[StateMachine] Disconnecting all agents...')
    this.wsManager.disconnectAll()

    // Clear all registered message handlers so fresh ones are created on reconnect
    this.registeredHandlers.forEach((unsubscribe, mode) => {
      console.log(`[StateMachine] Unsubscribing handler for ${mode}`)
      unsubscribe()
    })
    this.registeredHandlers.clear()

    // Clear conversation summary from memory AND storage
    this.conversationSummary = undefined
    localStorage.removeItem('agent_conversationSummary')

    // Clear ALL sessionIds for all modes (intentional reset - don't restore from backend)
    const modes: AppMode[] = ['GATEKEEPER', 'PERSONA_BUILDER', 'GAMER_AGENT']
    modes.forEach(mode => {
      localStorage.removeItem(`agent_session_${mode}`)
    })
    console.log('[StateMachine] Cleared all sessionIds and conversation summary')
    
    // Generate new session ID for GATEKEEPER mode (fresh start)
    const newSessionId = this.generateSessionId()
    localStorage.setItem('agent_session_GATEKEEPER', newSessionId)
    console.log('[StateMachine] New session ID for GATEKEEPER:', newSessionId.substring(0, 25))

    this.updateState({
      currentMode: 'GATEKEEPER',
      activePersonaId: null,
      sessionId: newSessionId,
      isAuthenticated: true,
    })

    // Wait for clean disconnect before reconnecting
    await new Promise(resolve => setTimeout(resolve, 200))

    // Reconnect to GATEKEEPER with completely fresh session
    console.log('[StateMachine] Reconnecting to GATEKEEPER with fresh session...')
    await this.connectToCurrentMode()

    console.log('[StateMachine] ✅ Session reset complete')
  }

  /**
   * Set voice mode (text or voice)
   */
  setVoiceMode(mode: VoiceMode): void {
    this.voiceMode = mode
    console.log(`[StateMachine] Voice mode set to: ${mode}`)
  }

  /**
   * Get LiveKit room (for voice mode)
   */
  getLiveKitRoom(): Room | null {
    return this.liveKitRoom
  }

  /**
   * Set LiveKit room (managed externally by GamingHub)
   */
  setLiveKitRoom(room: Room | null): void {
    this.liveKitRoom = room
  }

  // ==================== EVENT LISTENERS ====================

  /**
   * Subscribe to state changes
   */
  onStateChange(listener: StateChangeListener): () => void {
    this.stateChangeListeners.push(listener)
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(l => l !== listener)
    }
  }

  /**
   * Subscribe to mode changes
   */
  onModeChange(listener: ModeChangeListener): () => void {
    this.modeChangeListeners.push(listener)
    return () => {
      this.modeChangeListeners = this.modeChangeListeners.filter(l => l !== listener)
    }
  }

  /**
   * Subscribe to persona list messages
   */
  onPersonaList(listener: PersonaListListener): () => void {
    this.personaListListeners.push(listener)
    return () => {
      this.personaListListeners = this.personaListListeners.filter(l => l !== listener)
    }
  }

  /**
   * Subscribe to agent ready messages
   */
  onAgentReady(listener: AgentReadyListener): () => void {
    this.agentReadyListeners.push(listener)
    return () => {
      this.agentReadyListeners = this.agentReadyListeners.filter(l => l !== listener)
    }
  }

  /**
   * Subscribe to auth error messages
   */
  onAuthError(listener: AuthErrorListener): () => void {
    this.authErrorListeners.push(listener)
    return () => {
      this.authErrorListeners = this.authErrorListeners.filter(l => l !== listener)
    }
  }

  /**
   * Subscribe to persona update messages
   */
  onPersonaUpdate(listener: PersonaUpdateListener): () => void {
    this.personaUpdateListeners.push(listener)
    return () => {
      this.personaUpdateListeners = this.personaUpdateListeners.filter(l => l !== listener)
    }
  }

  /**
   * Subscribe to operation status messages (long-running operations)
   */
  onOperationStatus(listener: OperationStatusListener): () => void {
    this.operationStatusListeners.push(listener)
    return () => {
      this.operationStatusListeners = this.operationStatusListeners.filter(l => l !== listener)
    }
  }

  /**
   * Subscribe to raw WebSocket messages for a specific mode
   * Returns unsubscribe function
   */
  onMessage(mode: AppMode, handler: MessageHandler): () => void {
    return this.wsManager.onMessage(mode, handler)
  }

  // ==================== LIFECYCLE ====================

  /**
   * Cleanup and disconnect
   */
  async destroy(): Promise<void> {
    console.log('[StateMachine] Destroying...')

    // Unsubscribe all message handlers
    this.registeredHandlers.forEach((unsubscribe, mode) => {
      console.log(`[StateMachine] Unsubscribing handler for ${mode}`)
      unsubscribe()
    })
    this.registeredHandlers.clear()

    // Disconnect all WebSocket connections
    this.wsManager.disconnectAll()

    // Clear conversation summary
    this.conversationSummary = undefined

    // LiveKit cleanup handled by GamingHub's SessionProvider
    this.liveKitRoom = null

    this.persistStateToStorage()
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Connect to the current mode's agent
   * @param initialPrompt - Optional initial prompt to send
   * @param preserveSummary - If true, don't clear conversationSummary after connection (for auth reconnects)
   */
  private async connectToCurrentMode(initialPrompt?: string): Promise<void> {
    // For GAMER_AGENT mode, skip WebSocket connection
    // All communication (voice + text) goes through LiveKit WebRTC
    if (this.state.currentMode === 'GAMER_AGENT') {
      console.log('[StateMachine] Skipping WebSocket for GAMER_AGENT - using LiveKit only')
      return
    }

    console.log('[StateMachine] 🔗 Connecting to', this.state.currentMode, '- conversationSummary available:', !!this.conversationSummary)

    await this.connectViaWebSocket(initialPrompt)

    // Register message handler for this mode (only if not already registered)
    if (!this.registeredHandlers.has(this.state.currentMode)) {
      console.log(`[StateMachine] Registering message handler for ${this.state.currentMode}`)
      const unsubscribe = this.wsManager.onMessage(this.state.currentMode, (message) => {
        this.handleMessage(message)
      })
      this.registeredHandlers.set(this.state.currentMode, unsubscribe)
    } else {
      console.log(`[StateMachine] Message handler already registered for ${this.state.currentMode}`)
    }
  }

  /**
   * Connect via WebSocket (used by all agents in text mode)
   * @param initialPrompt - Optional initial prompt to send
   * @param preserveSummary - If true, don't clear conversationSummary after connection (for auth reconnects)
   */
  private async connectViaWebSocket(initialPrompt?: string): Promise<void> {
    const initMessage: InitMessage = {
      type: 'init',
      sessionId: this.state.sessionId,
      timestamp: new Date().toISOString(),
    }

    // Add optional parameters
    if (this.state.activePersonaId) {
      initMessage.personaId = this.state.activePersonaId
    }

    if (initialPrompt) {
      initMessage.initialPrompt = initialPrompt
    }

    // Include conversation summary if available (for context preservation)
    if (this.conversationSummary) {
      initMessage.conversationSummary = this.conversationSummary
      console.log(`[StateMachine] 📝 Passing conversation context to ${this.state.currentMode}`)
    }

    // Connect to agent
    await this.wsManager.connect(this.state.currentMode, initMessage)

    // Preserve conversation summary for future reconnections
    // Only clear on explicit session reset, not on normal reconnects
    // This enables backend to restore conversation context
    if (this.conversationSummary) {
      this.persistConversationSummary()
      console.log(`[StateMachine] Preserving conversation context for future reconnections`)
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(message: WSMessage): void {
    console.log(`[StateMachine] Received message:`, message.type)

    switch (message.type) {
      case 'mode_change':
        this.handleModeChange(message as ModeChangeMessage)
        break

      case 'persona_list':
        this.handlePersonaList(message as PersonaListMessage)
        break

      case 'agent_ready':
        this.handleAgentReady(message as AgentReadyMessage)
        break

      case 'persona_update':
        this.handlePersonaUpdate(message as PersonaUpdateMessage)
        break

      case 'operation_status':
        this.handleOperationStatus(message as OperationStatusMessage)
        break

      case 'error': {
        const errorMsg = message as ErrorMessage
        console.error('[StateMachine] Error from agent:', errorMsg.message)
        window.dispatchEvent(new CustomEvent('agent-error', {
          detail: { message: errorMsg.message }
        }))
        break
      }

      case 'chat':
        // Chat and system messages are handled by UI components
        break

      default:
        console.log(`[StateMachine] Unhandled message type: ${message.type}`)
    }
  }

  /**
   * Handle mode_change message from backend
   * This is how backend triggers mode switches!
   */
  private async handleModeChange(message: ModeChangeMessage): Promise<void> {
    console.log(`[StateMachine] 🔄 Backend requested mode change to ${message.mode}`)

    // Store conversation summary if provided
    if (message.conversationSummary) {
      console.log(`[StateMachine] 📝 Received conversation context (${message.conversationSummary.length} chars): ${message.conversationSummary.substring(0, 100)}...`)
      this.conversationSummary = message.conversationSummary
      this.persistConversationSummary() // Persist for future reconnections
    } else {
      console.log('[StateMachine] ⚠️ No conversation summary provided in mode_change message')
    }

    await this.switchMode(message.mode, {
      personaId: message.personaId,
      initialPrompt: message.initialPrompt,
    })
  }

  /**
   * Handle persona_list message
   */
  private handlePersonaList(message: PersonaListMessage): void {
    console.log(`[StateMachine] Received ${message.personas.length} personas`)

    // Notify listeners (UI will display persona selection)
    this.personaListListeners.forEach(listener => {
      try {
        listener(message.personas)
      } catch (error) {
        console.error('[StateMachine] Error in persona list listener:', error)
      }
    })
  }

  /**
   * Handle agent_ready message
   */
  private handleAgentReady(message: AgentReadyMessage): void {
    console.log(`[StateMachine] Agent ready with persona: ${message.persona.name}`)

    // Update state with active persona
    this.updateState({
      activePersonaId: message.persona.id,
    })

    // Notify listeners (UI will show game interface)
    this.agentReadyListeners.forEach(listener => {
      try {
        listener(message.persona)
      } catch (error) {
        console.error('[StateMachine] Error in agent ready listener:', error)
      }
    })
  }

  /**
   * Handle persona_update message
   */
  private handlePersonaUpdate(message: PersonaUpdateMessage): void {
    console.log(`[StateMachine] Persona update received:`, message.persona)

    // Notify listeners (UI will update persona data)
    this.personaUpdateListeners.forEach(listener => {
      try {
        listener(message.persona)
      } catch (error) {
        console.error('[StateMachine] Error in persona update listener:', error)
      }
    })
  }

  /**
   * Handle operation_status message
   */
  private handleOperationStatus(message: OperationStatusMessage): void {
    console.log(`[StateMachine] Operation status: ${message.operation} - ${message.statusText}`)

    // Notify listeners (UI will show loading state)
    this.operationStatusListeners.forEach(listener => {
      try {
        listener(message.operation, message.statusText, message.persona)
      } catch (error) {
        console.error('[StateMachine] Error in operation status listener:', error)
      }
    })
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<ClientState>): void {
    this.state = {
      ...this.state,
      ...updates,
    }

    // Persist to localStorage
    this.persistStateToStorage()

    // Notify listeners
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(this.state)
      } catch (error) {
        console.error('[StateMachine] Error in state change listener:', error)
      }
    })
  }

  /**
   * Notify mode change listeners
   */
  private notifyModeChangeListeners(oldMode: AppMode, newMode: AppMode): void {
    this.modeChangeListeners.forEach(listener => {
      try {
        listener(oldMode, newMode)
      } catch (error) {
        console.error('[StateMachine] Error in mode change listener:', error)
      }
    })
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Get or create sessionId for a specific mode
   * 
   * Behavior:
   * - If sessionId exists in localStorage: Returns it (enables backend restoration for unintentional disconnects)
   * - If not: Creates new sessionId and stores it
   * 
   * Note: On page refresh, this will create a NEW sessionId (intentional reset - start fresh)
   * For unintentional disconnects, WebSocketManager uses stored initMessage with old sessionId
   */
  private getOrCreateSessionId(mode: AppMode): string {
    const storageKey = `agent_session_${mode}`
    const stored = localStorage.getItem(storageKey)
    
    if (stored) {
      console.log(`[StateMachine] Restored sessionId for ${mode}: ${stored.substring(0, 20)}...`)
      return stored
    }
    
    const newSessionId = this.generateSessionId()
    localStorage.setItem(storageKey, newSessionId)
    console.log(`[StateMachine] Created new sessionId for ${mode}: ${newSessionId.substring(0, 20)}...`)
    return newSessionId
  }

  /**
   * Persist state to localStorage
   */
  private persistStateToStorage(): void {
    try {
      localStorage.setItem('agent_state', JSON.stringify(this.state))
    } catch (error) {
      console.error('[StateMachine] Failed to persist state:', error)
    }
  }

  /**
   * Restore state from localStorage
   * Note: On page refresh, we start fresh (don't restore sessionIds) to avoid restoring from backend
   * SessionIds are only preserved for unintentional disconnects (network issues)
   */
  private restoreStateFromStorage(): void {
    // No-auth version: always start fresh in GATEKEEPER mode
    // No state restoration needed - isAuthenticated is always true
  }

  /**
   * Persist conversation summary to localStorage
   */
  private persistConversationSummary(): void {
    try {
      if (this.conversationSummary) {
        localStorage.setItem('agent_conversationSummary', this.conversationSummary)
        console.log('[StateMachine] Persisted conversation summary to localStorage')
      } else {
        // Clear if summary is undefined
        localStorage.removeItem('agent_conversationSummary')
      }
    } catch (error) {
      console.error('[StateMachine] Failed to persist conversation summary:', error)
    }
  }

  /**
   * Restore conversation summary from localStorage
   */
  private restoreConversationSummary(): void {
    try {
      const stored = localStorage.getItem('agent_conversationSummary')
      if (stored) {
        this.conversationSummary = stored
        console.log(`[StateMachine] Restored conversation summary from localStorage (${stored.length} chars)`)
      }
    } catch (error) {
      console.error('[StateMachine] Failed to restore conversation summary:', error)
    }
  }
}

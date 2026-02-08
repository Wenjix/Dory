/**
 * Unified Agent Types
 * Single source of truth for all multi-agent system types
 * Based on MULTI_AGENT_FRONTEND_PLAN.md specification
 */

// ==================== APPLICATION MODES ====================

/** Application modes for different agent types */
export type AppMode = 'GATEKEEPER' | 'PERSONA_BUILDER' | 'GAMER_AGENT'

/** Voice interaction mode */
export type VoiceMode = 'text' | 'voice'

// ==================== MESSAGE TYPES ====================

/** WebSocket message types for agent communication */
export type MessageType =
  | 'init'
  | 'chat'
  | 'mode_change'
  | 'persona_list'
  | 'agent_ready'
  | 'error'
  | 'persona_saved'
  | 'persona_update'
  | 'operation_status'

/** Base message interface - all messages extend this */
export interface BaseMessage {
  type: MessageType
  timestamp: string
}

// ==================== SPECIFIC MESSAGE INTERFACES ====================

/**
 * Init message - sent from client to agent on connection
 * Used to initialize agent session with context
 */
export interface InitMessage extends BaseMessage {
  type: 'init'
  sessionId: string
  personaId?: string
  initialPrompt?: string
  conversationSummary?: string  // Context from previous agent
}

/**
 * Chat message - bidirectional text communication
 */
export interface ChatMessage extends BaseMessage {
  type: 'chat'
  role: 'user' | 'assistant'
  text: string
  persona?: string
  suggestions?: string[]
}

/**
 * Mode change message - sent from agent to client
 * Triggers frontend to switch to a different agent/mode
 */
export interface ModeChangeMessage extends BaseMessage {
  type: 'mode_change'
  mode: AppMode
  personaId?: string
  initialPrompt?: string
  conversationSummary?: string  // Context to pass to next agent
}

/**
 * Persona summary - lightweight persona info
 */
export interface PersonaSummary {
  id: string
  name: string
  tagline?: string
  description?: string
  imageUrl?: string | null
}

/**
 * Persona list message - available personas for selection
 */
export interface PersonaListMessage extends BaseMessage {
  type: 'persona_list'
  personas: PersonaSummary[]
}

/**
 * Agent ready message - sent when gaming agent finishes initializing
 */
export interface AgentReadyMessage extends BaseMessage {
  type: 'agent_ready'
  persona: {
    id: string
    name: string
    tagline?: string
    avatar: string | null
  }
}

/**
 * Persona saved message - confirmation that persona was created/saved
 */
export interface PersonaSavedMessage extends BaseMessage {
  type: 'persona_saved'
  personaId: string
  persona: PersonaData
  message?: string
}

/**
 * Persona update message - real-time persona updates during creation
 */
export interface PersonaUpdateMessage extends BaseMessage {
  type: 'persona_update'
  personaId?: string
  persona: Partial<PersonaData>
  message?: string
}

/**
 * Operation status message - progress updates for long-running operations
 */
export interface OperationStatusMessage extends BaseMessage {
  type: 'operation_status'
  operation: 'generating_avatar' | 'uploading' | 'extracting_colors'
  statusText: string  // e.g., "Generating Image...", "Uploading...", "Extracting colors..."
  persona?: Partial<PersonaData>  // Current persona state (refresh UI with this)
}

/**
 * Error message - error from agent
 */
export interface ErrorMessage extends BaseMessage {
  type: 'error'
  message: string
  code?: string
}

/**
 * Union type for all possible WebSocket messages
 */
export type WSMessage =
  | InitMessage
  | ChatMessage
  | ModeChangeMessage
  | PersonaListMessage
  | AgentReadyMessage
  | PersonaSavedMessage
  | PersonaUpdateMessage
  | OperationStatusMessage
  | ErrorMessage

// ==================== PERSONA DATA ====================

/**
 * Complete persona data structure
 */
export interface PersonaData {
  id?: string
  name?: string
  imageUrl?: string
  primaryColor?: string
  secondaryColor?: string
  personalityDescription?: string
  gamingDescription?: string
}

// ==================== CLIENT STATE ====================

/**
 * Global client state managed by StateMachine
 */
export interface ClientState {
  currentMode: AppMode
  activePersonaId: string | null
  sessionId: string
  isAuthenticated: boolean
}

// ==================== CONNECTION STATUS ====================

/**
 * WebSocket connection status
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * Companion status for UI feedback (gaming agent)
 */
export enum CompanionStatus {
  IDLE = 'idle',
  LISTENING = 'listening',
  TALKING = 'talking',
  CONNECTING = 'connecting',
}

// ==================== CONFIGURATION ====================

/**
 * Agent configuration for WebSocket connection
 */
export interface AgentConfig {
  mode: AppMode
  url: string
  retryAttempts: number
  retryDelay: number
}

/**
 * Voice agent specific configuration
 */
export interface VoiceAgentConfig {
  wsUrl: string        // WebSocket URL for text mode
  liveKitUrl: string   // LiveKit URL for voice mode (WebRTC)
  apiUrl: string       // API URL for getting room tokens
}

// ==================== GAME STATE ====================

/**
 * Game state tracked by voice/gaming agent
 */
export interface GameState {
  isPlaying: boolean
  gameName: string | null
  coverUrl: string | null
}

// ==================== LEGACY TYPES (for gradual migration) ====================

/**
 * @deprecated Use WSMessage union type instead
 * Legacy agent message type - kept for backwards compatibility
 */
export interface AgentMessage {
  type: string
  content: string
  timestamp?: string
  metadata?: Record<string, unknown>
  suggestions?: string[]
  personaId?: string
  persona?: PersonaData
}

/**
 * UI Display role for chat bubbles
 */
export type DisplayRole = 'user' | 'model' | 'system'

// ==================== TYPE GUARDS ====================

/**
 * Type guard to check if message is a mode change
 */
export function isModeChangeMessage(message: WSMessage): message is ModeChangeMessage {
  return message.type === 'mode_change'
}

/**
 * Type guard to check if message is a persona list
 */
export function isPersonaListMessage(message: WSMessage): message is PersonaListMessage {
  return message.type === 'persona_list'
}

/**
 * Type guard to check if message is agent ready
 */
export function isAgentReadyMessage(message: WSMessage): message is AgentReadyMessage {
  return message.type === 'agent_ready'
}

/**
 * Type guard to check if message is a chat message
 */
export function isChatMessage(message: WSMessage): message is ChatMessage {
  return message.type === 'chat'
}

/**
 * Type guard to check if message is an error
 */
export function isErrorMessage(message: WSMessage): message is ErrorMessage {
  return message.type === 'error'
}

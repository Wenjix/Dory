/**
 * Unified Agent Message System
 * Single source of truth for message parsing and role conversion
 * Used by all agent services (Gatekeeper, Persona, etc.)
 */

// ==================== PERSONA DATA TYPES ====================

export interface AgentMessagePersonaData {
  id?: string                      // Persona ID (after saved)
  name?: string                    // Character name
  imageUrl?: string                // Avatar URL
  primaryColor?: string            // Primary theme color
  secondaryColor?: string          // Secondary theme color
  personalityDescription?: string  // Generated text like "A stoic protector..."
  gamingDescription?: string       // Generated text like "An aggressive fighter..."
}

// ==================== MESSAGE TYPES ====================

/**
 * All possible message types any agent can send
 */
export type AgentMessageType =
  | 'user'
  | 'agent'
  | 'chat'
  | 'system'
  | 'error'
  | 'persona_saved'
  | 'persona_update'
  | 'mode_change'
  | 'persona_list'
  | 'agent_ready'

/**
 * Unified message interface for ALL agents
 */
export interface AgentMessage {
  type: AgentMessageType
  content: string
  timestamp?: string
  metadata?: Record<string, unknown>
  suggestions?: string[]
  // Persona-related fields (used by any agent that handles personas)
  personaId?: string
  persona?: AgentMessagePersonaData
}

/**
 * UI Display role for chat bubbles
 */
export type DisplayRole = 'user' | 'model' | 'system'

// ==================== PARSER ====================

/**
 * Parse raw WebSocket data into a unified AgentMessage
 * Handles all known message formats from any agent backend
 */
export function parseAgentMessage(data: unknown): AgentMessage {
  if (typeof data === 'object' && data !== null) {
    const msg = data as Record<string, unknown>
    const suggestions = Array.isArray(msg.suggestions) ? msg.suggestions as string[] : undefined

    // Check for chat message with role: assistant (backend format)
    if (msg.type === 'chat' && msg.role === 'assistant') {
      return {
        type: 'chat',
        content: (msg.text as string) || (msg.content as string) || '',
        timestamp: (msg.timestamp as string) || new Date().toISOString(),
        suggestions,
      }
    }

    // Check for persona_saved message
    if (msg.type === 'persona_saved') {
      return {
        type: 'persona_saved',
        content: (msg.content as string) || 'Persona created successfully!',
        timestamp: (msg.timestamp as string) || new Date().toISOString(),
        personaId: msg.personaId as string,
        persona: msg.persona as AgentMessagePersonaData,
        suggestions,
      }
    }

    // Check for persona_update message
    if (msg.type === 'persona_update' || msg.persona) {
      return {
        type: 'persona_update',
        content: (msg.content as string) || '',
        timestamp: (msg.timestamp as string) || new Date().toISOString(),
        metadata: msg.metadata as Record<string, unknown>,
        personaId: msg.personaId as string,
        persona: msg.persona as AgentMessagePersonaData,
        suggestions,
      }
    }

    // Check for mode_change message (backend-initiated mode switch)
    if (msg.type === 'mode_change') {
      return {
        type: 'mode_change',
        content: (msg.message as string) || '',
        timestamp: (msg.timestamp as string) || new Date().toISOString(),
        metadata: {
          mode: msg.mode,
          personaId: msg.personaId,
          accessToken: msg.accessToken,
          expiresAt: msg.expiresAt,
          initialPrompt: msg.initialPrompt,
          conversationSummary: msg.conversationSummary,
        },
      }
    }

    // Check for persona_list message (available personas)
    if (msg.type === 'persona_list') {
      return {
        type: 'persona_list',
        content: '',
        timestamp: (msg.timestamp as string) || new Date().toISOString(),
        metadata: {
          personas: msg.personas || [],
        },
      }
    }

    // Check for agent_ready message (gaming agent initialized)
    if (msg.type === 'agent_ready') {
      return {
        type: 'agent_ready',
        content: '',
        timestamp: (msg.timestamp as string) || new Date().toISOString(),
        metadata: {
          persona: msg.persona,
        },
      }
    }

    // Standard message with type field
    if ('type' in msg && ('content' in msg || 'text' in msg)) {
      return {
        type: (msg.type as string) === 'assistant' ? 'agent' : (msg.type as AgentMessageType),
        content: (msg.content as string) || (msg.text as string) || '',
        timestamp: (msg.timestamp as string) || new Date().toISOString(),
        metadata: msg.metadata as Record<string, unknown>,
        suggestions,
      }
    }

    // Legacy formats: message or text field
    if ('message' in msg || 'text' in msg) {
      return {
        type: 'agent',
        content: (msg.message || msg.text) as string,
        timestamp: new Date().toISOString(),
        suggestions,
      }
    }

    // Legacy format: response field
    if ('response' in msg) {
      return {
        type: 'agent',
        content: msg.response as string,
        timestamp: new Date().toISOString(),
      }
    }
  }

  // Fallback: treat as agent message
  return {
    type: 'agent',
    content: String(data),
    timestamp: new Date().toISOString(),
  }
}

// ==================== ROLE CONVERTER ====================

/** Types that represent agent/model responses */
const AGENT_TYPES: AgentMessageType[] = ['agent', 'chat', 'persona_saved', 'persona_update']

/** Types that represent system messages */
const SYSTEM_TYPES: AgentMessageType[] = ['system', 'error']

/**
 * Convert AgentMessageType to UI DisplayRole
 * Used by hooks to determine how to display messages in chat
 */
export function convertToDisplayRole(type: AgentMessageType): DisplayRole {
  if (AGENT_TYPES.includes(type)) return 'model'
  if (SYSTEM_TYPES.includes(type)) return 'system'
  if (type === 'user') return 'user'
  // Fallback: messages from WebSocket are agent responses, not user
  return 'model'
}

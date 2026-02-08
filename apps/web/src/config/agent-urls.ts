/**
 * Agent URL Configuration
 * Centralized configuration for all agent WebSocket URLs
 */

import type { AppMode, VoiceAgentConfig } from '@/types/agent.types'

/**
 * WebSocket URLs for each agent mode
 */
export const AGENT_URLS: Record<AppMode, string> = {
  GATEKEEPER: process.env.NEXT_PUBLIC_GATEKEEPER_WS_URL || 'ws://localhost:4002/ws',
  PERSONA_BUILDER: process.env.NEXT_PUBLIC_PERSONA_WS_URL || 'ws://localhost:4003/ws',
  GAMER_AGENT: process.env.NEXT_PUBLIC_VOICE_AGENT_WS_URL || 'ws://localhost:4001/ws',
}

/**
 * Voice agent configuration (supports both text and voice modes)
 */
export const VOICE_AGENT_CONFIG: VoiceAgentConfig = {
  wsUrl: process.env.NEXT_PUBLIC_VOICE_AGENT_WS_URL || 'ws://localhost:4001/ws',
  liveKitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://localhost:7880',
  apiUrl: process.env.NEXT_PUBLIC_VOICE_AGENT_API_URL || 'http://localhost:4001',
}

/**
 * Validate that all required URLs are configured
 */
export function validateAgentUrls(): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  if (!process.env.NEXT_PUBLIC_GATEKEEPER_WS_URL) {
    missing.push('NEXT_PUBLIC_GATEKEEPER_WS_URL')
  }
  if (!process.env.NEXT_PUBLIC_PERSONA_WS_URL) {
    missing.push('NEXT_PUBLIC_PERSONA_WS_URL')
  }
  if (!process.env.NEXT_PUBLIC_VOICE_AGENT_WS_URL) {
    missing.push('NEXT_PUBLIC_VOICE_AGENT_WS_URL')
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}

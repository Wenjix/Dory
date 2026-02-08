// Voice Agent URL from environment
const VOICE_AGENT_URL = process.env.NEXT_PUBLIC_VOICE_AGENT_API_URL || 'http://localhost:4001'

// Agent configuration for LiveKit WebRTC
export const AGENT_CONFIG = {
  // LiveKit configuration
  voiceAgentUrl: VOICE_AGENT_URL,
  tokenEndpoint: `${VOICE_AGENT_URL}/api/room-token`,
  agentName: undefined as string | undefined,

  // UI configuration
  scrollThreshold: 10,
  sentenceThreshold: 5,

  // Default messages
  initialMessage: 'System initialized. Communication protocol active.',
  offlineMessage: 'Agent not available...',
  inputPlaceholder: 'Type a message or speak...',

  // Call states
  callStates: {
    idle: 'idle',
    connecting: 'connecting',
    connected: 'connected',
    disconnecting: 'disconnecting',
    error: 'error',
  } as const,

  // Agent states
  agentStates: {
    idle: 'idle',
    listening: 'listening',
    thinking: 'thinking',
    speaking: 'speaking',
  } as const,
} as const;

export type CallState = typeof AGENT_CONFIG.callStates[keyof typeof AGENT_CONFIG.callStates];
export type AgentState = typeof AGENT_CONFIG.agentStates[keyof typeof AGENT_CONFIG.agentStates];

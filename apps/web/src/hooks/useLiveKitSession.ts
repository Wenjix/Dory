import { useMemo, useCallback } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { AGENT_CONFIG } from '../config/agent.config';

// Type for LiveKit connection details (internal format)
interface LiveKitConnectionDetails {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
}

// Type for backend API response
interface RoomTokenResponse {
  token: string;
  roomName: string;
  wsUrl: string;
  identity: string;
}

interface UseLiveKitSessionOptions {
  agentName?: string;
  personaId?: string;
  conversationSummary?: string;
}

/**
 * Generate a unique room name
 */
const generateRoomName = (): string => {
  return `room-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Get connection details from backend API
 * No auth required in Dory — uses hardcoded user-123
 */
const getConnectionDetailsFromBackend = async (
  agentName?: string,
  personaId?: string,
  conversationSummary?: string
): Promise<LiveKitConnectionDetails> => {
  if (!AGENT_CONFIG.tokenEndpoint) {
    throw new Error('Voice agent URL not configured. Set NEXT_PUBLIC_VOICE_AGENT_API_URL environment variable.');
  }

  const roomName = generateRoomName();

  console.log('[useLiveKitSession] Requesting room token:', {
    endpoint: AGENT_CONFIG.tokenEndpoint,
    roomName,
    agentName,
    personaId,
    conversationSummary: conversationSummary ? '(provided)' : '(none)',
  });

  const response = await fetch(AGENT_CONFIG.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      roomName,
      identity: 'user-123',
      ...(agentName && { agentName }),
      ...(personaId && { personaId }),
      ...(conversationSummary && { conversationSummary }),
    }),
  });

  console.log('[useLiveKitSession] Response received:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[useLiveKitSession] Error response:', errorText);
    throw new Error(`Failed to get room token: ${errorText || response.statusText}`);
  }

  const data: RoomTokenResponse = await response.json();
  console.log('[useLiveKitSession] ✅ Token received successfully:', {
    roomName: data.roomName,
    hasToken: !!data.token,
    wsUrl: data.wsUrl,
    personaId: personaId || '(none)',
  });

  return {
    serverUrl: data.wsUrl,
    roomName: data.roomName,
    participantName: data.identity,
    participantToken: data.token,
  };
};

/**
 * Custom hook that wraps LiveKit's useSession with project-specific configuration.
 * Uses backend endpoint for token generation (no auth required in Dory).
 */
export const useLiveKitSession = (options?: UseLiveKitSessionOptions) => {
  const {
    agentName = AGENT_CONFIG.agentName,
    personaId,
    conversationSummary
  } = options || {};

  // Create token source that calls backend API
  const tokenSource = useMemo(() => {
    return TokenSource.custom(async () => {
      return await getConnectionDetailsFromBackend(agentName, personaId, conversationSummary);
    });
  }, [agentName, personaId, conversationSummary]);

  // Initialize the session with token source and optional agent configuration
  const session = useSession(
    tokenSource,
    agentName ? { agentName } : undefined
  );

  // Memoized start handler
  const startCall = useCallback(() => {
    session.start();
  }, [session]);

  // Memoized end handler
  const endCall = useCallback(() => {
    session.end();
  }, [session]);

  return {
    session,
    tokenSource,
    isConnected: session.isConnected,
    start: startCall,
    end: endCall,
  };
};

export default useLiveKitSession;

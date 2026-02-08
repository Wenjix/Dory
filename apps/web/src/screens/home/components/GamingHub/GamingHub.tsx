/**
 * GamingHub Component
 * 2-column layout: Left companion sidebar + Right chat
 * Follows the PersonaBuilder pattern — receives messages/handlers as props
 * from GatekeeperChat, reuses ChatBubble + ChatComposer.
 * 
 * Now includes LiveKit WebRTC voice integration:
 * - Outer component provides SessionProvider
 * - Inner component uses LiveKit hooks for voice calls
 */

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { ArrowLeft, MessageSquare, ChevronDown, ChevronUp, Sparkles, Phone } from 'lucide-react'
import {
  SessionProvider,
  useSessionContext,
  useSessionMessages,
  useChat,
  useRemoteParticipants,
  useTrackToggle,
  useVoiceAssistant,
  useLocalParticipant,
  RoomAudioRenderer,
  StartAudio,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import { useLiveKitSession } from '@/hooks/useLiveKitSession'
import { useUnifiedAgent } from '@/contexts/UnifiedAgentContext'

// Pink accent color for gaming mode
const GAMING_PINK = '#ec4899'
import type { Message } from '../GatekeeperChat/GatekeeperChat'
import { CompanionStatus } from '../../hooks/useVoiceAgent'
import { ChatBubble } from '../GatekeeperChat/ChatBubble'
import { ChatComposer } from '../GatekeeperChat/ChatComposer'
import { CompanionCard } from './CompanionCard'
import { GameStatusCard } from './GameStatusCard'
import { ChatHistoryList } from './ChatHistoryList'
import * as S from './GamingHub.styled'

// ==================== LOCAL CONNECTING LOADER STYLES ====================

const spinLoader = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const connectingPulse = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
`

const ConnectingContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`

const ConnectingSpinner = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 3px solid rgba(236, 72, 153, 0.15);
  border-top-color: #ec4899;
  animation: ${spinLoader} 0.8s linear infinite;
  box-shadow: 0 0 24px rgba(236, 72, 153, 0.2);
`

const ConnectingLabel = styled.span`
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: #ec4899;
  animation: ${connectingPulse} 1.6s ease-in-out infinite;
`

// ==================== TYPES ====================

export interface GamingHubProps {
  messages: Message[]
  inputValue: string
  isLoading: boolean
  isConnected: boolean
  onInputChange: (value: string) => void
  onSendMessage: (text: string) => void
  onBack?: () => void
  onLoginClick?: () => void
}

// ==================== INNER COMPONENT (uses LiveKit hooks) ====================

interface GamingHubInnerProps extends GamingHubProps {}

const GamingHubInner: React.FC<GamingHubInnerProps> = ({
  messages: wsMessages,
  inputValue,
  isLoading,
  isConnected: wsConnected,
  onInputChange,
  onSendMessage,
  onBack,
  onLoginClick,
}) => {
  console.log('[GamingHubInner] Component rendering with props:', {
    wsConnected,
    isLoading,
    messagesCount: wsMessages.length,
  })

  const isAuthenticated = true // No auth in Dory
  const { activePersona } = useUnifiedAgent()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  // LiveKit hooks
  const sessionContext = useSessionContext()
  const { isConnected: liveKitConnected, start: originalStart, end: originalEnd } = sessionContext

  console.log('[GamingHubInner] LiveKit context:', {
    liveKitConnected,
    sessionContextExists: !!sessionContext,
    hasStart: !!originalStart,
    hasEnd: !!originalEnd,
    sessionContextType: typeof sessionContext,
    startType: typeof originalStart,
  })

  // Wrap start() with debug logging + 2s connecting loader
  const start = useCallback(async () => {
    console.log('[GamingHubInner] 🚀 START CALLED - Beginning LiveKit connection')
    console.log('[GamingHubInner] Session context state:', {
      isConnected: liveKitConnected,
      hasOriginalStart: !!originalStart,
      sessionContext,
    })

    if (!originalStart) {
      console.error('[GamingHubInner] ❌ No start function available from sessionContext!')
      return
    }

    // Show connecting loader
    setIsConnecting(true)

    try {
      console.log('[GamingHubInner] Calling originalStart()...')
      // Run both the connection and a minimum 1.5s timer in parallel
        await Promise.all([
          originalStart(),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ])
      console.log('[GamingHubInner] ✅ originalStart() completed successfully')
    } catch (error) {
      console.error('[GamingHubInner] ❌ Error calling start():', error)
    } finally {
      setIsConnecting(false)
    }
  }, [originalStart, liveKitConnected, sessionContext])

  // Wrap end() with debug logging
  const end = useCallback(async () => {
    console.log('[GamingHubInner] 🛑 END CALLED - Disconnecting LiveKit')

    if (!originalEnd) {
      console.error('[GamingHubInner] ❌ No end function available from sessionContext!')
      return
    }

    try {
      console.log('[GamingHubInner] Calling originalEnd()...')
      await originalEnd()
      console.log('[GamingHubInner] ✅ originalEnd() completed successfully')
    } catch (error) {
      console.error('[GamingHubInner] ❌ Error calling end():', error)
    }
  }, [originalEnd])
  const { messages: liveKitMessages } = useSessionMessages(sessionContext)
  const { send: sendChatMessage } = useChat()
  const participants = useRemoteParticipants()
  const { enabled: micEnabled, toggle: toggleMic } = useTrackToggle({
    source: Track.Source.Microphone,
  })

  const isAgentAvailable = participants.some((p) => p.isAgent)

  // Voice assistant state (speaking/listening/thinking/idle)
  const { state: agentVoiceState } = useVoiceAssistant()

  // Local participant for detecting user audio level
  const { microphoneTrack } = useLocalParticipant()
  const [isUserSpeaking, setIsUserSpeaking] = useState(false)
  const smoothedLevelRef = useRef(0)

  // Monitor local microphone audio level with smoothing
  useEffect(() => {
    if (!microphoneTrack?.track?.mediaStreamTrack) {
      setIsUserSpeaking(false)
      return
    }

    let audioContext: AudioContext | null = null
    const animFrameId: number | null = null
    let updateInterval: NodeJS.Timeout | null = null

    try {
      audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(
        new MediaStream([microphoneTrack.track.mediaStreamTrack])
      )
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.85 // Heavy smoothing
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      // Sample at ~200ms intervals for a relaxed, less jittery feel
      updateInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const normalized = avg / 255

        // Exponential smoothing — slow rise, slower decay
        const target = normalized
        const current = smoothedLevelRef.current
        const smoothFactor = target > current ? 0.3 : 0.15 // Rise faster, decay slower
        smoothedLevelRef.current = current + (target - current) * smoothFactor

        setIsUserSpeaking(smoothedLevelRef.current > 0.04)
      }, 200)
    } catch (e) {
      // AudioContext may fail in some environments
    }

    return () => {
      if (updateInterval) clearInterval(updateInterval)
      if (animFrameId) cancelAnimationFrame(animFrameId)
      if (audioContext) audioContext.close().catch(() => {})
    }
  }, [microphoneTrack?.track?.mediaStreamTrack])

  // Determine waveform state from agent voice state
  const waveformVariant = useMemo((): 'speaking' | 'listening' => {
    if (agentVoiceState === 'speaking') return 'speaking'
    return 'listening'
  }, [agentVoiceState])

  // Debug logging for connection state
  useEffect(() => {
    console.log('[GamingHub] 🔄 Connection state changed:', {
      wsConnected,
      liveKitConnected,
      micEnabled,
      isAgentAvailable,
      participantsCount: participants.length,
      isLoading,
      showOverlay: !liveKitConnected,
    })
  }, [wsConnected, micEnabled, liveKitConnected, isAgentAvailable, participants.length, isLoading])

  // Monitor when overlay should show/hide
  useEffect(() => {
    if (!liveKitConnected) {
      console.log('[GamingHub] 🎭 Call overlay VISIBLE - waiting for user to start call')
    } else {
      console.log('[GamingHub] 🎭 Call overlay HIDDEN - call is active')
    }
  }, [liveKitConnected])

  // Wrapper for toggleMic with logging
  const handleToggleMic = useCallback(() => {
    console.log('[GamingHub] Toggling mic, current state:', micEnabled)
    toggleMic()
  }, [toggleMic, micEnabled])

  // Companion voice mute state (mutes the companion's audio output)
  const [isCompanionMuted, setIsCompanionMuted] = useState(false)

  const handleToggleCompanionMute = useCallback(() => {
    const newMuted = !isCompanionMuted
    console.log('[GamingHub] Toggling companion mute:', newMuted)
    setIsCompanionMuted(newMuted)

    // Mute/unmute all remote audio tracks
    participants.forEach((participant) => {
      participant.audioTrackPublications.forEach((pub) => {
        if (pub.track) {
          const audioTrack = pub.track
          if ('setVolume' in audioTrack && typeof audioTrack.setVolume === 'function') {
            (audioTrack as any).setVolume(newMuted ? 0 : 1)
          }
          // Also try the mediaStreamTrack enabled property as fallback
          const mediaTrack = pub.track.mediaStreamTrack
          if (mediaTrack) {
            mediaTrack.enabled = !newMuted
          }
        }
      })
    })
  }, [isCompanionMuted, participants])

  // Game state derived from call status
  const gameState = useMemo(() => ({
    isPlaying: liveKitConnected,
    gameName: 'Minecraft' as string | null,
    coverUrl: '/games/minecraft.webp' as string | null,
  }), [liveKitConnected])

  // Merge WebSocket messages with LiveKit transcript messages
  const allMessages = useMemo(() => {
    const merged: Message[] = [...wsMessages]

    // Convert LiveKit messages to Message format
    liveKitMessages.forEach((lkMsg) => {
      const isLocal = lkMsg.from?.isLocal === true
      merged.push({
        id: lkMsg.id || `lk-${Date.now()}-${Math.random()}`,
        role: isLocal ? 'user' : 'model',
        text: lkMsg.message,
        timestamp: new Date(lkMsg.timestamp),
      })
    })

    // Sort by timestamp
    return merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }, [wsMessages, liveKitMessages])

  // Determine companion status from LiveKit voice assistant state
  const companionStatus = useMemo(() => {
    if (!liveKitConnected) {
      return CompanionStatus.CONNECTING
    }
    if (isLoading) {
      return CompanionStatus.LISTENING
    }
    // LiveKit voice assistant state will be handled by VoiceVisualizer
    // For now, use idle when connected
    return CompanionStatus.IDLE
  }, [liveKitConnected, isLoading])

  // Handle sending messages - ONLY use LiveKit (no WebSocket in gaming mode)
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!liveKitConnected) {
        console.warn('[GamingHub] Cannot send message - LiveKit not connected')
        return
      }

      // Send via LiveKit chat (voice agent receives it)
      console.log('[GamingHub] Sending message via LiveKit:', text)
      await sendChatMessage(text)

      // Clear input after sending
      onInputChange('')
    },
    [liveKitConnected, sendChatMessage, onInputChange]
  )

  // Get suggestions from the last agent message (from WebSocket messages only)
  const suggestions = useMemo(() => {
    if (isLoading) return []
    const lastAgentMessage = [...wsMessages]
      .reverse()
      .find(m => m.role === 'model' && m.suggestions?.length)
    if (!lastAgentMessage?.suggestions) return []
    return lastAgentMessage.suggestions
  }, [wsMessages, isLoading])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [allMessages, isLoading, suggestions.length])

  // Handle clicking a quick reply suggestion
  const handleQuickReply = useCallback(
    (suggestion: string) => {
      setSuggestionsCollapsed(false)
      handleSendMessage(suggestion)
    },
    [handleSendMessage]
  )

  // Handle surprise me
  const handleSurpriseMe = useCallback(() => {
    setSuggestionsCollapsed(false)
    handleSendMessage("I'm not sure, please surprise me")
  }, [handleSendMessage])

  // Reset suggestions collapsed state when new suggestions arrive
  const prevSuggestionsRef = useRef<string[]>([])
  useEffect(() => {
    if (
      suggestions.length > 0 &&
      JSON.stringify(suggestions) !== JSON.stringify(prevSuggestionsRef.current)
    ) {
      setSuggestionsCollapsed(false)
      prevSuggestionsRef.current = suggestions
    }
  }, [suggestions])

  // Game toggle is now automatic based on call state

  // New chat handler
  const handleNewChat = useCallback(() => {
    // TODO: Reset messages via parent or reconnect
  }, [])

  // Get companion info from activePersona, fallback to default
  const companionName = activePersona?.name || 'Luna'
  const companionDescription = activePersona?.tagline || 'Journalism major & campus mentor. Your pro-tier gaming duo.'
  const companionAvatar = activePersona?.avatar || null

  return (
    <S.Root>
      {/* Background */}
      <S.BackgroundLayer>
        <S.AmbientGlowTopRight />
        <S.AmbientGlowLeft />
        <S.AmbientGlowBottomLeft />
      </S.BackgroundLayer>

      {/* Navigation */}
      <S.Navigation>
        <S.NavLeft>
          {onBack && (
            <S.BackButton onClick={onBack}>
              <ArrowLeft />
            </S.BackButton>
          )}
          <S.Brand>Dory AI</S.Brand>
        </S.NavLeft>
        <S.NavRight />
      </S.Navigation>

      {/* Main 2-column workspace — fills all remaining space */}
      <S.MainWorkspace>
        <S.HubContainer>
          {/* LEFT: Companion Sidebar */}
          <S.CompanionSidebar>
            <S.SidebarCardOuter $isCalling={liveKitConnected}>
              <S.SidebarCard>
                <S.SidebarScroll>
                  {/* Companion Character Card */}
                  <S.CompanionSection>
                    <CompanionCard
                      name={companionName}
                      description={companionDescription}
                      avatarUrl={companionAvatar}
                      status={companionStatus}
                      isCalling={liveKitConnected}
                      isMuted={!micEnabled}
                      isCompanionMuted={isCompanionMuted}
                      onCall={start}
                      onHangup={end}
                      onToggleMute={handleToggleMic}
                      onToggleCompanionMute={handleToggleCompanionMute}
                    />
                  </S.CompanionSection>

                  {/* Waveform Visualizer - below companion card */}
                  {liveKitConnected && (
                    <S.WaveformSection $variant={waveformVariant}>
                      <S.WaveformBars>
                        {[0, 1, 2, 3, 4, 5, 6].map(i => (
                          <S.WaveformBar
                            key={i}
                            $delay={i}
                            $variant={waveformVariant}
                            $active={waveformVariant === 'speaking' || isUserSpeaking}
                          />
                        ))}
                      </S.WaveformBars>
                      <S.WaveformLabel $variant={waveformVariant}>
                        {waveformVariant === 'speaking' ? 'Speaking' : 'Listening'}
                      </S.WaveformLabel>
                    </S.WaveformSection>
                  )}

                  {/* Sub-sections */}
                  <S.SidebarContent>
                    <S.SidebarSeparator />
                    <GameStatusCard game={gameState} />
                    <ChatHistoryList onNewChat={handleNewChat} />
                  </S.SidebarContent>
                </S.SidebarScroll>
              </S.SidebarCard>
            </S.SidebarCardOuter>
          </S.CompanionSidebar>

          {/* RIGHT: Chat Column */}
          <S.ChatColumn>
            {/* Call Overlay - shown when not connected */}
            {!liveKitConnected && !isConnecting && (
              <S.CallOverlay>
                <S.CallOverlayContent>
                  <S.CallOverlayTitle>Ready to Start?</S.CallOverlayTitle>
                  <S.CallOverlaySubtitle>
                    Start a voice call with {companionName} to begin your gaming session
                  </S.CallOverlaySubtitle>
                  <S.CallOverlayButton onClick={start}>
                    <Phone />
                    Start Call
                  </S.CallOverlayButton>
                </S.CallOverlayContent>
              </S.CallOverlay>
            )}

            {/* Connecting Loader - shown for 2s while server connects */}
            {isConnecting && (
              <S.CallOverlay>
                <ConnectingContent>
                  <ConnectingSpinner />
                  <ConnectingLabel>Connecting…</ConnectingLabel>
                </ConnectingContent>
              </S.CallOverlay>
            )}

            {/* Chat Header */}
            <S.ChatHeader>
              <S.ChatHeaderLeft>
                <S.ChatStatusDot />
                <S.ChatStatusText>
                  {liveKitConnected
                    ? (isAgentAvailable ? 'Voice Call Active' : 'Connecting to Agent...')
                    : 'Ready to Connect'}
                </S.ChatStatusText>
              </S.ChatHeaderLeft>
            </S.ChatHeader>

            {/* Messages */}
            <S.MessageArea>
              {allMessages.length === 0 && liveKitConnected && (
                <S.EmptyMessages>
                  <MessageSquare strokeWidth={2} />
                  <p>Say hello to {companionName}</p>
                </S.EmptyMessages>
              )}

              {allMessages.map(message => (
                <ChatBubble key={message.id} message={message} accentColor={GAMING_PINK} />
              ))}

              {/* Show single loading indicator for either WebSocket or LiveKit agent connection */}
              {(isLoading || (liveKitConnected && !isAgentAvailable)) && (
                <S.LoadingIndicator>
                  <S.LoadingDots>
                    <S.LoadingDot $delay={0} />
                    <S.LoadingDot $delay={-300} />
                    <S.LoadingDot $delay={-500} />
                  </S.LoadingDots>
                </S.LoadingIndicator>
              )}

              <div ref={messagesEndRef} />
            </S.MessageArea>

            {/* Input Area — using existing ChatComposer */}
            <S.FloatingInputWrapper>
              <S.InputGlassCard>
                {/* Quick Reply Suggestions */}
                {suggestions.length > 0 &&
                  (suggestionsCollapsed ? (
                    <S.QuickRepliesCollapsed
                      type="button"
                      onClick={() => setSuggestionsCollapsed(false)}
                    >
                      <ChevronUp />
                    </S.QuickRepliesCollapsed>
                  ) : (
                    <S.QuickRepliesContainer>
                      <S.QuickRepliesHeader>
                        <S.QuickRepliesTitle>
                          Or choose one of the options
                        </S.QuickRepliesTitle>
                        <S.QuickRepliesActions>
                          <S.SurpriseMeButton
                            type="button"
                            onClick={handleSurpriseMe}
                          >
                            <Sparkles />
                            Surprise Me
                          </S.SurpriseMeButton>
                          <S.QuickRepliesToggle
                            type="button"
                            onClick={() => setSuggestionsCollapsed(true)}
                          >
                            <ChevronDown />
                          </S.QuickRepliesToggle>
                        </S.QuickRepliesActions>
                      </S.QuickRepliesHeader>
                      {suggestions.map((suggestion, idx) => (
                        <S.QuickReplyChip
                          key={idx}
                          type="button"
                          $delay={idx}
                          onClick={() => handleQuickReply(suggestion)}
                        >
                          {String.fromCharCode(65 + idx)}.{' '}
                          {suggestion.charAt(0).toUpperCase() +
                            suggestion.slice(1)}
                        </S.QuickReplyChip>
                      ))}
                    </S.QuickRepliesContainer>
                  ))}

                {/* The existing ChatComposer input */}
                <ChatComposer
                  value={inputValue}
                  onChange={onInputChange}
                  onSubmit={handleSendMessage}
                  isLoading={isLoading || (liveKitConnected && !isAgentAvailable)}
                  disableModeSelector={true}
                  mode="gaming-agent"
                  accentColor={GAMING_PINK}
                  disabled={!liveKitConnected}
                />
              </S.InputGlassCard>
            </S.FloatingInputWrapper>
          </S.ChatColumn>
        </S.HubContainer>
      </S.MainWorkspace>

      {/* Audio components for LiveKit */}
      <StartAudio label="Click to enable audio" />
      <RoomAudioRenderer />
    </S.Root>
  )
}

// ==================== OUTER COMPONENT ====================
// Manages LiveKit session and provides it to inner component

export const GamingHub: React.FC<GamingHubProps> = (props) => {
  const { activePersona, conversationSummary, state } = useUnifiedAgent()

  // Use activePersona?.id if available, otherwise fallback to state.activePersonaId
  // This ensures personaId is always available even if activePersona sync hasn't completed
  const personaId = activePersona?.id || state?.activePersonaId || undefined

  console.log('[GamingHub] 🎮 Rendering outer component:', {
    personaId,
    activePersonaId: activePersona?.id,
    stateActivePersonaId: state?.activePersonaId,
    personaName: activePersona?.name,
    hasConversationSummary: !!conversationSummary,
  })

  // Create LiveKit session (but don't auto-start it)
  const { session, start: hookStart, end: hookEnd, isConnected: hookIsConnected } = useLiveKitSession({
    agentName: 'voice-agent',
    personaId,
    conversationSummary,
  })

  console.log('[GamingHub] 📡 LiveKit session from hook:', {
    hasSession: !!session,
    sessionType: typeof session,
    sessionIsConnected: session?.isConnected,
    hookIsConnected,
    hasHookStart: !!hookStart,
    hasHookEnd: !!hookEnd,
    // Log session object structure
    sessionKeys: session ? Object.keys(session) : [],
  })

  // Debug: Monitor session state changes
  useEffect(() => {
    console.log('[GamingHub] 🔄 Session state changed:', {
      isConnected: session?.isConnected,
      hookIsConnected,
    })
  }, [session?.isConnected, hookIsConnected])

  // Wrap with SessionProvider
  return (
    <SessionProvider session={session}>
      <GamingHubInner {...props} />
    </SessionProvider>
  )
}

export default GamingHub

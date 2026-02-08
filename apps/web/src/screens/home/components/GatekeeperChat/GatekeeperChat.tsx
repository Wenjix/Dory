/**
 * GatekeeperChat Component
 * Landing page with expandable chat interface
 * Supports switching between Gatekeeper and Persona agents
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ArrowLeft, ArrowDown, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useUnifiedAgent } from '@/contexts/UnifiedAgentContext'
import { scColors } from '@/theme'
import { SessionExitModal } from '@/components'
import { ChatBubble } from './ChatBubble'
import { ChatComposer, ChatLoadingIndicator } from './ChatComposer'
import { PersonaBuilder } from '../PersonaBuilder'
import { GamingHub } from '../GamingHub'
import { clearChatHistory, saveChatHistory, loadChatHistory, type PersistedMessage } from '@/services/chatPersistence'
import * as S from './GatekeeperChat.styled'
import type { AppMode, WSMessage, ChatMessage } from '@/types/agent.types'

// ==================== TYPES ====================

// UI-specific chat mode for backwards compatibility
export type ChatMode = 'landing' | 'gatekeeper' | 'persona-builder' | 'gaming-agent'

export interface GatekeeperChatProps {
  initialMode?: ChatMode
  onLoginClick?: () => void
}

// Message type for UI display
export interface Message {
  id: string
  role: 'user' | 'model' | 'system'
  text: string
  timestamp: Date
  suggestions?: string[]
  personaData?: Array<{ id: string; name: string; tagline?: string; description?: string; imageUrl?: string | null }>
}

// ==================== HELPERS ====================

const generateId = () => Math.random().toString(36).substring(2, 9)

// Convert UI Message to PersistedMessage (for storage)
const toPersistedMessage = (msg: Message): PersistedMessage | null => {
  // Skip system messages - don't persist them
  if (msg.role === 'system') {
    return null
  }
  
  return {
    id: msg.id,
    content: msg.text,
    role: msg.role === 'user' ? 'user' : 'assistant',
    timestamp: msg.timestamp.getTime(),
  }
}

// Convert PersistedMessage to UI Message (for display)
const fromPersistedMessage = (msg: PersistedMessage): Message => {
  return {
    id: msg.id,
    role: msg.role === 'user' ? 'user' : 'model',
    text: msg.content,
    timestamp: new Date(msg.timestamp),
  }
}

// Convert AppMode to UI ChatMode
const toChatMode = (appMode: AppMode): ChatMode => {
  switch (appMode) {
    case 'GATEKEEPER': return 'landing'
    case 'PERSONA_BUILDER': return 'persona-builder'
    case 'GAMER_AGENT': return 'gaming-agent'
    default: return 'landing'
  }
}

// Convert ChatMode to AppMode
const toAppMode = (chatMode: ChatMode): AppMode => {
  switch (chatMode) {
    case 'gatekeeper': return 'GATEKEEPER'
    case 'persona-builder': return 'PERSONA_BUILDER'
    case 'gaming-agent': return 'GAMER_AGENT'
    default: return 'GATEKEEPER'
  }
}

// Convert WSMessage to UI Message
const toUIMessage = (wsMsg: WSMessage): Message | null => {
  if (wsMsg.type === 'chat') {
    const chatMsg = wsMsg as ChatMessage
    return {
      id: generateId(),
      role: chatMsg.role === 'user' ? 'user' : 'model',
      text: chatMsg.text,
      timestamp: new Date(wsMsg.timestamp),
      suggestions: chatMsg.suggestions,
    }
  }
  if ((wsMsg as any).type === 'system') {
    return {
      id: generateId(),
      role: 'system',
      text: (wsMsg as any).message || (wsMsg as any).text || 'System message',
      timestamp: new Date(wsMsg.timestamp),
    }
  }
  if (wsMsg.type === 'error') {
    return {
      id: generateId(),
      role: 'system',
      text: (wsMsg as any).message || (wsMsg as any).text || 'An error occurred',
      timestamp: new Date(wsMsg.timestamp),
    }
  }
  if (wsMsg.type === 'persona_list') {
    // Handle persona list - will be converted by component
    return {
      id: generateId(),
      role: 'model',
      text: 'Here are your available companions! Click one to begin:',
      timestamp: new Date(wsMsg.timestamp),
      personaData: (wsMsg as any).personas || [],
    }
  }
  return null
}

// ==================== GAMING HUB LOADER ====================

interface GamingHubLoaderProps {
  messages: Message[]
  inputValue: string
  isLoading: boolean
  isConnected: boolean
  onInputChange: (value: string) => void
  onSendMessage: (text: string) => void
  onBack: () => void
  onLoginClick?: () => void
  showExitModal: boolean
  onCancelExit: () => void
  onConfirmExit: () => void
  isModeChanging: boolean
  setIsModeChanging: (value: boolean) => void
}

const GamingHubLoader: React.FC<GamingHubLoaderProps> = (props) => {
  const { isModeChanging, setIsModeChanging, ...hubProps} = props
  const { activePersona } = useUnifiedAgent()

  console.log('[GamingHubLoader] Loading gaming hub:', {
    personaId: activePersona?.id,
    personaName: activePersona?.name,
    isModeChanging,
  })

  // Clear mode transition after brief delay
  useEffect(() => {
    if (isModeChanging && activePersona) {
      // Transition complete once persona is available
      setTimeout(() => setIsModeChanging(false), 500)
    }
  }, [isModeChanging, activePersona, setIsModeChanging])

  // Show loading spinner during mode transition
  if (isModeChanging) {
    return (
      <>
        <SessionExitModal
          isOpen={props.showExitModal}
          onClose={props.onCancelExit}
          onConfirm={props.onConfirmExit}
        />
        <S.ModeTransitionOverlay>
          <S.TransitionContent>
            <S.TransitionSpinner />
            <S.TransitionText>
              Loading gaming mode...
            </S.TransitionText>
          </S.TransitionContent>
        </S.ModeTransitionOverlay>
      </>
    )
  }

  // Show GamingHub (it manages its own LiveKit session)
  return (
    <>
      <SessionExitModal
        isOpen={props.showExitModal}
        onClose={props.onCancelExit}
        onConfirm={props.onConfirmExit}
      />
      <GamingHub {...hubProps} />
    </>
  )
}

// ==================== INNER COMPONENT ====================

const GatekeeperChatInner: React.FC<GatekeeperChatProps> = ({ onLoginClick, initialMode = 'landing' }) => {
  // UnifiedAgent hook - single source of truth
  const {
    currentMode,
    sendMessage,
    switchMode,
    resetSession,
    isConnected,
    personaData,
    setPersonaData,
    activePersona,
    resetPersona,
    stateMachine,
    state,
  } = useUnifiedAgent()

  // Convert AppMode to UI ChatMode for display
  const mode = toChatMode(currentMode)

  // UI state (kept local as it's presentation-specific)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // Debounce timer for saving messages
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isChatActive, setIsChatActive] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isModeChanging, setIsModeChanging] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [previousMode, setPreviousMode] = useState<ChatMode>(mode)
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false)
  const [suggestionsReady, setSuggestionsReady] = useState(false)
  const [currentOperation, setCurrentOperation] = useState<{ operation: string; statusText: string } | null>(null)

  // Session exit modal state
  const [showExitModal, setShowExitModal] = useState(false)
  const [pendingBackAction, setPendingBackAction] = useState<'gatekeeper' | 'persona' | 'gaming' | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const SCROLL_THRESHOLD = 100

  // Check if persona is architected
  const isArchitected = !!personaData?.name

  // Determine if we're in persona builder mode
  const isPersonaBuilder = mode === 'persona-builder'

  // Config for UI display
  const config = useMemo(() => ({
    mode,
    brandName: 'Dory AI',
    badgeText: 'Welcome to Dory AI',
    showNavigation: true,
    showFooter: mode === 'landing' || mode === 'gatekeeper',
    footerBrands: ['Minecraft', 'Roblox', 'Hytale', 'Valheim', 'Stardew Valley'],
    inputPlaceholder: 'What would you like to create today?',
  }), [mode])

  // Subscribe to messages from UnifiedAgent via StateMachine
  useEffect(() => {
    if (!stateMachine) {
      console.log('[GatekeeperChat] No stateMachine available yet')
      return
    }

    console.log('[GatekeeperChat] Setting up message listener for mode:', currentMode)

    // Subscribe to messages via StateMachine
    const unsubscribe = stateMachine.onMessage(currentMode, (wsMessage: WSMessage) => {
      console.log('[GatekeeperChat] Received message:', wsMessage.type)

      // Check for "Conversation restored" system message from backend
      if (wsMessage.type === 'chat') {
        const chatMsg = wsMessage as ChatMessage
        if ((chatMsg.role as string) === 'system' && chatMsg.text?.toLowerCase().includes('conversation restored')) {
          console.log('[GatekeeperChat] Conversation restored by backend - clearing local cache')
          
          // Clear local message cache - backend is source of truth
          setMessages([])
          
          // Clear persisted chat history for this session
          const sessionId = stateMachine.getState().sessionId
          if (sessionId) {
            clearChatHistory(sessionId)
          }
          
          // Show restoration message to user
          const restorationMessage: Message = {
            id: generateId(),
            role: 'system',
            text: '✅ Conversation restored from server',
            timestamp: new Date(),
          }
          setMessages([restorationMessage])
          
          // Send a recovery message to the agent so it greets the user and resumes
          // This is sent directly via stateMachine (not handleSendMessage) so it won't appear as a user bubble
          setIsLoading(true)
          setCurrentOperation(null)
          
          setTimeout(() => {
            console.log('[GatekeeperChat] Sending recovery prompt to agent after conversation restore')
            stateMachine.sendChatMessage('[CONVERSATION_RESTORED] The conversation was just restored. Please briefly welcome the user back and summarize where we left off.')
          }, 500)
          
          return
        }
      }

      const uiMessage = toUIMessage(wsMessage)
      if (uiMessage) {
        setMessages(prev => {
          // If the new message has no suggestions (undefined/empty),
          // clear suggestions from all previous messages to avoid stale suggestions showing
          if (!uiMessage.suggestions || uiMessage.suggestions.length === 0) {
            const cleared = prev.map(m =>
              m.suggestions ? { ...m, suggestions: undefined } : m
            )
            return [...cleared, uiMessage]
          }
          return [...prev, uiMessage]
        })
        setIsLoading(false)
        // Clear operation status when new message arrives
        setCurrentOperation(null)
        // Don't auto-expand chat - let user control when to expand
      }
    })

    return unsubscribe
  }, [stateMachine, currentMode])

  // Load messages from localStorage when stateMachine becomes available or mode changes
  // This provides instant UI before backend sends messages
  useEffect(() => {
    if (!stateMachine) return
    
    const sessionId = stateMachine.getState().sessionId
    if (!sessionId) return
    
    const persistedMessages = loadChatHistory(sessionId)
    if (persistedMessages.length > 0 && messages.length === 0) {
      // Only load if we don't have messages yet (to avoid overwriting active session)
      console.log(`[GatekeeperChat] Loaded ${persistedMessages.length} cached messages for mode ${currentMode}`)
      setMessages(persistedMessages.map(fromPersistedMessage))
    }
  }, [stateMachine, currentMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save messages to localStorage when they change (debounced)
  useEffect(() => {
    if (!stateMachine || messages.length === 0) return
    
    const sessionId = stateMachine.getState().sessionId
    if (!sessionId) return
    
    // Clear previous timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    
    // Debounce save - wait 1 second after last message change
    saveTimerRef.current = setTimeout(() => {
      const persistedMessages = messages
        .map(toPersistedMessage)
        .filter((msg): msg is PersistedMessage => msg !== null)
      
      if (persistedMessages.length > 0) {
        saveChatHistory(sessionId, persistedMessages)
        console.log(`[GatekeeperChat] Saved ${persistedMessages.length} messages to localStorage`)
      }
    }, 1000)
    
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [messages, stateMachine])

  // Subscribe to operation status updates
  useEffect(() => {
    if (!stateMachine) return

    const unsubscribe = stateMachine.onOperationStatus((operation, statusText, persona) => {
      console.log('[GatekeeperChat] Operation status:', operation, statusText)

      // Capitalize operation name for display
      const formattedOperation = operation
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      setCurrentOperation({ operation: formattedOperation, statusText })

      // Update persona data if provided
      if (persona && setPersonaData) {
        setPersonaData(persona)
      }
    })

    return unsubscribe
  }, [stateMachine, setPersonaData])

  // NOTE: Conversation summary is handled entirely by the backend.
  // When the backend triggers a mode_change, it provides the conversationSummary.
  // The frontend does NOT manually build or sync conversation summaries.

  // Handle mode changes - show system messages for UI feedback
  useEffect(() => {
    console.log('[GatekeeperChat] Mode changed:', { mode, previousMode, isConnected })

    if (mode !== previousMode) {
      // Show loading state during mode transition
      setIsModeChanging(true)
      setPreviousMode(mode)

      // Add system message for mode transitions
      if (mode === 'persona-builder') {
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'system',
          text: 'Switching to Persona Architect...',
          timestamp: new Date(),
        }])
      } else if (mode === 'gaming-agent') {
        // Clear suggestions from all previous messages to prevent stale persona builder suggestions
        // from leaking into the gaming hub UI
        setMessages(prev => [
          ...prev.map(m => m.suggestions ? { ...m, suggestions: undefined } : m),
          {
            id: generateId(),
            role: 'system',
            text: 'Launching Gaming Companion...',
            timestamp: new Date(),
          },
        ])
      } else if (previousMode === 'persona-builder' || previousMode === 'gaming-agent') {
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'system',
          text: 'Returning to Gatekeeper...',
          timestamp: new Date(),
        }])
      }

      // Clear loading state after delay to allow connection to establish
      // Use shorter delay and also clear when connected
      const timer = setTimeout(() => {
        setIsModeChanging(false)
      }, 1500) // 1.5 second delay for smooth transition

      return () => clearTimeout(timer)
    }
  }, [mode, previousMode, isConnected])

  // Auto-clear loading state when connection is established
  useEffect(() => {
    if (isConnected && isModeChanging) {
      console.log('[GatekeeperChat] Connection established, clearing mode transition')
      setIsModeChanging(false)
    }
  }, [isConnected, isModeChanging])

  // Connection status derived from UnifiedAgent
  const isConnecting = !isConnected && !!stateMachine

  useEffect(() => {
    if (scrollRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = scrollRef.current
      const isAtBottom = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD
      
      if (isAtBottom || messages[messages.length - 1]?.role === 'user') {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }
    }
  }, [messages])

  useEffect(() => {
    const scrollArea = scrollRef.current
    if (!scrollArea) return

    const handleScroll = () => {
      const { scrollHeight, scrollTop, clientHeight } = scrollArea
      const isAtBottom = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD
      setShowScrollButton(!isAtBottom && messages.length > 0)
    }

    scrollArea.addEventListener('scroll', handleScroll)
    return () => scrollArea.removeEventListener('scroll', handleScroll)
  }, [messages.length])

  useEffect(() => {
    if (isConnecting) {
      setMessages([{
        id: generateId(),
        role: 'system',
        text: 'Connecting to Dory AI...',
        timestamp: new Date(),
      }])
    }
  }, [isConnecting])

  // Lock body scroll when chat is expanded to prevent layout shift
  useEffect(() => {
    if (isChatActive) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [isChatActive])

  // Transition loading when chat expands
  useEffect(() => {
    if (isChatActive) {
      setIsTransitioning(true)
      const timer = setTimeout(() => {
        setIsTransitioning(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [isChatActive])

  // Auto-scroll to bottom when transition completes
  useEffect(() => {
    if (isChatActive && !isTransitioning && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [isChatActive, isTransitioning])

  const addMessage = useCallback((role: Message['role'], text: string) => {
    setMessages(prev => [
      ...prev,
      { id: generateId(), role, text, timestamp: new Date() },
    ])
  }, [])

  const handleSendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return

      if (!isChatActive) {
        setIsChatActive(true)
      }

      setInputValue('')
      setSuggestionsCollapsed(false) // Reset suggestions visibility
      addMessage('user', text)
      setIsLoading(true)

      if (isConnected) {
        // UnifiedAgent routes to correct agent based on currentMode
        sendMessage(text)
      } else {
        setTimeout(() => {
          addMessage('model', 'Unable to connect to the agent. Please try again.')
          setIsLoading(false)
        }, 500)
      }
    },
    [isLoading, isChatActive, addMessage, isConnected, sendMessage]
  )

  const handleBackToLanding = useCallback(() => {
    // If there are messages (active conversation), show confirmation modal
    if (messages.length > 0) {
      setPendingBackAction('gatekeeper')
      setShowExitModal(true)
    } else {
      // No conversation yet, just collapse chat
      setIsChatActive(false)
      setSuggestionsCollapsed(false)
    }
  }, [messages.length])

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }, [])

  // Handler to go back from PersonaBuilder
  const handleBackFromPersonaBuilder = useCallback(() => {
    setPendingBackAction('persona')
    setShowExitModal(true)
  }, [])

  // Handler to go back from GamingHub
  const handleBackFromGamingHub = useCallback(() => {
    setPendingBackAction('gaming')
    setShowExitModal(true)
  }, [])

  // Confirm exit - reset session and return to landing
  const handleConfirmExit = useCallback(async () => {
    console.log('[GatekeeperChat] User confirmed session exit (intentional reset)')
    setShowExitModal(false)

    // Cancel any pending save timer to prevent writing stale data
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    // Clear local UI state FIRST to prevent stale data from being picked up
    setMessages([])
    setInputValue('')
    setIsLoading(false)
    setIsChatActive(false)
    setIsTransitioning(false)
    setIsModeChanging(false)
    setShowScrollButton(false)
    setSuggestionsCollapsed(false)
    setSuggestionsReady(false)
    setCurrentOperation(null)
    setPendingBackAction(null)
    setPreviousMode('landing')

    // Clear chat history for current session (intentional reset - start fresh)
    if (stateMachine) {
      const sessionId = stateMachine.getState().sessionId
      if (sessionId) {
        clearChatHistory(sessionId)
        console.log('[GatekeeperChat] Cleared chat history for session:', sessionId)
      }
    }

    // Reset entire session - disconnects all agents, clears all sessionIds,
    // clears conversation summary, creates fresh GATEKEEPER session
    await resetSession()

    console.log('[GatekeeperChat] Session reset complete, returned to landing')
  }, [resetSession, stateMachine])

  // Cancel exit - stay in current session
  const handleCancelExit = useCallback(() => {
    console.log('[GatekeeperChat] User cancelled session exit')
    setShowExitModal(false)
    setPendingBackAction(null)
  }, [])

  // Get suggestions from the last message (only if it's a model message with suggestions)
  const suggestions = useMemo(() => {
    if (isLoading) return []
    
    // Get the absolute last message
    const lastMessage = messages[messages.length - 1]
    
    console.log('[GatekeeperChat] Suggestions check:', {
      totalMessages: messages.length,
      lastMessage: lastMessage?.text?.substring(0, 50),
      lastMessageRole: lastMessage?.role,
      suggestions: lastMessage?.suggestions,
    })
    
    // Only show suggestions if the last message is a model message with suggestions
    if (lastMessage?.role !== 'model' || !lastMessage?.suggestions?.length) return []
    return lastMessage.suggestions
  }, [messages, isLoading])

  // Handle clicking a quick reply
  const handleQuickReply = useCallback((suggestion: string) => {
    setSuggestionsCollapsed(false) // Reset suggestions visibility
    handleSendMessage(suggestion)
  }, [handleSendMessage])

  // Handle surprise me button click
  const handleSurpriseMe = useCallback(() => {
    setSuggestionsCollapsed(false)
    handleSendMessage("I'm not sure, please surprise me")
  }, [handleSendMessage])

  // Reset suggestions collapsed state when mode changes
  useEffect(() => {
    setSuggestionsCollapsed(false)
  }, [mode])

  // Reset suggestions collapsed state when new suggestions arrive
  const prevSuggestionsRef = useRef<string[]>([])
  useEffect(() => {
    if (suggestions.length > 0 && JSON.stringify(suggestions) !== JSON.stringify(prevSuggestionsRef.current)) {
      setSuggestionsCollapsed(false)
      prevSuggestionsRef.current = suggestions
    }
  }, [suggestions])

  // Delay showing suggestions until after the message has rendered
  useEffect(() => {
    if (isLoading) {
      // Hide suggestions immediately when loading starts
      setSuggestionsReady(false)
      return
    }

    if (suggestions.length > 0) {
      // Show suggestions after a delay to let the message render first
      const timer = setTimeout(() => {
        setSuggestionsReady(true)
      }, 600)
      return () => clearTimeout(timer)
    } else {
      setSuggestionsReady(false)
    }
  }, [isLoading, suggestions])

  // Scroll chat to bottom when suggestions UI appears (to push chat above suggestions)
  useEffect(() => {
    if (suggestionsReady && !suggestionsCollapsed && scrollRef.current) {
      // Small delay to let the suggestions UI render first
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [suggestionsReady, suggestionsCollapsed])

  // If in gaming-agent mode AND we have a personaId (from activePersona OR state), show GamingHub
  // This ensures GamingHub renders even if activePersona sync hasn't completed yet
  if (mode === 'gaming-agent' && (activePersona || state?.activePersonaId)) {
    return (
      <GamingHubLoader
        messages={messages}
        inputValue={inputValue}
        isLoading={false}
        isConnected={false}
        onInputChange={setInputValue}
        onSendMessage={handleSendMessage}
        onBack={handleBackFromGamingHub}
        onLoginClick={onLoginClick}
        showExitModal={showExitModal}
        onCancelExit={handleCancelExit}
        onConfirmExit={handleConfirmExit}
        isModeChanging={isModeChanging}
        setIsModeChanging={setIsModeChanging}
      />
    )
  }

  // If in persona-builder mode AND we have persona data, show PersonaBuilder
  if (mode === 'persona-builder' && isArchitected) {
    return (
      <>
        <SessionExitModal
          isOpen={showExitModal}
          onClose={handleCancelExit}
          onConfirm={handleConfirmExit}
        />
        {isModeChanging ? (
          <S.ModeTransitionOverlay>
            <S.TransitionContent>
              <S.TransitionSpinner />
              <S.TransitionText>Switching to Persona Architect...</S.TransitionText>
            </S.TransitionContent>
          </S.ModeTransitionOverlay>
        ) : (
          <PersonaBuilder
            messages={messages}
            inputValue={inputValue}
            isLoading={isLoading}
            isConnected={isConnected}
            onInputChange={setInputValue}
            onSendMessage={handleSendMessage}
            onBack={handleBackFromPersonaBuilder}
            onLoginClick={onLoginClick}
          />
        )}
      </>
    )
  }

  // Default: show landing/chat view
  return (
    <S.Root>
      <SessionExitModal
        isOpen={showExitModal}
        onClose={handleCancelExit}
        onConfirm={handleConfirmExit}
      />

      <S.BackgroundLayer $blurred={isChatActive} />

      {config.showNavigation && (
        <S.Navigation>
          <S.NavLeft $hasBackButton={isChatActive}>
            <S.Brand $isPersonaBuilder={isPersonaBuilder}>{config.brandName}</S.Brand>
          </S.NavLeft>
          <S.NavRight />

        </S.Navigation>
      )}

      <S.HeroSection $hidden={isChatActive}>
        <S.HeroContent>
          <S.HeroBadge>
            <S.BadgeDot />
            <S.BadgeText>{config.badgeText}</S.BadgeText>
          </S.HeroBadge>
          
          <S.HeroTitle>
            Your solo days<br />
            <S.HeroTitleGradient>are over</S.HeroTitleGradient>
          </S.HeroTitle>
          
          <S.HeroSubtitle>
            Your gateway to infinite possibilities. Create, explore, and bring your imagination to life.
          </S.HeroSubtitle>
        </S.HeroContent>
      </S.HeroSection>

      <S.BackButton $visible={isChatActive} onClick={handleBackToLanding}>
        <ArrowLeft />
      </S.BackButton>

      <S.MainContent $chatActive={isChatActive}>
        <S.ChatContainer $expanded={isChatActive}>
          {/* Transition Loading */}
          {isChatActive && isTransitioning && (
            <S.TransitionLoader>
              <S.LoaderDots>
                <S.LoaderDot $delay={0} />
                <S.LoaderDot $delay={150} />
                <S.LoaderDot $delay={300} />
              </S.LoaderDots>
            </S.TransitionLoader>
          )}

          <S.MessageArea ref={scrollRef} $visible={isChatActive && !isTransitioning}>
            {messages.map(message => (
              <ChatBubble
                key={message.id}
                message={message}
                onSendMessage={handleSendMessage}
                accentColor={isPersonaBuilder ? scColors.purple.base : undefined}
              />
            ))}
            {(isLoading || currentOperation) && (
              <ChatLoadingIndicator operationText={currentOperation?.operation} accentColor={isPersonaBuilder ? scColors.purple.base : undefined} />
            )}
          </S.MessageArea>

          {showScrollButton && isChatActive && !isTransitioning && (
            <S.ScrollToBottomButton onClick={scrollToBottom}>
              <ArrowDown />
            </S.ScrollToBottomButton>
          )}

          <S.GlassCard $expanded={isChatActive} $isPersonaBuilder={isPersonaBuilder}>
            {/* Quick Reply Suggestions - only show when chat is active and suggestions are ready */}
            {isChatActive && suggestionsReady && suggestions.length > 0 && (
              suggestionsCollapsed ? (
                <S.QuickRepliesCollapsed
                  type="button"
                  onClick={() => setSuggestionsCollapsed(false)}
                >
                  <ChevronUp />
                </S.QuickRepliesCollapsed>
              ) : (
                <S.QuickRepliesContainer>
                  <S.QuickRepliesHeader>
                    <S.QuickRepliesTitle>Or choose one of the options</S.QuickRepliesTitle>
                    <S.QuickRepliesActions>
                      <S.SurpriseMeButton
                        type="button"
                        onClick={handleSurpriseMe}
                        $isPersonaBuilder={isPersonaBuilder}
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
                      {String.fromCharCode(65 + idx)}. {suggestion.charAt(0).toUpperCase() + suggestion.slice(1)}
                    </S.QuickReplyChip>
                  ))}
                </S.QuickRepliesContainer>
              )
            )}
            <ChatComposer
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSendMessage}
              isLoading={isLoading}
              mode={mode}
              placeholder={config.inputPlaceholder}
              disableModeSelector={true}
              accentColor={isPersonaBuilder ? scColors.purple.base : undefined}
            />
          </S.GlassCard>
        </S.ChatContainer>
      </S.MainContent>

      {config.showFooter && (
        <S.Footer $hidden={isChatActive}>
          <S.FooterLabel>Trusted by gamers worldwide</S.FooterLabel>
          <S.FooterBrands>
            {config.footerBrands?.map((brand, idx) => (
              <S.FooterBrand key={idx}>
                {brand}
              </S.FooterBrand>
            ))}
          </S.FooterBrands>
        </S.Footer>
      )}

      <S.TerminalInfo>
        Dory AI v1.0 | <span>{isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}</span>
      </S.TerminalInfo>
    </S.Root>
  )
}

// ==================== MAIN EXPORT ====================

export const GatekeeperChat: React.FC<GatekeeperChatProps> = ({
  initialMode = 'landing',
  onLoginClick,
}) => {
  // No need for ChatModeProvider and PersonaProvider wrappers
  // UnifiedAgentProvider is already at app level
  return <GatekeeperChatInner onLoginClick={onLoginClick} />
}

export default GatekeeperChat

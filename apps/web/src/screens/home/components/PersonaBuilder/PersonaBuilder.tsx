/**
 * PersonaBuilder Component
 * Dynamic 3-column layout for persona creation
 * Starts centered, expands when persona data arrives
 */

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { ArrowLeft, MessageSquare, AlertTriangle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useUnifiedAgent } from '@/contexts/UnifiedAgentContext'
import { scColors } from '@/theme'
import type { Message } from '../GatekeeperChat/GatekeeperChat'
import { ChatBubble } from '../GatekeeperChat/ChatBubble'
import { ChatComposer } from '../GatekeeperChat/ChatComposer'
import * as S from './PersonaBuilder.styled'

// ==================== TYPES ====================

export interface PersonaBuilderProps {
  messages: Message[]
  inputValue: string
  isLoading: boolean
  isConnected: boolean
  onInputChange: (value: string) => void
  onSendMessage: (text: string) => void
  onBack?: () => void
  onLoginClick?: () => void
}

// ==================== COMPONENT ====================

export const PersonaBuilder: React.FC<PersonaBuilderProps> = ({
  messages,
  inputValue,
  isLoading,
  isConnected,
  onInputChange,
  onSendMessage,
  onBack,
  onLoginClick,
}) => {
  // Use unified agent context for persona data
  const { personaData, setPersonaData, stateMachine } = useUnifiedAgent()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false)
  const [currentOperation, setCurrentOperation] = useState<{ operation: string; statusText: string } | null>(null)

  // Derive persona state from personaData
  const persona = personaData || {
    name: '',
    personalityDescription: '',
    gamingDescription: '',
    imageUrl: '',
  }
  const isArchitected = !!personaData?.name
  const isGeneratingImage = false // TODO: Track image generation state if needed

  // Get suggestions from the last agent message (provided by backend)
  const suggestions = useMemo(() => {
    if (isLoading) return []

    // Find the last model message with suggestions
    const lastAgentMessage = [...messages].reverse().find(m => m.role === 'model' && m.suggestions?.length)

    // Debug logging
    console.log('[PersonaBuilder] Looking for suggestions in messages:', {
      totalMessages: messages.length,
      modelMessages: messages.filter(m => m.role === 'model').length,
      lastAgentMessage: lastAgentMessage ? {
        role: lastAgentMessage.role,
        text: lastAgentMessage.text?.substring(0, 50),
        suggestions: lastAgentMessage.suggestions,
      } : null,
    })

    if (!lastAgentMessage?.suggestions) return []

    return lastAgentMessage.suggestions
  }, [messages, isLoading])

  // Subscribe to operation status updates
  useEffect(() => {
    if (!stateMachine) return

    const unsubscribe = stateMachine.onOperationStatus((operation, statusText, persona) => {
      console.log('[PersonaBuilder] Operation status:', operation, statusText)

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

  // Clear operation status when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && currentOperation) {
      // Check if the last message is not a loading message
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role !== 'system' || !lastMessage.text.includes('Switching')) {
        setCurrentOperation(null)
      }
    }
  }, [messages, currentOperation])

  // Auto-scroll to bottom when messages change or suggestions appear
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, suggestions.length, currentOperation])

  // Handle clicking a quick reply suggestion
  const handleQuickReply = useCallback(
    (suggestion: string) => {
      setSuggestionsCollapsed(false) // Reset suggestions visibility
      onSendMessage(suggestion)
    },
    [onSendMessage]
  )

  // Handle surprise me button click
  const handleSurpriseMe = useCallback(() => {
    setSuggestionsCollapsed(false)
    onSendMessage("I'm not sure, please surprise me")
  }, [onSendMessage])

  // Reset suggestions collapsed state when new suggestions arrive
  const prevSuggestionsRef = useRef<string[]>([])
  useEffect(() => {
    if (suggestions.length > 0 && JSON.stringify(suggestions) !== JSON.stringify(prevSuggestionsRef.current)) {
      setSuggestionsCollapsed(false)
      prevSuggestionsRef.current = suggestions
    }
  }, [suggestions])

  // Check if placeholder text is showing
  const hasPersonalityData = !!persona.personalityDescription
  const hasGamingStyleData = !!persona.gamingDescription

  return (
    <S.Root>
      {/* Dynamic Background */}
      <S.BackgroundLayer $isActive={true} />
      <S.DotGridOverlay $isActive={true} />

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

      {/* Main Workspace */}
      <S.MainWorkspace>
        <S.ArchitectContainer $isArchitected={isArchitected}>

          {/* Column 1: Visual Representation */}
          <S.VisualColumn $isArchitected={isArchitected}>
            <S.VisualCard>
              {/* Placeholder when no image */}
              {!persona.imageUrl && (
                <S.ImagePlaceholder>
                  <S.GeneratingSpinner />
                  <S.GeneratingText>Awaiting visualization...</S.GeneratingText>
                </S.ImagePlaceholder>
              )}

              {/* Actual image when available */}
              {persona.imageUrl && (
                <S.PersonaImage
                  src={persona.imageUrl}
                  alt="Persona Preview"
                  $isGenerating={isGeneratingImage}
                />
              )}

              {/* Loading overlay during generation */}
              {isGeneratingImage && persona.imageUrl && (
                <S.ImageGeneratingOverlay>
                  <S.GeneratingSpinner />
                  <S.GeneratingText>Materializing...</S.GeneratingText>
                </S.ImageGeneratingOverlay>
              )}

              {/* Footer with persona name */}
              <S.VisualCardFooter>
                <S.VisualIdLabel>Your Persona</S.VisualIdLabel>
                <S.VisualIdName>
                  {persona.name || 'Unnamed'}
                </S.VisualIdName>
              </S.VisualCardFooter>
            </S.VisualCard>
          </S.VisualColumn>

          {/* Column 2: Traits Blocks */}
          <S.TraitsColumn $isArchitected={isArchitected}>
            {/* Personality Card */}
            <S.TraitCard>
              <S.TraitHeader>
                <S.TraitLabel>01 Personality</S.TraitLabel>
              </S.TraitHeader>
              <S.TraitContent>
                <S.TraitText $isPlaceholder={!hasPersonalityData}>
                  {persona.personalityDescription || 'Awaiting architectural parameters...'}
                </S.TraitText>
              </S.TraitContent>
            </S.TraitCard>

            {/* Gaming Style Card */}
            <S.TraitCard>
              <S.TraitHeader>
                <S.TraitLabel>02 Gaming Style</S.TraitLabel>
              </S.TraitHeader>
              <S.TraitContent>
                <S.TraitText $isPlaceholder={!hasGamingStyleData}>
                  {persona.gamingDescription || 'Not yet defined.'}
                </S.TraitText>
              </S.TraitContent>
            </S.TraitCard>
          </S.TraitsColumn>

          {/* Column 3: Chat Interface */}
          <S.ChatColumn $isArchitected={isArchitected}>
            {/* Chat Header */}
            <S.ChatHeader>
              <S.ChatHeaderLeft>
                <S.ChatStatusDot />
                <S.ChatStatusText>
                  {isConnected ? 'Architect Session Active' : 'Connecting...'}
                </S.ChatStatusText>
              </S.ChatHeaderLeft>
            </S.ChatHeader>

            {/* Message Area */}
            <S.MessageArea>
              {messages.length === 0 && (
                <S.EmptyMessages>
                  <MessageSquare strokeWidth={2} />
                  <p>Identity Sync Waiting</p>
                </S.EmptyMessages>
              )}

              {messages.map(message => (
                <ChatBubble key={message.id} message={message} accentColor={scColors.purple.base} />
              ))}

              {(isLoading || currentOperation) && (
                <S.LoadingIndicator>
                  <S.LoadingDots>
                    <S.LoadingDot $delay={0} />
                    <S.LoadingDot $delay={-300} />
                    <S.LoadingDot $delay={-500} />
                  </S.LoadingDots>
                  {currentOperation?.operation && <span>{currentOperation.operation}</span>}
                </S.LoadingIndicator>
              )}

              <div ref={messagesEndRef} />
            </S.MessageArea>

            {/* Input Area */}
            <S.FloatingInputWrapper>
              <S.InputGlassCard>
                {/* Quick Reply Suggestions */}
                {suggestions.length > 0 && (
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
                  onChange={onInputChange}
                  onSubmit={onSendMessage}
                  isLoading={isLoading}
                  disableModeSelector={true}
                  mode="persona-builder"
                  accentColor={scColors.purple.base}
                />
              </S.InputGlassCard>
            </S.FloatingInputWrapper>
          </S.ChatColumn>
        </S.ArchitectContainer>
      </S.MainWorkspace>

      {/* Footer */}
      <S.Footer $isActive={true}>
        <S.FooterContent>
          <span>Project Alpha</span>
          <S.FooterDot />
          <span>Universal Core Ready</span>
        </S.FooterContent>
      </S.Footer>
    </S.Root>
  )
}

export default PersonaBuilder

/**
 * ChatBubble Component
 * Displays individual chat messages
 */

import React from 'react'
import type { Message } from '..'
import * as S from './ChatBubble.styled'

export interface ChatBubbleProps {
  message: Message
  onSendMessage?: (text: string) => void
  accentColor?: string
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onSendMessage, accentColor }) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <S.SystemMessage>
        <span>{message.text}</span>
      </S.SystemMessage>
    )
  }

  const handlePersonaClick = (personaName: string) => {
    onSendMessage?.(`I want to play with ${personaName}`)
  }

  return (
    <S.MessageWrapper $isUser={isUser}>
      <S.MessageBubble $isUser={isUser} $accentColor={accentColor} $hasImages={!!message.personaData?.length}>
        <S.MessageContent $isUser={isUser} $accentColor={accentColor}>
          {message.text}
        </S.MessageContent>

        {/* Image Gallery for personas */}
        {message.personaData && message.personaData.length > 0 && (
          <S.ImageGallery>
            {message.personaData.map((persona, idx) => {
              if (!persona.imageUrl) return null
              return (
                <S.ImageCard
                  key={persona.id || idx}
                  onClick={() => handlePersonaClick(persona.name || 'Unknown')}
                  type="button"
                >
                  <S.PersonaImage
                    src={persona.imageUrl}
                    alt={persona.name || `Persona ${idx + 1}`}
                  />
                  <S.ImageOverlay />
                  <S.ImageGlow />
                </S.ImageCard>
              )
            })}
          </S.ImageGallery>
        )}

        <S.MessageTime $isUser={isUser}>
          {message.timestamp.toLocaleTimeString('en', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </S.MessageTime>
      </S.MessageBubble>
    </S.MessageWrapper>
  )
}

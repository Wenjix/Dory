/**
 * CompanionCard Component
 * Displays the gaming companion avatar with status indicators
 * Adapted from the Companion.tsx reference with styled-components
 */

import React from 'react'
import { Volume2, VolumeX, Share2, ThumbsUp, ThumbsDown, Phone, PhoneOff, Mic, MicOff } from 'lucide-react'
import { CompanionStatus } from '../../../hooks/useVoiceAgent'
import * as S from './CompanionCard.styled'

export interface CompanionCardProps {
  name: string
  description?: string
  avatarUrl?: string | null
  status: CompanionStatus
  isCalling?: boolean
  isMuted?: boolean
  isCompanionMuted?: boolean
  onCall?: () => void
  onHangup?: () => void
  onToggleMute?: () => void
  onToggleCompanionMute?: () => void
}

export const CompanionCard: React.FC<CompanionCardProps> = ({
  name,
  description = 'Your pro-tier gaming companion.',
  avatarUrl,
  status,
  isCalling = false,
  isMuted = false,
  isCompanionMuted = false,
  onCall,
  onHangup,
  onToggleMute,
  onToggleCompanionMute,
}) => {
  const isTalking = status === CompanionStatus.TALKING
  const isConnecting = status === CompanionStatus.CONNECTING
  const isListening = status === CompanionStatus.LISTENING

  // Debug logging for button handlers
  console.log('[CompanionCard] Render state:', {
    name,
    isCalling,
    hasOnCall: !!onCall,
    hasOnHangup: !!onHangup,
    onCallType: typeof onCall,
    status,
  })

  const handleCallClick = () => {
    console.log('[CompanionCard] 📞 Call button clicked!', {
      isCalling,
      willCall: isCalling ? 'hangup' : 'start call',
      hasHandler: isCalling ? !!onHangup : !!onCall,
    })

    if (isCalling) {
      console.log('[CompanionCard] Calling onHangup...')
      onHangup?.()
    } else {
      console.log('[CompanionCard] Calling onCall...')
      onCall?.()
    }
  }

  const defaultAvatar =
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/shiny/700.png'

  return (
    <S.Root>
      <S.CharacterContainer $isTalking={isTalking}>
        {/* Ambient Glows */}
        <S.AmbientGlow $isTalking={isTalking} $variant="warm" />
        {isListening && <S.AmbientGlow $isTalking={true} $variant="pink" />}

        {/* Visual Area */}
        <S.VisualArea $isConnecting={isConnecting}>
          <S.GradientBackground $avatarUrl={avatarUrl || defaultAvatar} />
          <S.ContrastGradientTop />
          <S.ContrastGradientBottom />

          {/* Top Status Indicators */}
          <S.TopIndicators>
            <S.StatusPill>
              <S.StatusDot $isConnecting={isConnecting} />
              <S.StatusLabel>{isConnecting ? 'SYNC' : 'LIVE'}</S.StatusLabel>
            </S.StatusPill>

            <S.AuraTag>
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <S.AuraValue>1.2M</S.AuraValue>
            </S.AuraTag>
          </S.TopIndicators>

          {/* Bottom Identity */}
          <S.BottomOverlay>
            <S.NameRow>
              <S.CompanionName>{name}</S.CompanionName>
              <S.MuteButton
                $isMuted={isCompanionMuted}
                onClick={onToggleCompanionMute}
                title={isCompanionMuted ? 'Unmute Companion' : 'Mute Companion'}
              >
                {isCompanionMuted ? <VolumeX /> : <Volume2 />}
              </S.MuteButton>
            </S.NameRow>

            {/* Action Buttons */}
            <S.ActionButtons>
              <S.ActionButton title="Share">
                <Share2 />
              </S.ActionButton>
              <S.ActionButton title="Like">
                <ThumbsUp />
              </S.ActionButton>
              <S.ActionButton title="Dislike">
                <ThumbsDown />
              </S.ActionButton>

              {/* Call Toggle */}
              <S.CallButton
                $isCalling={isCalling}
                onClick={handleCallClick}
                title={isCalling ? 'End Call' : 'Start Call'}
              >
                {isCalling ? <PhoneOff /> : <Phone />}
              </S.CallButton>

              {/* Mute Toggle (only show when in call) */}
              {isCalling && (
                <S.MuteCallButton
                  $isMuted={isMuted}
                  onClick={() => {
                    console.log('[CompanionCard] Mute button clicked, isMuted:', isMuted)
                    onToggleMute?.()
                  }}
                  title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                >
                  {isMuted ? <MicOff /> : <Mic />}
                </S.MuteCallButton>
              )}
            </S.ActionButtons>
          </S.BottomOverlay>
        </S.VisualArea>
      </S.CharacterContainer>
    </S.Root>
  )
}

export default CompanionCard

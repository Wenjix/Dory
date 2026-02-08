/**
 * GameStatusCard Component
 * Shows current game session status
 * Adapted from GameDisplay.tsx reference with styled-components
 */

import React from 'react'
import { GameState } from '../../../hooks/useVoiceAgent'
import * as S from './GameStatusCard.styled'

export interface GameStatusCardProps {
  game: GameState
  onClick?: () => void
}

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=400'

export const GameStatusCard: React.FC<GameStatusCardProps> = ({ game, onClick }) => {
  const isPlaying = game.isPlaying && game.gameName
  const displayName = isPlaying ? game.gameName : 'System Standby'
  const displayImage = game.coverUrl || DEFAULT_COVER

  return (
    <S.Root>
      <S.Card $isPlaying={!!isPlaying} onClick={onClick}>
        {/* Playing Background Glows */}
        {isPlaying && (
          <>
            <S.GlowTop />
            <S.GlowBottom />
          </>
        )}

        <S.Content>
          {/* Game Cover Image */}
          <S.CoverImage $isPlaying={!!isPlaying}>
            <S.CoverImg
              src={displayImage}
              alt={displayName || 'Game'}
              $isPlaying={!!isPlaying}
            />
            {isPlaying && <S.CoverGradient />}
          </S.CoverImage>

          {/* Game Info */}
          <S.Info>
            <S.SessionStatus $isPlaying={!!isPlaying}>
              {isPlaying ? '• SESSION ACTIVE' : '• PROTOCOL DORMANT'}
            </S.SessionStatus>

            <S.GameName $isPlaying={!!isPlaying}>{displayName}</S.GameName>

            {/* Status Footer */}
            <S.StatusFooter>
              <S.StatusBars>
                {[0, 1, 2].map(i => (
                  <S.StatusBar key={i} $isPlaying={!!isPlaying} $index={i} />
                ))}
              </S.StatusBars>
              <S.SyncLabel $isPlaying={!!isPlaying}>
                {isPlaying ? 'SYNCING DATA...' : 'READY TO LINK'}
              </S.SyncLabel>
            </S.StatusFooter>
          </S.Info>
        </S.Content>
      </S.Card>
    </S.Root>
  )
}

export default GameStatusCard

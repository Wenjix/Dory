/**
 * GameStatusCard Styled Components
 * Supercell / Brawl Stars game UI style
 */

import styled, { css } from 'styled-components'
import { scColors } from '@/theme'

// ==================== ROOT ====================

export const Root = styled.div`
  width: 100%;
  transition: all 300ms ease;
`

export const Card = styled.div<{ $isPlaying: boolean }>`
  position: relative;
  overflow: hidden;
  padding: 1rem;
  border-radius: 16px;
  border: 4px solid ${scColors.black};
  cursor: pointer;
  height: 100px;
  display: flex;
  align-items: center;
  transition: transform 100ms ease, box-shadow 100ms ease;

  &:active {
    transform: translateY(3px);
  }

  ${props => props.$isPlaying ? css`
    background: linear-gradient(180deg, ${scColors.pink.light}30, ${scColors.pink.base}20);
    box-shadow: 0 6px 0 rgba(0,0,0,0.3), 0 0 0 2px ${scColors.pink.base};

    &:active { box-shadow: 0 2px 0 rgba(0,0,0,0.3); }
  ` : css`
    background: ${scColors.surface};
    box-shadow: 0 6px 0 rgba(0,0,0,0.3);
    font-weight: 600;

    &:active { box-shadow: 0 2px 0 rgba(0,0,0,0.3); }
  `}
`

// ==================== GLOWS ====================

export const GlowTop = styled.div`
  display: none; /* No glows in Brawl style */
`

export const GlowBottom = styled.div`
  display: none;
`

// ==================== CONTENT ====================

export const Content = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;
  z-index: 10;
  width: 100%;
`

// ==================== COVER IMAGE ====================

export const CoverImage = styled.div<{ $isPlaying: boolean }>`
  position: relative;
  width: 3rem;
  height: 4rem;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  border: 3px solid ${scColors.black};
  box-shadow: 0 3px 0 rgba(0,0,0,0.3);
  transition: transform 100ms ease;

  &:hover {
    transform: scale(1.05);
  }
`

export const CoverImg = styled.img<{ $isPlaying: boolean }>`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 300ms ease;

  ${props => !props.$isPlaying && css`
    filter: grayscale(1) brightness(0.5);
  `}
`

export const CoverGradient = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.4), transparent);
`

// ==================== INFO ====================

export const Info = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
`

export const SessionStatus = styled.div<{ $isPlaying: boolean }>`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin-bottom: 0.25rem;
  color: ${props => props.$isPlaying ? scColors.pink.base : 'rgba(0, 0, 0, 0.25)'};
  font-family: 'Lilita One', cursive;
`

export const GameName = styled.div<{ $isPlaying: boolean }>`
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 150ms ease;
  font-family: 'Lilita One', cursive;

  ${props => props.$isPlaying ? css`
    color: ${scColors.black};
    font-size: 1.125rem;
  ` : css`
    color: rgba(0, 0, 0, 0.3);
    font-size: 1rem;
    font-style: italic;
  `}
`

// ==================== STATUS FOOTER ====================

export const StatusFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
`

export const StatusBars = styled.div`
  display: flex;
  gap: 3px;
`

export const StatusBar = styled.div<{ $isPlaying: boolean; $index: number }>`
  width: 0.75rem;
  height: 5px;
  border-radius: 100px;
  transition: all 300ms ease;

  ${props => props.$isPlaying ? css`
    background: ${scColors.pink.base};
    opacity: ${1 - props.$index * 0.2};
  ` : css`
    background: rgba(0, 0, 0, 0.1);
  `}
`

export const SyncLabel = styled.span<{ $isPlaying: boolean }>`
  font-size: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: ${props => props.$isPlaying ? scColors.blue.base : 'rgba(0, 0, 0, 0.15)'};
  font-family: 'Lilita One', cursive;
`

/**
 * CompanionCard Styled Components
 * Supercell / Brawl Stars game character card style
 */

import styled, { keyframes, css } from 'styled-components'
import { scColors } from '@/theme'

// ==================== ANIMATIONS ====================

const talkingPulse = keyframes`
  0% { box-shadow: 0 0 0 0px ${scColors.pink.base}80; }
  50% { box-shadow: 0 0 20px 8px ${scColors.pink.base}00; }
  100% { box-shadow: 0 0 0 0px ${scColors.pink.base}00; }
`

// ==================== ROOT ====================

export const Root = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
`

// ==================== CHARACTER VISUAL ====================

export const CharacterContainer = styled.div<{ $isTalking: boolean }>`
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 3.6;
  overflow: hidden;
  transition: all 200ms ease;
  border: none;
`

// ==================== AMBIENT GLOWS ====================

export const AmbientGlow = styled.div<{ $isTalking: boolean; $variant: 'warm' | 'pink' }>`
  position: absolute;
  inset: -3rem;
  border-radius: 50%;
  transition: opacity 500ms ease;

  ${props => props.$variant === 'warm' && css`
    background: ${scColors.orange.base};
    filter: blur(80px);
    opacity: ${props.$isTalking ? 0.2 : 0.05};
  `}

  ${props => props.$variant === 'pink' && css`
    background: ${scColors.pink.base};
    filter: blur(80px);
    opacity: ${props.$isTalking ? 0.2 : 0};
  `}
`

// ==================== VISUAL AREA ====================

export const VisualArea = styled.div<{ $isConnecting: boolean }>`
  position: relative;
  height: 100%;
  width: 100%;
  background: #0a0a0a;

  ${props => props.$isConnecting && css`
    filter: grayscale(1);
    opacity: 0.4;
  `}
`

export const GradientBackground = styled.div<{ $avatarUrl?: string }>`
  position: absolute;
  inset: 0;
  background-image: ${props => props.$avatarUrl
    ? `url(${props.$avatarUrl})`
    : `linear-gradient(to bottom right, ${scColors.orange.base}, ${scColors.pink.base}, ${scColors.purple.base})`
  };
  background-size: cover;
  background-position: center top;
  transition: opacity 500ms ease;
`

export const ContrastGradientTop = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(10, 10, 10, 0.05), transparent 40%, rgba(10, 10, 10, 0.9));
`

export const ContrastGradientBottom = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, #0a0a0a 5%, rgba(10, 10, 10, 0.85) 25%, rgba(10, 10, 10, 0.4) 45%, transparent 60%);
`

// ==================== CHARACTER IMAGE ====================

export const CharacterImageWrapper = styled.div`
  display: none;
`

export const CharacterImage = styled.img<{ $isTalking: boolean }>`
  display: none;
`

// ==================== TOP INDICATORS ====================

export const TopIndicators = styled.div`
  position: absolute;
  top: 1.5rem;
  left: 0;
  width: 100%;
  padding: 0 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  z-index: 30;
`

export const StatusPill = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: ${scColors.black}CC;
  border: 3px solid rgba(255,255,255,0.2);
  padding: 0.375rem 0.875rem;
  border-radius: 100px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
`

export const StatusDot = styled.div<{ $isConnecting: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid ${scColors.black};

  ${props => props.$isConnecting ? css`
    background: ${scColors.yellow.base};
    box-shadow: 0 0 6px ${scColors.yellow.base};
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  ` : css`
    background: ${scColors.green.base};
    box-shadow: 0 0 8px ${scColors.green.base};
  `}
`

export const StatusLabel = styled.span`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: white;
  font-family: 'Lilita One', cursive;
`

export const AuraTag = styled.div`
  background: ${scColors.black}CC;
  border: 3px solid rgba(255,255,255,0.2);
  padding: 0.375rem 0.875rem;
  border-radius: 100px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);

  svg {
    width: 10px;
    height: 10px;
    color: ${scColors.yellow.base};
  }
`

export const AuraValue = styled.span`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.9);
  font-family: 'Lilita One', cursive;
`

// ==================== WAVEFORM VISUALIZER ====================

const waveBar = keyframes`
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
`

export const WaveformContainer = styled.div<{ $variant: 'speaking' | 'listening' | 'idle' }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  margin-top: 1rem;
  opacity: ${props => props.$variant === 'idle' ? 0 : 1};
  transition: opacity 200ms ease;
`

export const WaveformBars = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  height: 1.25rem;
`

export const WaveformBar = styled.div<{ $delay: number; $variant: 'speaking' | 'listening' }>`
  width: 4px;
  height: 100%;
  border-radius: 100px;
  transform-origin: center;
  animation: ${waveBar} ${props => props.$variant === 'speaking' ? '0.5s' : '0.8s'} ease-in-out infinite;
  animation-delay: ${props => props.$delay * 80}ms;
  background: ${props => props.$variant === 'speaking'
    ? scColors.pink.base
    : 'rgba(255, 255, 255, 0.8)'
  };
`

export const WaveformLabel = styled.span<{ $variant: 'speaking' | 'listening' }>`
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${props => props.$variant === 'speaking'
    ? scColors.pink.base
    : 'rgba(255, 255, 255, 0.6)'
  };
  font-family: 'Lilita One', cursive;
`

// ==================== BOTTOM IDENTITY ====================

export const BottomOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 2rem;
  padding-top: 6rem;
  z-index: 30;
`

export const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
`

export const CompanionName = styled.h3`
  color: white;
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
  margin: 0;
  text-shadow:
    3px 3px 0px ${scColors.black},
    -1px -1px 0px ${scColors.black},
    1px -1px 0px ${scColors.black},
    -1px 1px 0px ${scColors.black};
  font-family: 'Lilita One', cursive;
`

export const MuteButton = styled.button<{ $isMuted: boolean }>`
  padding: 0.375rem;
  border-radius: 8px;
  transition: transform 100ms ease, box-shadow 100ms ease;
  border: 3px solid ${scColors.black};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    transform: translateY(2px);
  }

  ${props => props.$isMuted ? css`
    background: linear-gradient(180deg, ${scColors.red.light} 0%, ${scColors.red.base} 100%);
    color: ${scColors.white};
    box-shadow: 0 3px 0 ${scColors.red.dark};
  ` : css`
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 3px 0 rgba(0,0,0,0.3);

    &:hover {
      background: rgba(255, 255, 255, 0.3);
      color: white;
    }
  `}

  svg {
    width: 16px;
    height: 16px;
  }
`

export const Description = styled.p`
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  line-height: 1.6;
  font-weight: 700;
  margin-bottom: 1.5rem;
  max-width: 240px;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  font-family: 'Plus Jakarta Sans', sans-serif;
`

// ==================== ACTION BUTTONS ====================

export const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
`

export const ActionButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(180deg, ${scColors.blue.light} 0%, ${scColors.blue.base} 100%);
  border: 3px solid ${scColors.black};
  box-shadow: 0 4px 0 ${scColors.blue.dark};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 100ms ease, box-shadow 100ms ease;
  color: ${scColors.white};
  cursor: pointer;

  &:hover {
    filter: brightness(1.1);
  }

  &:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 ${scColors.blue.dark};
  }

  svg {
    width: 18px;
    height: 18px;
  }
`

export const MuteCallButton = styled.button<{ $isMuted: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 100ms ease, box-shadow 100ms ease;
  cursor: pointer;
  border: 3px solid ${scColors.black};

  &:active {
    transform: translateY(3px);
  }

  ${props => props.$isMuted ? css`
    background: linear-gradient(180deg, ${scColors.red.light} 0%, ${scColors.red.base} 100%);
    color: ${scColors.white};
    box-shadow: 0 4px 0 ${scColors.red.dark};

    &:active { box-shadow: 0 1px 0 ${scColors.red.dark}; }
  ` : css`
    background: linear-gradient(180deg, ${scColors.blue.light} 0%, ${scColors.blue.base} 100%);
    color: ${scColors.white};
    box-shadow: 0 4px 0 ${scColors.blue.dark};

    &:active { box-shadow: 0 1px 0 ${scColors.blue.dark}; }
  `}

  svg {
    width: 18px;
    height: 18px;
  }
`

export const CallButton = styled.button<{ $isCalling: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 100ms ease, box-shadow 100ms ease;
  cursor: pointer;
  border: 3px solid ${scColors.black};

  &:active {
    transform: translateY(3px);
  }

  ${props => props.$isCalling ? css`
    background: linear-gradient(180deg, ${scColors.red.light} 0%, ${scColors.red.base} 100%);
    color: ${scColors.white};
    box-shadow: 0 4px 0 ${scColors.red.dark};

    &:active { box-shadow: 0 1px 0 ${scColors.red.dark}; }
  ` : css`
    background: linear-gradient(180deg, ${scColors.green.light} 0%, ${scColors.green.base} 100%);
    color: ${scColors.white};
    box-shadow: 0 4px 0 ${scColors.green.dark};

    &:active { box-shadow: 0 1px 0 ${scColors.green.dark}; }
  `}

  svg {
    width: 18px;
    height: 18px;
  }
`

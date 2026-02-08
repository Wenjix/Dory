/**
 * GamingHub Styled Components
 * Supercell / Brawl Stars game UI style
 */

import styled, { keyframes, css } from 'styled-components'
import { scColors } from '@/theme'

// ==================== KEYFRAMES ====================

const pulseGlow = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const slideInFromBottom = keyframes`
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
`

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`

// ==================== ROOT CONTAINER ====================

export const Root = styled.div`
  position: relative;
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(180deg, ${scColors.pink.light} 0%, ${scColors.pink.dark} 100%);
`

// ==================== BACKGROUND ====================

export const BackgroundLayer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.4)),
    url('/background-persona1.png');
  background-size: cover;
  background-position: center;
  filter: blur(8px) brightness(0.3);
  overflow: hidden;
`

export const AmbientGlowTopRight = styled.div`
  position: absolute;
  top: -200px;
  right: -200px;
  width: 600px;
  height: 600px;
  background: ${scColors.pink.base};
  filter: blur(150px);
  border-radius: 50%;
  opacity: 0.15;
  pointer-events: none;
`

export const AmbientGlowLeft = styled.div`
  position: absolute;
  top: 50%;
  left: -300px;
  width: 600px;
  height: 600px;
  background: ${scColors.blue.base};
  filter: blur(150px);
  border-radius: 50%;
  opacity: 0.1;
  pointer-events: none;
`

export const AmbientGlowBottomLeft = styled.div`
  position: absolute;
  bottom: -300px;
  left: -200px;
  width: 600px;
  height: 600px;
  background: ${scColors.purple.base};
  filter: blur(150px);
  border-radius: 50%;
  opacity: 0.1;
  pointer-events: none;
`

// ==================== NAVIGATION ====================

export const Navigation = styled.nav`
  position: relative;
  z-index: 50;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 2rem;

  @media (min-width: 768px) {
    padding: 0.75rem 3rem;
  }
`

export const NavLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`

export const BackButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  background: linear-gradient(180deg, #ff5252 0%, #d32f2f 100%);
  border: 4px solid ${scColors.black};
  border-radius: 50%;
  box-shadow: 0 4px 0 ${scColors.red.dark};
  color: ${scColors.white};
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease;

  svg {
    width: 1.125rem;
    height: 1.125rem;
  }

  &:hover {
    filter: brightness(1.1);
  }

  &:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 ${scColors.red.dark};
  }
`

export const Brand = styled.div`
  font-size: 2rem;
  font-weight: 700;
  cursor: pointer;
  color: ${scColors.white};
  text-shadow:
    3px 3px 0px ${scColors.black},
    -1px -1px 0px ${scColors.black},
    1px -1px 0px ${scColors.black},
    -1px 1px 0px ${scColors.black};
  font-family: 'Luckiest Guy', cursive;
`

export const NavRight = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
`

export const NavLink = styled.a`
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 150ms ease;

  &:hover {
    color: ${scColors.yellow.base};
  }
`

export const NavButton = styled.button`
  background: linear-gradient(180deg, ${scColors.yellow.light} 0%, ${scColors.yellow.base} 100%);
  color: ${scColors.black};
  padding: 0.625rem 1.5rem;
  border-radius: 12px;
  border: 4px solid ${scColors.black};
  box-shadow: 0 6px 0 ${scColors.yellow.dark};
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease;
  font-family: 'Lilita One', cursive;

  &:active {
    transform: translateY(3px);
    box-shadow: 0 3px 0 ${scColors.yellow.dark};
  }
`

// ==================== MAIN WORKSPACE ====================

export const MainWorkspace = styled.main`
  position: relative;
  z-index: 10;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
`

// ==================== 2-COLUMN CONTAINER ====================

export const HubContainer = styled.div`
  flex: 1;
  display: flex;
  min-height: 0;
  padding: 0 2rem 1.5rem;
  gap: 2rem;
  animation: ${slideInFromBottom} 600ms ease;

  @media (min-width: 768px) {
    padding: 0 3rem 1.5rem;
  }
`

// ==================== LEFT: COMPANION SIDEBAR ====================

export const CompanionSidebar = styled.div`
  display: flex;
  flex-direction: column;
  width: 380px;
  flex-shrink: 0;
  min-height: 0;
  padding-left: 2.5rem;
`

export const SidebarCardOuter = styled.div<{ $isCalling?: boolean }>`
  flex: 1;
  position: relative;
  border-radius: 24px;
  min-height: 0;
  padding: 3px;
  background: ${scColors.black};

  ${props => props.$isCalling && css`
    box-shadow: 0 0 20px ${scColors.pink.base}60, 0 0 40px ${scColors.pink.base}30;
  `}
`

export const SidebarCard = styled.div`
  position: relative;
  height: 100%;
  background: ${scColors.surface};
  border: 6px solid ${scColors.black};
  border-radius: 20px;
  box-shadow: 0 8px 0 rgba(0,0,0,0.4);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  font-weight: 600;
`

export const SidebarScroll = styled.div`
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex: 1;
  min-height: 0;

  &::-webkit-scrollbar { display: none; }
  -ms-overflow-style: none;
  scrollbar-width: none;
`

export const CompanionSection = styled.div`
  flex-shrink: 0;
  width: 100%;
`

export const SidebarContent = styled.div`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`

// ==================== WAVEFORM VISUALIZER ====================

const waveBar = keyframes`
  0% { transform: scaleY(0.25); }
  30% { transform: scaleY(0.9); }
  60% { transform: scaleY(0.5); }
  80% { transform: scaleY(1); }
  100% { transform: scaleY(0.25); }
`

export const WaveformSection = styled.div<{ $variant: 'speaking' | 'listening' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.75rem 1.5rem;
  flex-shrink: 0;
  transition: all 200ms ease;
`

export const WaveformBars = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  height: 1.25rem;
`

export const WaveformBar = styled.div<{ $delay: number; $variant: 'speaking' | 'listening'; $active?: boolean }>`
  width: 4px;
  height: 100%;
  border-radius: 100px;
  transform-origin: center;
  transition: transform 100ms ease, background 150ms ease;

  ${props => props.$active ? css`
    animation: ${waveBar} ${props.$variant === 'speaking' ? '0.8s' : '1.2s'} ease-in-out infinite;
    animation-delay: ${props.$delay * 120}ms;
  ` : css`
    animation: none;
    transform: scaleY(0.12);
  `}

  background: ${props => props.$variant === 'speaking'
    ? scColors.pink.base
    : props.$active ? scColors.black : 'rgba(0,0,0,0.15)'
  };
`

export const WaveformLabel = styled.span<{ $variant: 'speaking' | 'listening' }>`
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${props => props.$variant === 'speaking'
    ? scColors.pink.base
    : 'rgba(0,0,0,0.4)'
  };
  font-family: 'Lilita One', cursive;
`

// ==================== SIDEBAR SEPARATOR ====================

export const SidebarSeparator = styled.div`
  width: 100%;
  height: 3px;
  background: rgba(0, 0, 0, 0.08);
`

// ==================== RIGHT: CHAT COLUMN ====================

export const ChatColumn = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  flex: 1;
  max-width: 62rem;
  margin: 0 auto;
`

export const ChatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.5rem;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
`

export const ChatHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

export const ChatStatusDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${scColors.pink.base};
  border: 2px solid ${scColors.black};
  animation: ${pulseGlow} 2s ease-in-out infinite;
`

export const ChatStatusText = styled.span`
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
`

export const VoiceVisualizerWrapper = styled.div`
  flex-shrink: 0;
  padding: 0.5rem 0;
  margin-bottom: 0.5rem;
`

// ==================== MESSAGE AREA ====================

export const MessageArea = styled.div`
  position: relative;
  flex: 1;
  overflow-y: auto;
  padding: 0 0.5rem 0.5rem;
  padding-top: 2rem;
  min-height: 0;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 3rem);
  mask-image: linear-gradient(to bottom, transparent 0%, black 3rem);
`

export const EmptyMessages = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  opacity: 0.3;

  svg {
    width: 4rem;
    height: 4rem;
    margin-bottom: 1.5rem;
    stroke: ${scColors.white};
  }

  p {
    font-size: 0.875rem;
    font-weight: 700;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: ${scColors.white};
    text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  }
`

export const LoadingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  animation: ${fadeIn} 300ms ease-out;
`

export const LoadingDots = styled.div`
  display: flex;
  gap: 0.375rem;
`

export const LoadingDot = styled.div<{ $delay: number }>`
  width: 8px;
  height: 8px;
  background: ${scColors.pink.base};
  border: 2px solid ${scColors.black};
  border-radius: 50%;
  animation: ${bounce} 1s infinite;
  animation-delay: ${props => props.$delay}ms;
`

// ==================== FLOATING INPUT ====================

export const FloatingInputWrapper = styled.div`
  flex-shrink: 0;
  padding: 0 0.5rem;
  display: flex;
  flex-direction: column;
`

export const InputGlassCard = styled.div`
  background: ${scColors.surface};
  border: 6px solid ${scColors.black};
  border-radius: 20px;
  box-shadow: 0 8px 0 rgba(0,0,0,0.4);
  overflow: visible;
  flex-shrink: 0;
  flex-grow: 0;
  width: 100%;
  color: ${scColors.black};
  font-weight: 600;
`

// ==================== QUICK REPLIES ====================

export const QuickRepliesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin-bottom: 0.5rem;
  border-top: 3px solid rgba(0,0,0,0.08);
  padding-top: 0.5rem;
`

export const QuickRepliesHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem 0.375rem;
`

export const QuickRepliesTitle = styled.span`
  font-size: 0.8125rem;
  line-height: 1.4;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.5);
  font-family: 'Plus Jakarta Sans', sans-serif;
`

export const QuickRepliesActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

export const SurpriseMeButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  height: 1.5rem;
  padding: 0 0.625rem;
  background: linear-gradient(180deg, ${scColors.pink.light} 0%, ${scColors.pink.base} 100%);
  border: 3px solid ${scColors.black};
  border-radius: 8px;
  box-shadow: 0 3px 0 ${scColors.pink.dark};
  font-size: 0.625rem;
  font-weight: 700;
  color: ${scColors.white};
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease;
  white-space: nowrap;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  font-family: 'Lilita One', cursive;

  svg {
    width: 0.625rem;
    height: 0.625rem;
  }

  &:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 ${scColors.pink.dark};
  }
`

export const QuickRepliesToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  background: rgba(0, 0, 0, 0.06);
  border: 2px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  color: rgba(0, 0, 0, 0.4);
  cursor: pointer;
  transition: all 150ms ease;

  svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.1);
    color: rgba(0, 0, 0, 0.6);
  }
`

export const QuickRepliesCollapsed = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.375rem;
  margin-bottom: 0.375rem;
  background: transparent;
  border: none;
  border-top: 3px solid rgba(0,0,0,0.08);
  color: rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 150ms ease;

  svg {
    width: 1rem;
    height: 1rem;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    color: rgba(0, 0, 0, 0.5);
  }
`

export const QuickReplyChip = styled.button<{ $delay?: number }>`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: 0;
  font-size: 0.8125rem;
  line-height: 1.4;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.5);
  cursor: pointer;
  transition: all 100ms ease;
  text-align: left;
  animation: ${fadeInUp} 250ms ease forwards;
  animation-delay: ${props => (props.$delay || 0) * 50}ms;
  opacity: 0;
  font-family: 'Plus Jakarta Sans', sans-serif;

  &:hover {
    background: ${scColors.pink.base}15;
    color: ${scColors.black};
  }

  &:active {
    background: ${scColors.pink.base}25;
  }
`

// ==================== CALL OVERLAY ====================

const callButtonPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 6px 0 ${scColors.green.dark};
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 6px 0 ${scColors.green.dark}, 0 0 30px ${scColors.green.base}60;
  }
`

export const CallOverlay = styled.div`
  position: absolute;
  inset: -1px;
  z-index: 100;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${fadeIn} 300ms ease;
  border-radius: 20px;
`

export const CallOverlayContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 48px;
  animation: ${slideInFromBottom} 400ms ease;
`

export const CallOverlayTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${scColors.white};
  margin: 0;
  text-align: center;
  text-shadow:
    3px 3px 0px ${scColors.black},
    -1px -1px 0px ${scColors.black},
    1px -1px 0px ${scColors.black},
    -1px 1px 0px ${scColors.black};
  font-family: 'Lilita One', cursive;
`

export const CallOverlaySubtitle = styled.p`
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  text-align: center;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  font-family: 'Plus Jakarta Sans', sans-serif;
`

export const CallOverlayButton = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 32px;
  background: linear-gradient(180deg, ${scColors.green.light} 0%, ${scColors.green.base} 100%);
  color: ${scColors.white};
  border: 4px solid ${scColors.black};
  border-radius: 16px;
  box-shadow: 0 6px 0 ${scColors.green.dark};
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.3);
  font-family: 'Lilita One', cursive;
  text-transform: uppercase;
  animation: ${callButtonPulse} 2s infinite;
  transition: transform 100ms ease, box-shadow 100ms ease;

  svg {
    width: 20px;
    height: 20px;
  }

  &:active {
    transform: translateY(4px);
    box-shadow: 0 2px 0 ${scColors.green.dark};
  }
`

// ==================== CONNECTING LOADER ====================

const spinLoader = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const connectingPulse = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
`

export const ConnectingContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  animation: ${fadeIn} 300ms ease;
`

export const ConnectingSpinner = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 5px solid rgba(255, 255, 255, 0.2);
  border-top-color: ${scColors.yellow.base};
  animation: ${spinLoader} 0.8s linear infinite;
`

export const ConnectingLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: ${scColors.yellow.base};
  animation: ${connectingPulse} 1.6s ease-in-out infinite;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  font-family: 'Lilita One', cursive;
`

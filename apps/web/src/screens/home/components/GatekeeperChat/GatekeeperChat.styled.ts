/**
 * GatekeeperChat Styled Components
 * Supercell / Brawl Stars game UI style
 */

import styled, { keyframes, css } from 'styled-components'
import { scColors } from '@/theme'

// ==================== ROOT CONTAINER ====================

export const Root = styled.div<{ $chatActive?: boolean }>`
  position: relative;
  min-height: 100vh;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(180deg, ${scColors.blue.light} 0%, ${scColors.blue.dark} 100%);
`

// ==================== BACKGROUND ====================

export const BackgroundLayer = styled.div<{ $blurred: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.3)),
    url('/background-persona1.png');
  background-size: cover;
  background-position: center;
  filter: ${props => props.$blurred ? 'blur(8px) brightness(0.5)' : 'blur(0) brightness(1)'};
  transition: filter 600ms ease;
`

// ==================== NAVIGATION ====================

export const Navigation = styled.nav`
  position: relative;
  width: 100%;
  max-width: 80rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 2rem;
  z-index: 50;
  flex-shrink: 0;
`

export const NavLeft = styled.div<{ $hasBackButton?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${props => props.$hasBackButton ? '1rem' : '3rem'};
  padding-left: ${props => props.$hasBackButton ? '3.5rem' : '0'};
  transition: padding-left 300ms ease, gap 300ms ease;
`

export const Brand = styled.div<{ $isPersonaBuilder?: boolean }>`
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  cursor: default;
  color: ${scColors.white};
  text-shadow:
    3px 3px 0px ${scColors.black},
    -1px -1px 0px ${scColors.black},
    1px -1px 0px ${scColors.black},
    -1px 1px 0px ${scColors.black},
    1px 1px 0px ${scColors.black};
  font-family: 'Luckiest Guy', cursive;
`

export const NavLinks = styled.div`
  display: none;
  gap: 2rem;

  @media (min-width: 1024px) {
    display: flex;
  }
`

export const NavLink = styled.a`
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 1px 1px 0px rgba(0,0,0,0.3);
  transition: color 150ms ease;

  &:hover {
    color: ${scColors.yellow.base};
  }
`

export const NavRight = styled.div`
  display: flex;
  align-items: center;
  gap: 2rem;
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
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease;
  font-family: 'Lilita One', cursive;

  &:active {
    transform: translateY(3px);
    box-shadow: 0 3px 0 ${scColors.yellow.dark};
  }
`

// ==================== HERO SECTION ====================

const textBounceIn = keyframes`
  0% { opacity: 0; transform: scale(0.5) translateY(20px); }
  60% { transform: scale(1.05) translateY(-5px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
`

export const HeroSection = styled.div<{ $hidden: boolean }>`
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 64rem;
  display: ${props => props.$hidden ? 'none' : 'flex'};
  flex-direction: column;
  align-items: center;
  margin-top: 10vh;
  padding-bottom: 1.5rem;
`

export const HeroContent = styled.div`
  text-align: center;
`

export const HeroBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(0, 0, 0, 0.4);
  border: 3px solid rgba(255, 255, 255, 0.2);
  padding: 0.5rem 1.25rem;
  border-radius: 100px;
  margin-bottom: 1.5rem;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
  animation: ${textBounceIn} 500ms ease-out;
`

export const BadgeDot = styled.div`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: ${scColors.green.base};
  box-shadow: 0 0 8px ${scColors.green.base};
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`

export const BadgeText = styled.span`
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
  font-family: 'Plus Jakarta Sans', sans-serif;
`

export const HeroTitle = styled.h1`
  font-size: 4rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 0.95;
  margin-bottom: 1.25rem;
  color: ${scColors.white};
  text-shadow:
    5px 5px 0px ${scColors.black},
    -2px -2px 0px ${scColors.black},
    2px -2px 0px ${scColors.black},
    -2px 2px 0px ${scColors.black};
  animation: ${textBounceIn} 800ms ease-out 150ms backwards;
  font-family: 'Luckiest Guy', cursive;

  @media (min-width: 768px) {
    font-size: 6rem;
  }
`

export const HeroTitleGradient = styled.span`
  color: ${scColors.yellow.base};
  font-family: 'Luckiest Guy', cursive;
  text-shadow:
    5px 5px 0px ${scColors.black},
    -2px -2px 0px ${scColors.black},
    2px -2px 0px ${scColors.black},
    -2px 2px 0px ${scColors.black};
`

export const HeroSubtitle = styled.p`
  font-size: 1.125rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  max-width: 42rem;
  margin: 0 auto;
  margin-bottom: 1.5rem;
  line-height: 1.5;
  text-shadow: 2px 2px 0px rgba(0,0,0,0.3);
  animation: ${textBounceIn} 800ms ease-out 300ms backwards;
  font-family: 'Plus Jakarta Sans', sans-serif;
`

// ==================== MAIN CONTENT ====================

export const MainContent = styled.main<{ $chatActive: boolean }>`
  position: relative;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: ${props => props.$chatActive ? 'flex-end' : 'flex-start'};
  width: 100%;
  max-width: 100%;
  padding: 0 1rem;
  box-sizing: border-box;
  flex-shrink: 0;
  margin-bottom: ${props => props.$chatActive ? '0' : 'auto'};
  min-height: ${props => props.$chatActive ? 'calc(100vh - 6rem)' : 'auto'};
  transition: none;
`

// ==================== CHAT CONTAINER ====================

export const ChatContainer = styled.div<{ $expanded: boolean }>`
  width: 100%;
  max-width: 48rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-sizing: border-box;

  ${props => props.$expanded ? css`
    flex: 1;
    padding: 1rem 1rem 3rem 1rem;
  ` : css`
    flex: 0;
    padding: 0;
  `}

  transition: none;
`

// ==================== MESSAGE AREA ====================

export const MessageArea = styled.div<{ $visible: boolean }>`
  display: ${props => props.$visible ? 'flex' : 'none'};
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  height: 0;
  width: 100%;
  max-width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.5rem 0.5rem;
  box-sizing: border-box;

  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.3) transparent;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;

    &:hover {
      background: rgba(0, 0, 0, 0.5);
    }
  }
`

// ==================== SCROLL TO BOTTOM BUTTON ====================

export const ScrollToBottomButton = styled.button`
  position: absolute;
  bottom: 6rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  background: linear-gradient(180deg, ${scColors.yellow.light} 0%, ${scColors.yellow.base} 100%);
  border: 4px solid ${scColors.black};
  border-radius: 50%;
  box-shadow: 0 4px 0 ${scColors.yellow.dark};
  color: ${scColors.black};
  cursor: pointer;
  opacity: 0;
  animation: fadeInUp 200ms ease forwards;

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  svg {
    width: 1rem;
    height: 1rem;
  }

  &:hover {
    filter: brightness(1.1);
  }

  &:active {
    transform: translateX(-50%) translateY(3px);
    box-shadow: 0 2px 0 ${scColors.yellow.dark};
  }
`

// ==================== GLASS CARD (Composer wrapper) ====================

export const GlassCard = styled.div<{ $expanded?: boolean; $isPersonaBuilder?: boolean }>`
  background: ${scColors.surface};
  border: 6px solid ${scColors.black};
  border-radius: 20px;
  box-shadow: 0 8px 0 rgba(0,0,0,0.4);
  overflow: hidden;
  flex-shrink: 0;
  flex-grow: 0;
  width: 100%;
  max-width: 48rem;
  color: ${scColors.black};
  font-weight: 600;
  transition: box-shadow 200ms ease;

  ${props => props.$expanded && css`
    box-shadow: 0 8px 0 rgba(0,0,0,0.4), 0 0 0 2px ${props.$isPersonaBuilder ? scColors.purple.base : scColors.yellow.base};
  `}
`

// ==================== CHAT CARD ====================

export const ChatCard = styled.div<{ $isActive: boolean; $isPersonaBuilder?: boolean }>`
  background: ${scColors.surface};
  border: 6px solid ${scColors.black};
  border-radius: 20px;
  box-shadow: 0 8px 0 rgba(0,0,0,0.4);
  overflow: hidden;
  flex-shrink: 0;
  flex-grow: 0;
  width: 100%;
  max-width: 48rem;
  display: flex;
  flex-direction: column;
  color: ${scColors.black};
  font-weight: 600;
  transition: all 200ms ease;

  ${props => props.$isActive && css`
    box-shadow: 0 8px 0 rgba(0,0,0,0.4), 0 0 0 3px ${props.$isPersonaBuilder ? scColors.purple.base : scColors.yellow.base};
  `}
`

// ==================== CHAT HEADER ====================

export const ChatHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 3px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
`

// ==================== CHAT TITLE ====================

export const ChatTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: 700;
  color: ${scColors.black};
  text-shadow: none;
`

// ==================== INPUT AREA ====================

export const InputArea = styled.div`
  padding: 1rem 1.5rem;
  flex-shrink: 0;
  border-top: 3px solid rgba(0, 0, 0, 0.1);
`

// ==================== BACK BUTTON ====================

export const BackButton = styled.button<{ $visible: boolean }>`
  position: fixed;
  top: 1.5rem;
  left: 1.5rem;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  background: linear-gradient(180deg, #ff5252 0%, #d32f2f 100%);
  border: 4px solid ${scColors.black};
  border-radius: 50%;
  box-shadow: 0 4px 0 ${scColors.red.dark};
  color: ${scColors.white};
  cursor: pointer;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);

  svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  &:hover {
    filter: brightness(1.1);
  }

  &:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 ${scColors.red.dark};
  }

  opacity: ${props => props.$visible ? 1 : 0};
  transform: ${props => props.$visible ? 'translateX(0) scale(1)' : 'translateX(-20px) scale(0.8)'};
  pointer-events: ${props => props.$visible ? 'auto' : 'none'};
  transition: opacity 200ms ease, transform 200ms ease;
`

// ==================== FOOTER ====================

export const Footer = styled.footer<{ $hidden: boolean }>`
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 72rem;
  display: ${props => props.$hidden ? 'none' : 'flex'};
  flex-direction: column;
  align-items: center;
  padding-top: 1.5rem;
  padding-bottom: 1.75rem;
  flex-shrink: 0;
`

export const FooterLabel = styled.p`
  font-size: 0.6875rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin-bottom: 1.5rem;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.2);
  font-family: 'Plus Jakarta Sans', sans-serif;
`

export const FooterBrands = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 3.5rem;
`

export const FooterBrand = styled.span`
  font-size: 1.25rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
  text-shadow:
    2px 2px 0px rgba(0,0,0,0.3);
  font-family: 'Lilita One', cursive;
`

// ==================== TERMINAL INFO ====================

export const TerminalInfo = styled.div`
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 50;
  font-size: 0.625rem;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.2);
  cursor: default;

  &:hover {
    color: ${scColors.yellow.base};
  }

  span {
    font-weight: 700;
  }
`

// ==================== TRANSITION LOADER ====================

const pulseGlow = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
`

export const TransitionLoader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 1rem;
  animation: fadeIn 300ms ease-out;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`

export const LoaderDots = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

export const LoaderDot = styled.div<{ $delay: number }>`
  width: 10px;
  height: 10px;
  background: ${scColors.yellow.base};
  border: 2px solid ${scColors.black};
  border-radius: 50%;
  animation: ${pulseGlow} 1.2s ease-in-out infinite;
  animation-delay: ${props => props.$delay}ms;
`

// ==================== QUICK REPLIES ====================

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`

export const QuickRepliesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  padding-top: 0.5rem;
  border-top: 3px solid rgba(0, 0, 0, 0.08);
`

export const QuickRepliesHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem 0.5rem;
`

export const QuickRepliesTitle = styled.span`
  font-size: 0.875rem;
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

export const SurpriseMeButton = styled.button<{ $isPersonaBuilder?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  height: 1.75rem;
  padding: 0 0.75rem;
  background: linear-gradient(180deg,
    ${props => props.$isPersonaBuilder ? scColors.purple.light : scColors.orange.light} 0%,
    ${props => props.$isPersonaBuilder ? scColors.purple.base : scColors.orange.base} 100%
  );
  border: 3px solid ${scColors.black};
  border-radius: 8px;
  box-shadow: 0 3px 0 ${props => props.$isPersonaBuilder ? scColors.purple.dark : scColors.orange.dark};
  font-size: 0.6875rem;
  font-weight: 700;
  color: ${scColors.white};
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease;
  white-space: nowrap;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  font-family: 'Lilita One', cursive;

  svg {
    width: 0.75rem;
    height: 0.75rem;
  }

  &:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 ${props => props.$isPersonaBuilder ? scColors.purple.dark : scColors.orange.dark};
  }
`

export const QuickRepliesToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  background: rgba(0, 0, 0, 0.06);
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  color: rgba(0, 0, 0, 0.4);
  cursor: pointer;
  transition: all 150ms ease;

  svg {
    width: 1rem;
    height: 1rem;
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
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  background: transparent;
  border: none;
  border-top: 3px solid rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 150ms ease;

  svg {
    width: 1.25rem;
    height: 1.25rem;
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
  padding: 0.75rem 1.25rem;
  background: transparent;
  border: none;
  border-radius: 0;
  font-size: 0.9375rem;
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
    background: ${scColors.yellow.base}20;
    color: ${scColors.black};
  }

  &:active {
    background: ${scColors.yellow.base}40;
  }
`

// ==================== LANDING SUGGESTIONS ====================

export const LandingSuggestions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.25rem;
  margin-bottom: 0.5rem;
`

export const LandingSuggestionChip = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: rgba(255, 200, 50, 0.35);
  border: 2.5px solid rgba(255, 180, 0, 0.3);
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.7);
  cursor: pointer;
  transition: all 150ms ease;
  white-space: nowrap;
  font-family: 'Plus Jakarta Sans', sans-serif;
  animation: ${fadeInUp} 300ms ease forwards;

  svg {
    width: 0.875rem;
    height: 0.875rem;
    flex-shrink: 0;
  }

  &:hover {
    background: rgba(255, 200, 50, 0.5);
    border-color: rgba(255, 180, 0, 0.45);
    color: rgba(0, 0, 0, 0.85);
  }

  &:active {
    background: rgba(255, 200, 50, 0.6);
    transform: translateY(1px);
  }
`

// ==================== MODE TRANSITION OVERLAY ====================

const spinAnim = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`

const fadeInAnim = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`

export const ModeTransitionOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, ${scColors.blue.base} 0%, ${scColors.blue.dark} 100%);
  animation: ${fadeInAnim} 200ms ease forwards;
`

export const TransitionContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  animation: ${fadeInUp} 400ms ease forwards;
  animation-delay: 100ms;
  opacity: 0;
`

export const TransitionSpinner = styled.div`
  width: 3.5rem;
  height: 3.5rem;
  border: 5px solid rgba(255, 255, 255, 0.2);
  border-top-color: ${scColors.yellow.base};
  border-radius: 50%;
  animation: ${spinAnim} 800ms linear infinite;
`

export const TransitionText = styled.p`
  font-size: 1.25rem;
  font-weight: 700;
  color: ${scColors.white};
  text-shadow: 2px 2px 0px rgba(0,0,0,0.3);
  text-align: center;
`

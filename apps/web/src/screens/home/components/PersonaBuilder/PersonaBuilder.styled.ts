/**
 * PersonaBuilder Styled Components
 * Supercell / Brawl Stars game UI style
 */

import styled, { keyframes, css } from 'styled-components'
import { scColors } from '@/theme'

// ==================== KEYFRAMES ====================

const spinSlow = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

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
  background: linear-gradient(180deg, ${scColors.purple.light} 0%, ${scColors.purple.dark} 100%);
`

// ==================== BACKGROUND ====================

export const BackgroundLayer = styled.div<{ $isActive: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.4)),
    url('/background-persona1.png');
  background-size: cover;
  background-position: center;
  filter: ${props => props.$isActive ? 'blur(8px) brightness(0.3)' : 'blur(0) brightness(1)'};
  transition: filter 600ms ease;
`

export const DotGridOverlay = styled.div<{ $isActive: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: ${props => props.$isActive ? 0.08 : 0.04};
  background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0);
  background-size: 40px 40px;
  transition: opacity 600ms ease;
`

// ==================== NAVIGATION ====================

export const Navigation = styled.nav`
  position: relative;
  z-index: 50;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;

  @media (min-width: 768px) {
    padding: 1rem 3rem;
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

export const LaunchButton = styled.button`
  background: linear-gradient(180deg, ${scColors.green.light} 0%, ${scColors.green.base} 100%);
  color: ${scColors.white};
  padding: 0.5rem 1.5rem;
  border-radius: 100px;
  border: 4px solid ${scColors.black};
  box-shadow: 0 4px 0 ${scColors.green.dark};
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  font-family: 'Lilita One', cursive;

  &:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 ${scColors.green.dark};
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

// ==================== ARCHITECT CONTAINER (3-column) ====================

export const ArchitectContainer = styled.div<{ $isArchitected: boolean }>`
  flex: 1;
  display: flex;
  min-height: 0;
  padding: 0 2rem 2rem;
  gap: ${props => props.$isArchitected ? '2rem' : '0'};
  justify-content: ${props => props.$isArchitected ? 'flex-start' : 'center'};
  transition: gap 600ms ease;
  animation: ${slideInFromBottom} 600ms ease;

  @media (min-width: 768px) {
    padding: 0 3rem 2rem;
  }
`

// ==================== VISUAL COLUMN (30%) ====================

export const VisualColumn = styled.div<{ $isArchitected: boolean }>`
  display: flex;
  flex-direction: column;
  width: ${props => props.$isArchitected ? '30%' : '0'};
  opacity: ${props => props.$isArchitected ? 1 : 0};
  overflow: hidden;
  transition: width 600ms ease, opacity 600ms ease;
`

export const VisualCard = styled.div`
  flex: 1;
  position: relative;
  background: ${scColors.surface};
  border: 6px solid ${scColors.black};
  border-radius: 24px;
  box-shadow: 0 8px 0 rgba(0,0,0,0.4);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;

  &:hover img {
    transform: scale(1.03);
  }
`

export const ImagePlaceholder = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 3rem;
  background: linear-gradient(180deg, ${scColors.purple.light}20, ${scColors.purple.base}30);
`

export const PersonaImage = styled.img<{ $isGenerating: boolean }>`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 500ms ease;
  transform: ${props => props.$isGenerating ? 'scale(1.05)' : 'scale(1)'};
  filter: ${props => props.$isGenerating ? 'blur(4px) brightness(0.7)' : 'none'};
`

export const ImageGeneratingOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  animation: ${fadeIn} 300ms ease-out;
`

export const GeneratingSpinner = styled.div`
  width: 4rem;
  height: 4rem;
  border: 5px solid rgba(255, 255, 255, 0.2);
  border-top-color: ${scColors.yellow.base};
  border-radius: 50%;
  animation: ${spinSlow} 1s linear infinite;
`

export const GeneratingText = styled.span`
  margin-top: 1.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  animation: ${pulseGlow} 2s ease-in-out infinite;
`

export const VisualCardFooter = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1.5rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
`

export const VisualIdLabel = styled.div`
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: ${scColors.yellow.base};
  margin-bottom: 0.25rem;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.5);
`

export const VisualIdName = styled.div`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${scColors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow:
    3px 3px 0px ${scColors.black},
    -1px -1px 0px ${scColors.black},
    1px -1px 0px ${scColors.black},
    -1px 1px 0px ${scColors.black};
  font-family: 'Lilita One', cursive;
`

// ==================== TRAITS COLUMN (25%) ====================

export const TraitsColumn = styled.div<{ $isArchitected: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: ${props => props.$isArchitected ? '25%' : '0'};
  opacity: ${props => props.$isArchitected ? 1 : 0};
  overflow: hidden;
  transition: width 600ms ease, opacity 600ms ease;
`

export const TraitCard = styled.div`
  flex: 1;
  position: relative;
  background: ${scColors.surface};
  border: 6px solid ${scColors.black};
  border-radius: 20px;
  box-shadow: 0 6px 0 rgba(0,0,0,0.4);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  color: ${scColors.black};
  font-weight: 600;
`

export const TraitHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
`

export const TraitLabel = styled.span`
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${scColors.purple.base};
  font-family: 'Lilita One', cursive;
`

export const TraitContent = styled.div`
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
`

export const TraitText = styled.p<{ $isPlaceholder: boolean }>`
  font-size: 0.875rem;
  line-height: 1.6;
  font-weight: ${props => props.$isPlaceholder ? 400 : 700};
  color: ${props => props.$isPlaceholder ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.7)'};
  margin: 0;
  font-style: ${props => props.$isPlaceholder ? 'italic' : 'normal'};
  transition: opacity 300ms ease;
  white-space: pre-line;
  font-family: 'Plus Jakarta Sans', sans-serif;
`

// ==================== CHAT COLUMN ====================

export const ChatColumn = styled.div<{ $isArchitected: boolean }>`
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  width: ${props => props.$isArchitected ? '45%' : '100%'};
  max-width: ${props => props.$isArchitected ? 'none' : '42rem'};
  transition: width 600ms ease, max-width 600ms ease;
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
  background: ${scColors.green.base};
  border: 2px solid ${scColors.black};
  box-shadow: 0 0 6px ${scColors.green.base};
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

// ==================== MESSAGE AREA ====================

export const MessageArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 0.5rem 1rem;
  min-height: 0;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
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
  gap: 0.5rem;
  padding: 0.5rem;
  animation: ${fadeIn} 300ms ease-out;

  span {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.8);
    text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  }
`

export const LoadingDots = styled.div`
  display: flex;
  gap: 0.375rem;
`

export const LoadingDot = styled.div<{ $delay: number }>`
  width: 8px;
  height: 8px;
  background: ${scColors.yellow.base};
  border: 2px solid ${scColors.black};
  border-radius: 50%;
  animation: ${bounce} 1s infinite;
  animation-delay: ${props => props.$delay}ms;
`

// ==================== FLOATING INPUT ====================

export const FloatingInputWrapper = styled.div`
  flex-shrink: 0;
  padding: 0 0.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
  background: linear-gradient(180deg, ${scColors.purple.light} 0%, ${scColors.purple.base} 100%);
  border: 3px solid ${scColors.black};
  border-radius: 8px;
  box-shadow: 0 3px 0 ${scColors.purple.dark};
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
    box-shadow: 0 1px 0 ${scColors.purple.dark};
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
    background: ${scColors.purple.base}15;
    color: ${scColors.black};
  }

  &:active {
    background: ${scColors.purple.base}25;
  }
`

export const UnsavedDisclaimer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  margin-bottom: 0.75rem;
  background: linear-gradient(180deg, ${scColors.orange.light}30, ${scColors.orange.base}20);
  border: 3px solid ${scColors.orange.base};
  border-radius: 12px;
`

export const DisclaimerIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${scColors.orange.base};
`

export const DisclaimerText = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: ${scColors.orange.dark};
  font-family: 'Plus Jakarta Sans', sans-serif;
`

export const DisclaimerLink = styled.button`
  background: none;
  border: none;
  padding: 0;
  font-size: 0.75rem;
  font-weight: 800;
  color: ${scColors.orange.base};
  text-decoration: underline;
  cursor: pointer;
  transition: color 150ms ease;

  &:hover {
    color: ${scColors.black};
  }
`

export const InputGlow = styled.div`
  display: none; /* No glow in Brawl style */
`

export const InputContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.04);
  border: 3px solid rgba(0, 0, 0, 0.12);
  border-radius: 16px;
  padding: 0.375rem;
  transition: border-color 150ms ease;

  &:focus-within {
    border-color: ${scColors.purple.base}60;
  }
`

export const TextInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 0.875rem 1.25rem;
  font-size: 1rem;
  font-weight: 700;
  color: ${scColors.black};
  font-family: 'Plus Jakarta Sans', sans-serif;

  &::placeholder {
    color: rgba(0, 0, 0, 0.25);
  }

  &:disabled {
    cursor: not-allowed;
  }
`

export const SubmitButton = styled.button<{ $hasValue: boolean; $isLoading: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 12px;
  border: 3px solid ${scColors.black};
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease;

  ${props => props.$hasValue ? css`
    background: linear-gradient(180deg, ${scColors.green.light} 0%, ${scColors.green.base} 100%);
    color: ${scColors.white};
    box-shadow: 0 4px 0 ${scColors.green.dark};
    text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  ` : css`
    background: rgba(0, 0, 0, 0.06);
    color: rgba(0, 0, 0, 0.2);
    box-shadow: 0 3px 0 rgba(0,0,0,0.15);
    border-color: rgba(0,0,0,0.2);
  `}

  svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  &:disabled {
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    ${props => props.$hasValue && css`
      filter: brightness(1.1);
    `}
  }

  &:active:not(:disabled) {
    ${props => props.$hasValue && css`
      transform: translateY(3px);
      box-shadow: 0 1px 0 ${scColors.green.dark};
    `}
  }
`

export const SubmitSpinner = styled.div`
  width: 1rem;
  height: 1rem;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: ${scColors.white};
  border-radius: 50%;
  animation: ${spinSlow} 0.8s linear infinite;
`

// ==================== FOOTER ====================

export const Footer = styled.footer<{ $isActive: boolean }>`
  position: absolute;
  bottom: 1rem;
  left: 3rem;
  z-index: 0;
  opacity: ${props => props.$isActive ? 0.4 : 0};
  transition: opacity 600ms ease;
`

export const FooterContent = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: ${scColors.white};
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
`

export const FooterDot = styled.span`
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
`

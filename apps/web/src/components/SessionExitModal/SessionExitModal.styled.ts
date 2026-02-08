/**
 * SessionExitModal Styled Components
 * Supercell / Brawl Stars game UI style
 */

import styled, { keyframes } from 'styled-components'
import { scColors } from '@/theme'

// ==================== ANIMATIONS ====================

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const bounceIn = keyframes`
  0% { opacity: 0; transform: scale(0.5); }
  60% { transform: scale(1.05); }
  80% { transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
`

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`

const scaleOut = keyframes`
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.8); }
`

// ==================== OVERLAY ====================

export const Overlay = styled.div<{ $isClosing?: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.6);
  animation: ${props => props.$isClosing ? fadeOut : fadeIn} 300ms ease-out forwards;
`

// ==================== MODAL ====================

export const Modal = styled.div<{ $isClosing?: boolean }>`
  position: relative;
  width: 100%;
  max-width: 380px;
  background: ${scColors.surface};
  border: 6px solid ${scColors.black};
  border-radius: 24px;
  box-shadow: 0 10px 0 rgba(0,0,0,0.4);
  padding: 2rem 1.5rem;
  font-weight: 600;
  animation: ${props => props.$isClosing ? scaleOut : bounceIn} 400ms ease-out forwards;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.75rem;
`

// ==================== ICON ====================

export const IconWrapper = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(180deg, ${scColors.orange.light} 0%, ${scColors.orange.base} 100%);
  border: 4px solid ${scColors.black};
  box-shadow: 0 4px 0 ${scColors.orange.dark};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${scColors.white};
  margin-bottom: 0.25rem;

  svg {
    width: 24px;
    height: 24px;
    filter: drop-shadow(1px 1px 0 rgba(0,0,0,0.3));
  }
`

// ==================== TEXT ====================

export const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${scColors.black};
  margin: 0;
  font-family: 'Lilita One', cursive;
`

export const Message = styled.p`
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.6);
  margin: 0;
  max-width: 300px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 600;
`

// ==================== ACTIONS ====================

export const Actions = styled.div`
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.5rem;
`

const BaseButton = styled.button`
  flex: 1;
  padding: 0.875rem 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  border: 4px solid ${scColors.black};
  outline: none;
  position: relative;
  overflow: hidden;
  font-family: 'Lilita One', cursive;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: transform 100ms ease, box-shadow 100ms ease;

  &:active {
    transform: translateY(3px);
  }
`

export const SecondaryButton = styled(BaseButton)`
  background: linear-gradient(180deg, ${scColors.blue.light} 0%, ${scColors.blue.base} 100%);
  color: ${scColors.white};
  box-shadow: 0 6px 0 ${scColors.blue.dark};
  text-shadow: 2px 2px 0px rgba(0,0,0,0.3);

  &:hover {
    filter: brightness(1.1);
  }

  &:active {
    box-shadow: 0 2px 0 ${scColors.blue.dark};
  }
`

export const PrimaryButton = styled(BaseButton)`
  background: linear-gradient(180deg, ${scColors.red.light} 0%, ${scColors.red.base} 100%);
  color: ${scColors.white};
  box-shadow: 0 6px 0 ${scColors.red.dark};
  text-shadow: 2px 2px 0px rgba(0,0,0,0.3);

  &:hover {
    filter: brightness(1.1);
  }

  &:active {
    box-shadow: 0 2px 0 ${scColors.red.dark};
  }

  & > span {
    position: relative;
    z-index: 1;
  }
`

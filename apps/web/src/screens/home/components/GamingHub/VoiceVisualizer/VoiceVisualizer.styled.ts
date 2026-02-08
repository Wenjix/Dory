/**
 * VoiceVisualizer Styled Components
 * Supercell / Brawl Stars game UI style
 */

import styled, { keyframes, css } from 'styled-components'
import { scColors } from '@/theme'

// ==================== COLORS ====================

const COLORS = {
  primary: scColors.blue.base,
  primaryLight: scColors.blue.light,
  success: scColors.green.base,
  successLight: scColors.green.light,
  warning: scColors.orange.base,
  warningLight: scColors.orange.light,
}

// ==================== KEYFRAMES ====================

const agentPulseExpand = keyframes`
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
`

const agentPulseBreathe = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
`

const agentThinkingPulse = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(0.95); }
  50% { opacity: 1; transform: scale(1.05); }
`

// ==================== STYLED COMPONENTS ====================

export const VisualizerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
`

export const AgentPulseContainer = styled.div<{ $state: string }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  margin: 1.25rem auto;
`

export const AgentPulseRing = styled.div<{ $state: string; $delay: number }>`
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 4px solid ${props => {
    switch (props.$state) {
      case 'speaking': return COLORS.primary
      case 'listening': return COLORS.success
      case 'thinking': return COLORS.warning
      default: return 'rgba(0,0,0,0.2)'
    }
  }};
  opacity: ${props => props.$state === 'speaking' ? 0.6 : 0};
  animation: ${props => props.$state === 'speaking'
    ? css`${agentPulseExpand} 1.5s ease-out infinite`
    : 'none'
  };
  animation-delay: ${props => props.$delay}s;
`

export const AgentPulseCore = styled.div<{ $state: string }>`
  position: absolute;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 4px solid ${scColors.black};
  background: ${props => {
    switch (props.$state) {
      case 'speaking': return `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryLight})`
      case 'listening': return `linear-gradient(135deg, ${COLORS.success}, ${COLORS.successLight})`
      case 'thinking': return `linear-gradient(135deg, ${COLORS.warning}, ${COLORS.warningLight})`
      default: return 'rgba(0,0,0,0.15)'
    }
  }};
  box-shadow: ${props => {
    switch (props.$state) {
      case 'speaking': return `0 4px 0 rgba(0,0,0,0.3), 0 0 20px ${COLORS.primary}60`
      case 'listening': return `0 4px 0 rgba(0,0,0,0.3), 0 0 15px ${COLORS.success}40`
      case 'thinking': return `0 4px 0 rgba(0,0,0,0.3), 0 0 15px ${COLORS.warning}40`
      default: return '0 4px 0 rgba(0,0,0,0.2)'
    }
  }};
  animation: ${props => {
    switch (props.$state) {
      case 'speaking': return css`${agentPulseBreathe} 0.8s ease-in-out infinite`
      case 'thinking': return css`${agentThinkingPulse} 1.5s ease-in-out infinite`
      default: return 'none'
    }
  }};
  transition: all 0.2s ease;
`

export const AgentStateLabel = styled.span<{ $state: string }>`
  position: absolute;
  bottom: 0;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-family: 'Lilita One', cursive;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.2);
  color: ${props => {
    switch (props.$state) {
      case 'speaking': return COLORS.primary
      case 'listening': return COLORS.success
      case 'thinking': return COLORS.warning
      default: return 'rgba(255,255,255,0.4)'
    }
  }};
`

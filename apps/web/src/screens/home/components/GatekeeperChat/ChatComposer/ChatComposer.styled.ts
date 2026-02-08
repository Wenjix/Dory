/**
 * ChatComposer Styled Components
 * Supercell / Brawl Stars game UI style
 */

import styled, { keyframes, css } from 'styled-components'
import { scColors } from '@/theme'

export const Container = styled.div`
  padding: 0.75rem;
  overflow: visible;
`

export const ComposerCard = styled.div<{ $accentColor?: string }>`
  position: relative;
  overflow: visible;
  background: rgba(0, 0, 0, 0.04);
  border: 3px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 0.375rem;
  transition: border-color 150ms ease;

  &:focus-within {
    border-color: ${props => props.$accentColor || scColors.blue.base}60;
  }
`

export const Form = styled.form`
  display: flex;
  flex-direction: column;
`

export const TextArea = styled.textarea<{ $rows: number }>`
  width: 100%;
  background: transparent;
  padding: 0.625rem 0.75rem;
  font-size: 0.9375rem;
  font-weight: 700;
  color: ${scColors.black};
  border: none;
  outline: none;
  resize: none;
  font-family: 'Plus Jakarta Sans', sans-serif;
  line-height: 1.4;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  &::placeholder {
    color: rgba(0, 0, 0, 0.3);
  }

  @media (min-width: 768px) {
    font-size: 1rem;
  }
`

export const ControlsBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.375rem 0.375rem;
  overflow: visible;
`

export const ToolsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

export const ToolButton = styled.button<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.06);
  border: 2px solid rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.4);
  cursor: pointer;
  transition: all 150ms ease;

  svg {
    width: 1rem;
    height: 1rem;
  }

  &:hover:not(:disabled) {
    color: ${scColors.black};
    background: rgba(0, 0, 0, 0.1);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`

export const ModesContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem;
  background: rgba(0, 0, 0, 0.04);
  border: 2px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: visible;
`

export const ModeButton = styled.button<{ $active?: boolean; $disabled?: boolean; $accentColor?: string; $label?: string }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  border-radius: 6px;
  background: ${props => props.$active ? `${props.$accentColor || scColors.blue.base}20` : 'transparent'};
  border: ${props => props.$active ? `2px solid ${props.$accentColor || scColors.blue.base}40` : '2px solid transparent'};
  cursor: ${props => props.$disabled ? 'default' : 'pointer'};
  transition: all 150ms ease;

  svg {
    width: 0.875rem;
    height: 0.875rem;
    color: ${props => props.$active ? (props.$accentColor || scColors.blue.base) : 'rgba(0,0,0,0.3)'};
    opacity: ${props => {
      if (!props.$disabled) return 1;
      return props.$active ? 1 : 0.3;
    }};
    transition: color 150ms ease, opacity 150ms ease;
  }

  /* Styled tooltip */
  &::after {
    content: '${props => props.$label || ''}';
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 50%;
    transform: translateX(-50%);
    padding: 0.3rem 0.75rem;
    background: ${scColors.black};
    border: 2px solid rgba(255,255,255,0.2);
    border-radius: 6px;
    font-size: 0.625rem;
    font-weight: 700;
    color: ${scColors.white};
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 150ms ease;
    z-index: 100;
    font-family: 'Plus Jakarta Sans', sans-serif;
  }

  &:hover::after {
    opacity: 1;
  }

  &:hover {
    ${props => !props.$disabled && css`
      svg {
        color: ${props.$active ? (props.$accentColor || scColors.blue.base) : 'rgba(0,0,0,0.5)'};
      }
      background: ${props.$active ? `${props.$accentColor || scColors.blue.base}30` : 'rgba(0,0,0,0.06)'};
    `}
  }
`

export const SubmitButton = styled.button<{ $isLoading?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: 8px;
  background: linear-gradient(180deg, ${scColors.green.light} 0%, ${scColors.green.base} 100%);
  border: 3px solid ${scColors.black};
  box-shadow: 0 4px 0 ${scColors.green.dark};
  color: ${scColors.white};
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);

  svg {
    width: 1rem;
    height: 1rem;
  }

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  &:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow: 0 1px 0 ${scColors.green.dark};
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    background: rgba(0, 0, 0, 0.15);
    border-color: rgba(0, 0, 0, 0.2);
    box-shadow: 0 3px 0 rgba(0,0,0,0.2);
    color: rgba(0,0,0,0.3);
    text-shadow: none;
  }

  ${props => props.$isLoading && css`
    position: relative;
    color: transparent;

    &::after {
      content: '';
      position: absolute;
      width: 0.875rem;
      height: 0.875rem;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: ${scColors.white};
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `}
`

export const LoadingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.2);
`

export const LoadingDots = styled.div`
  display: flex;
  gap: 0.375rem;
`

export const LoadingDot = styled.div<{ $delay: number; $accentColor?: string }>`
  width: 6px;
  height: 6px;
  background: ${props => props.$accentColor || scColors.yellow.base};
  border: 2px solid ${scColors.black};
  border-radius: 50%;
  animation: bounce 1s infinite;
  animation-delay: ${props => props.$delay}ms;

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
`

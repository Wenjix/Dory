/**
 * ChatBubble Styled Components
 * Supercell / Brawl Stars game card style
 */

import styled, { keyframes, css } from 'styled-components'
import { scColors } from '@/theme'

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`

export const MessageWrapper = styled.div<{ $isUser: boolean }>`
  display: flex;
  justify-content: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  width: 100%;
  animation: ${slideIn} 250ms ease-out;
  margin-bottom: 0.75rem;
`

export const MessageBubble = styled.div<{ $isUser: boolean; $accentColor?: string; $hasImages?: boolean }>`
  max-width: 80%;
  padding: 0.75rem 1rem;
  border-radius: 16px;
  border: 4px solid ${scColors.black};

  ${props => props.$isUser ? css`
    background: linear-gradient(180deg, ${scColors.yellow.light} 0%, ${scColors.yellow.base} 100%);
    box-shadow: 0 4px 0 ${scColors.yellow.dark};
    color: ${scColors.black};
    border-bottom-right-radius: 4px;
  ` : css`
    background: ${scColors.surface};
    box-shadow: 0 4px 0 rgba(0,0,0,0.3);
    color: ${scColors.black};
    border-bottom-left-radius: 4px;
  `}
`

export const MessageContent = styled.div<{ $isUser: boolean; $accentColor?: string }>`
  font-size: 0.9375rem;
  line-height: 1.5;
  color: ${scColors.black};
  font-weight: ${props => props.$isUser ? 800 : 600};
  word-wrap: break-word;
  font-family: 'Plus Jakarta Sans', sans-serif;

  p {
    margin: 0 0 0.25rem 0;
    &:last-child { margin-bottom: 0; }
  }

  strong {
    font-weight: 800;
  }

  code {
    background: rgba(0, 0, 0, 0.08);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.8rem;
    border: 1px solid rgba(0,0,0,0.15);
  }

  a {
    color: ${scColors.blue.base};
    text-decoration: underline;
    font-weight: 700;
  }
`

export const MessageTime = styled.span<{ $isUser: boolean }>`
  display: block;
  font-size: 0.625rem;
  font-weight: 700;
  margin-top: 0.25rem;
  color: ${props => props.$isUser ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.3)'};
  font-family: 'Plus Jakarta Sans', sans-serif;
`

export const SystemMessage = styled.div`
  width: 100%;
  text-align: center;
  padding: 0.5rem;
  animation: ${slideIn} 250ms ease-out;
  margin-bottom: 0.5rem;

  span {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(0, 0, 0, 0.35);
    border: 2px solid rgba(255,255,255,0.2);
    padding: 0.375rem 1rem;
    border-radius: 100px;
    text-shadow: 1px 1px 0 rgba(0,0,0,0.2);
    font-family: 'Lilita One', cursive;
  }
`

// ==================== IMAGE GALLERY ====================

export const ImageGallery = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.625rem;
  margin-top: 0.75rem;
  max-width: 450px;
`

export const ImageCard = styled.button`
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  border: 4px solid ${scColors.black};
  background: rgba(0, 0, 0, 0.2);
  box-shadow: 0 4px 0 rgba(0,0,0,0.4);
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease;
  padding: 0;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 rgba(0,0,0,0.4);
  }

  &:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 rgba(0,0,0,0.4);
  }
`

export const ImageOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.5), transparent);
  opacity: 0;
  transition: opacity 200ms ease;
  z-index: 10;
  pointer-events: none;

  ${ImageCard}:hover & {
    opacity: 1;
  }
`

export const PersonaImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

export const ImageGlow = styled.div`
  display: none; /* No glow in Brawl style */
`

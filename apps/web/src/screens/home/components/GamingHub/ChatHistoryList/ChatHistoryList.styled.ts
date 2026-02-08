/**
 * ChatHistoryList Styled Components
 * Supercell / Brawl Stars game UI style
 */

import styled from 'styled-components'
import { scColors } from '@/theme'

export const Root = styled.div`
  width: 100%;
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`

export const Title = styled.h4`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: rgba(0, 0, 0, 0.35);
  margin: 0;
  font-family: 'Lilita One', cursive;
`

export const NewChatButton = styled.button`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${scColors.pink.base};
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  transition: all 150ms ease;
  font-family: 'Lilita One', cursive;

  &:hover {
    background: ${scColors.pink.base}15;
  }

  &:active {
    transform: scale(0.95);
  }
`

export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`

export const HistoryItem = styled.button<{ $isActive: boolean }>`
  width: 100%;
  text-align: left;
  padding: 0.625rem 0.75rem;
  border-radius: 10px;
  border: 3px solid;
  cursor: pointer;
  transition: all 150ms ease;
  display: flex;
  align-items: center;
  gap: 0.625rem;

  background: ${props => props.$isActive ? `${scColors.pink.base}10` : 'rgba(0,0,0,0.02)'};
  border-color: ${props => props.$isActive ? `${scColors.pink.base}40` : 'transparent'};

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    border-color: rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: scale(0.98);
  }
`

export const HistoryIcon = styled.div`
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.06);
  border: 2px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.3);

  svg {
    width: 12px;
    height: 12px;
  }
`

export const HistoryInfo = styled.div`
  flex: 1;
  min-width: 0;
`

export const HistoryTitle = styled.div`
  font-size: 11px;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Plus Jakarta Sans', sans-serif;
`

export const HistoryMeta = styled.div`
  font-size: 9px;
  color: rgba(0, 0, 0, 0.3);
  margin-top: 2px;
  font-family: 'Plus Jakarta Sans', sans-serif;
`

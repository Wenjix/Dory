/**
 * ChatHistoryList Component
 * Shows recent chat sessions with new chat action
 */

import React from 'react'
import { MessageSquare } from 'lucide-react'
import * as S from './ChatHistoryList.styled'

export interface ChatHistoryItem {
  id: string
  title: string
  time: string
}

export interface ChatHistoryListProps {
  onNewChat: () => void
  activeId?: string
}

// Placeholder history items
const HISTORY_ITEMS: ChatHistoryItem[] = [
  { id: '1', title: 'Current Session', time: 'Now' },
  { id: '2', title: 'Minecraft Build Help', time: '2h ago' },
  { id: '3', title: 'Strategy Discussion', time: 'Yesterday' },
]

export const ChatHistoryList: React.FC<ChatHistoryListProps> = ({
  onNewChat,
  activeId = '1',
}) => {
  return (
    <S.Root>
      <S.Header>
        <S.Title>Chat History</S.Title>
        <S.NewChatButton onClick={onNewChat}>+ New</S.NewChatButton>
      </S.Header>

      <S.List>
        {HISTORY_ITEMS.map(item => (
          <S.HistoryItem key={item.id} $isActive={item.id === activeId}>
            <S.HistoryIcon>
              <MessageSquare />
            </S.HistoryIcon>
            <S.HistoryInfo>
              <S.HistoryTitle>{item.title}</S.HistoryTitle>
              <S.HistoryMeta>{item.time}</S.HistoryMeta>
            </S.HistoryInfo>
          </S.HistoryItem>
        ))}
      </S.List>
    </S.Root>
  )
}

export default ChatHistoryList

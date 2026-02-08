/**
 * SessionExitModal Component
 * Confirmation dialog when user wants to exit current session
 */

import React, { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import * as S from './SessionExitModal.styled'

export interface SessionExitModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export const SessionExitModal: React.FC<SessionExitModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <S.Overlay onClick={onClose}>
      <S.Modal onClick={(e) => e.stopPropagation()}>
        <S.IconWrapper>
          <AlertTriangle />
        </S.IconWrapper>

        <S.Title>Exit Current Session?</S.Title>

        <S.Message>
          Are you sure you want to exit the current session? Going back will end the current session.
        </S.Message>

        <S.Actions>
          <S.SecondaryButton onClick={onClose}>
            <span>Keep me here</span>
          </S.SecondaryButton>
          <S.PrimaryButton onClick={onConfirm}>
            <span>Take me out</span>
          </S.PrimaryButton>
        </S.Actions>
      </S.Modal>
    </S.Overlay>
  )
}

export default SessionExitModal

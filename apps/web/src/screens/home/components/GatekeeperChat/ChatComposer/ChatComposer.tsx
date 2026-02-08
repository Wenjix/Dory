/**
 * ChatComposer Component
 * Chat input area
 */

import React, { useCallback, KeyboardEvent } from 'react'
import { Shield, Hammer, Gamepad2, ArrowRight } from 'lucide-react'
import type { ChatMode } from '../GatekeeperChat'
import * as S from './ChatComposer.styled'

export interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  isLoading?: boolean
  disabled?: boolean
  disableModeSelector?: boolean
  mode?: ChatMode
  placeholder?: string
  onModeChange?: (mode: ChatMode) => void
  accentColor?: string
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  disabled = false,
  disableModeSelector = false,
  mode = 'landing',
  placeholder = 'Type your message...',
  onModeChange,
  accentColor,
}) => {

  const modes: { id: ChatMode; icon: typeof Shield; label: string; disabled?: boolean; tooltip?: string }[] = [
    { id: 'landing', icon: Shield, label: 'Gatekeeper' },
    { id: 'persona-builder', icon: Hammer, label: 'Persona Builder' },
    {
      id: 'gaming-agent',
      icon: Gamepad2,
      label: 'Gaming Agent',
      disabled: true,
      tooltip: 'You cannot trigger the gaming mode manually'
    },
  ]

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!value.trim() || isLoading || disabled) return
      onSubmit(value)
    },
    [value, isLoading, disabled, onSubmit]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <S.Container>
      <S.ComposerCard $accentColor={accentColor}>
        <S.Form onSubmit={handleSubmit}>
          <S.TextArea
            rows={2}
            $rows={2}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
          />

          <S.ControlsBar>
            <S.ModesContainer>
              {modes.map(({ id, icon: Icon, label, disabled: modeDisabled }) => {
                const isDisabled = disableModeSelector || modeDisabled

                return (
                  <S.ModeButton
                    key={id}
                    type="button"
                    $active={mode === id}
                    $disabled={isDisabled}
                    $accentColor={accentColor}
                    $label={label}
                    onClick={() => !isDisabled && onModeChange?.(id)}
                  >
                    <Icon />
                  </S.ModeButton>
                )
              })}
            </S.ModesContainer>

            <S.SubmitButton
              type="submit"
              disabled={isLoading || !value.trim() || disabled}
              $isLoading={isLoading}
            >
              <ArrowRight />
            </S.SubmitButton>
          </S.ControlsBar>
        </S.Form>
      </S.ComposerCard>
    </S.Container>
  )
}

export interface ChatLoadingIndicatorProps {
  operationText?: string
  accentColor?: string
}

export const ChatLoadingIndicator: React.FC<ChatLoadingIndicatorProps> = ({ operationText, accentColor }) => (
  <S.LoadingIndicator>
    <S.LoadingDots>
      <S.LoadingDot $delay={0} $accentColor={accentColor} />
      <S.LoadingDot $delay={-300} $accentColor={accentColor} />
      <S.LoadingDot $delay={-500} $accentColor={accentColor} />
    </S.LoadingDots>
    {operationText && <span>{operationText}</span>}
  </S.LoadingIndicator>
)

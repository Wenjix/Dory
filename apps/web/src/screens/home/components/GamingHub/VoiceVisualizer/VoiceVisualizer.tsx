/**
 * VoiceVisualizer Component
 * Shows pulse animation when the AI agent is speaking/listening/thinking
 * Uses LiveKit's useVoiceAssistant hook
 */

import React from 'react'
import {
  useVoiceAssistant,
} from '@livekit/components-react'
import * as S from './VoiceVisualizer.styled'

export const VoiceVisualizer: React.FC = () => {
  const {
    state, // 'idle' | 'listening' | 'thinking' | 'speaking'
  } = useVoiceAssistant()

  return (
    <S.VisualizerWrapper>
      <S.AgentPulseContainer $state={state}>
        <S.AgentPulseRing $state={state} $delay={0} />
        <S.AgentPulseRing $state={state} $delay={0.3} />
        <S.AgentPulseRing $state={state} $delay={0.6} />
        <S.AgentPulseCore $state={state} />
        <S.AgentStateLabel $state={state}>
          {state === 'idle' && 'Ready'}
          {state === 'listening' && 'Listening...'}
          {state === 'thinking' && 'Thinking...'}
          {state === 'speaking' && 'Speaking'}
        </S.AgentStateLabel>
      </S.AgentPulseContainer>
    </S.VisualizerWrapper>
  )
}

export default VoiceVisualizer

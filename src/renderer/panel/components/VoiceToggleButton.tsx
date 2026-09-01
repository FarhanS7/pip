/**
 * Voice State Toggle Button Component (Task H.3)
 *
 * Interactive primary trigger button in Control Panel to manually activate or halt voice recording.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.2 (renderer/panel module)
 *   PHASE_1_MODULES_AND_TASKS.md Task H.3 scoped checklist
 */

import React from 'react'

export interface VoiceToggleButtonProps {
  voiceState: 'idle' | 'listening' | 'processing' | 'responding'
  onToggle: () => void
}

export const VoiceToggleButton: React.FC<VoiceToggleButtonProps> = ({
  voiceState,
  onToggle
}) => {
  const isRecording = voiceState === 'listening' || voiceState === 'processing' || voiceState === 'responding'

  return (
    <button
      className={`pip-btn ${isRecording ? 'pip-btn-danger' : 'pip-btn-primary'}`}
      onClick={onToggle}
      style={{
        width: '100%',
        padding: '12px',
        fontSize: '14px',
        borderRadius: '10px'
      }}
    >
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: isRecording ? '2px' : '50%',
          background: 'currentColor'
        }}
      />
      <span>
        {voiceState === 'listening'
          ? 'Stop Recording'
          : voiceState === 'processing'
          ? 'Cancel Processing'
          : voiceState === 'responding'
          ? 'Stop Speaking'
          : 'Hold or Click to Speak'}
      </span>
    </button>
  )
}

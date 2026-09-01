/**
 * Pulsing Processing Indicator Component (Task G.5)
 *
 * Renders glowing orbital indicator with "Thinking..." text during processing state.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.2 (renderer/overlay module)
 *   PHASE_1_MODULES_AND_TASKS.md Task G.5 scoped checklist
 */

import React from 'react'

export interface ProcessingIndicatorProps {
  isVisible: boolean
}

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  isVisible
}) => {
  if (!isVisible) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        border: '1px solid rgba(56, 189, 248, 0.4)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), 0 0 16px rgba(56, 189, 248, 0.3)',
        pointerEvents: 'none',
        color: '#f8fafc',
        fontSize: '13px',
        fontWeight: 500
      }}
    >
      <div
        className="animate-spin-orbit"
        style={{
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          border: '2px solid rgba(56, 189, 248, 0.3)',
          borderTopColor: '#38bdf8'
        }}
      />
      <span>Thinking...</span>
    </div>
  )
}

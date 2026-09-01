/**
 * Live Audio Waveform Visualizer Component (Task G.4)
 *
 * Renders 5 dynamic audio power bars above Pip during listening state.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.2 (renderer/overlay module)
 *   PHASE_1_MODULES_AND_TASKS.md Task G.4 scoped checklist
 */

import React from 'react'

export interface AudioWaveformProps {
  powerLevel: number // 0.0 to 1.0
  isVisible: boolean
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  powerLevel,
  isVisible
}) => {
  if (!isVisible) return null

  // 5 bar height multipliers for organic waveform variation
  const multipliers = [0.6, 1.0, 1.4, 0.9, 0.5]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        height: '24px',
        padding: '4px 10px',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        borderRadius: '12px',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 0 10px rgba(56, 189, 248, 0.2)',
        pointerEvents: 'none'
      }}
    >
      {multipliers.map((m, idx) => {
        const height = Math.max(4, Math.min(20, Math.round(powerLevel * 20 * m)))
        return (
          <div
            key={idx}
            style={{
              width: '3px',
              height: `${height}px`,
              background: 'linear-gradient(to top, #38bdf8, #6366f1)',
              borderRadius: '2px',
              boxShadow: '0 0 6px rgba(56, 189, 248, 0.6)',
              transition: 'height 0.08s ease-out'
            }}
          />
        )
      })}
    </div>
  )
}

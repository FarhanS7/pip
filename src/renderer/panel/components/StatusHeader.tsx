/**
 * Status Header Component (Task H.2)
 *
 * Displays Pip branding title and real-time voice state status pill in the Control Panel.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.2 (renderer/panel module)
 *   PHASE_1_MODULES_AND_TASKS.md Task H.2 scoped checklist
 */

import React from 'react'

export interface StatusHeaderProps {
  voiceState: 'idle' | 'listening' | 'processing' | 'responding'
}

export const StatusHeader: React.FC<StatusHeaderProps> = ({ voiceState }) => {
  const stateConfig = {
    idle: { label: 'Idle', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
    listening: { label: 'Listening...', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },
    processing: { label: 'Processing...', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)' },
    responding: { label: 'Speaking...', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' }
  }

  const current = stateConfig[voiceState] || stateConfig.idle

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        background: 'rgba(30, 41, 59, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #38bdf8, #3b82f6)',
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 800,
            color: '#0f172a'
          }}
        >
          P
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: '#f8fafc' }}>
            Pip Companion
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            AI Screen Assistant
          </div>
        </div>
      </div>

      {/* Voice State Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '20px',
          background: current.bg,
          border: `1px solid ${current.color}`,
          fontSize: '12px',
          fontWeight: 600,
          color: current.color
        }}
      >
        <div
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: current.color,
            boxShadow: `0 0 8px ${current.color}`
          }}
        />
        <span>{current.label}</span>
      </div>
    </div>
  )
}

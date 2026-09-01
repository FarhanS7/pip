/**
 * Floating Speech Bubble Component (Task G.6)
 *
 * Renders glassmorphic response speech bubble displaying AI vision guide responses.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.2 (renderer/overlay module)
 *   PHASE_1_MODULES_AND_TASKS.md Task G.6 scoped checklist
 */

import React, { useEffect, useRef } from 'react'

export interface SpeechBubbleProps {
  text: string
  isVisible: boolean
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  text,
  isVisible
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [text])

  if (!isVisible || !text || !text.trim()) return null

  return (
    <div
      ref={containerRef}
      className="pip-glass-panel"
      style={{
        maxWidth: '340px',
        maxHeight: '180px',
        overflowY: 'auto',
        padding: '12px 16px',
        fontSize: '14px',
        lineHeight: '1.5',
        color: '#f8fafc',
        pointerEvents: 'auto',
        scrollBehavior: 'smooth'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '11px', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <span>Pip</span>
      </div>
      <div>{text}</div>
    </div>
  )
}

/**
 * Element Bounding Box Highlight Component (Task G.7)
 *
 * Renders glowing cyan target outline box encircling referenced screen UI elements.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.2 (renderer/overlay module)
 *   PHASE_1_MODULES_AND_TASKS.md Task G.7 scoped checklist
 */

import React from 'react'

export interface BoundingBoxRect {
  x: number
  y: number
  width: number
  height: number
}

export interface BoundingBoxHighlightProps {
  rect: BoundingBoxRect | null
  label?: string
  isVisible: boolean
}

export const BoundingBoxHighlight: React.FC<BoundingBoxHighlightProps> = ({
  rect,
  label,
  isVisible
}) => {
  if (!isVisible || !rect) return null

  return (
    <div
      className="animate-box-glow"
      style={{
        position: 'absolute',
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: '2px solid #38bdf8',
        borderRadius: '8px',
        boxShadow: '0 0 16px rgba(56, 189, 248, 0.6), inset 0 0 12px rgba(56, 189, 248, 0.4)',
        pointerEvents: 'none',
        zIndex: 9990,
        transition: 'all 0.2s ease-out'
      }}
    >
      {label && (
        <div
          style={{
            position: 'absolute',
            top: '-24px',
            left: '0',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(56, 189, 248, 0.5)',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '11px',
            color: '#38bdf8',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

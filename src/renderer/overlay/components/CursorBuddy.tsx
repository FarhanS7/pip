/**
 * Animated Blue Cursor Buddy Component (Task G.2)
 *
 * Rendered in the transparent overlay window.
 * Features spring dampening physics, eye tracking, and state-responsive visual effects.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.2 (renderer/overlay module)
 *   PHASE_1_MODULES_AND_TASKS.md Task G.2 scoped checklist
 */

import React, { useEffect, useRef, useState } from 'react'

export interface CursorBuddyProps {
  targetX: number
  targetY: number
  voiceState: 'idle' | 'listening' | 'processing' | 'responding'
}

export const CursorBuddy: React.FC<CursorBuddyProps> = ({
  targetX,
  targetY,
  voiceState
}) => {
  const [pos, setPos] = useState({ x: targetX, y: targetY })
  const velRef = useRef({ vx: 0, vy: 0 })
  const currentPosRef = useRef({ x: targetX, y: targetY })

  // Spring physics loop (k = 180, c = 12)
  useEffect(() => {
    let animId: number
    let lastTime = performance.now()

    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.033) // Cap at ~30fps min
      lastTime = time

      const k = 180
      const c = 12

      const dx = targetX - currentPosRef.current.x
      const dy = targetY - currentPosRef.current.y

      const ax = k * dx - c * velRef.current.vx
      const ay = k * dy - c * velRef.current.vy

      velRef.current.vx += ax * dt
      velRef.current.vy += ay * dt

      currentPosRef.current.x += velRef.current.vx * dt
      currentPosRef.current.y += velRef.current.vy * dt

      setPos({
        x: Math.round(currentPosRef.current.x),
        y: Math.round(currentPosRef.current.y)
      })

      animId = requestAnimationFrame(animate)
    }

    animId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animId)
  }, [targetX, targetY])

  // Pupil offset calculation
  const dx = targetX - pos.x
  const dy = targetY - pos.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const pupilX = (dx / dist) * 3
  const pupilY = (dy / dist) * 3

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 9999,
        transition: 'transform 0.1s ease-out'
      }}
    >
      {/* Outer Glow / State Aura Ring */}
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          position: 'absolute',
          top: '-8px',
          left: '-8px',
          border: voiceState === 'processing'
            ? '2px dashed #38bdf8'
            : voiceState === 'listening'
            ? '2px solid rgba(56, 189, 248, 0.8)'
            : '1px solid rgba(56, 189, 248, 0.2)',
          boxShadow: voiceState === 'listening'
            ? '0 0 24px #38bdf8'
            : '0 0 12px rgba(56, 189, 248, 0.4)',
          animation: voiceState === 'processing' ? 'pulseOrbit 2.4s linear infinite' : 'none'
        }}
      />

      {/* Main Avatar Sphere */}
      <div
        className={voiceState === 'responding' || voiceState === 'idle' ? 'animate-float' : ''}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #38bdf8, #3b82f6 60%, #1e3a8a 100%)',
          boxShadow: '0 8px 24px rgba(59, 130, 246, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          position: 'relative'
        }}
      >
        {/* Left Eye */}
        <div
          style={{
            width: voiceState === 'listening' ? '8px' : '6px',
            height: voiceState === 'listening' ? '10px' : '6px',
            borderRadius: '50%',
            background: '#ffffff',
            position: 'relative',
            transition: 'all 0.2s ease'
          }}
        >
          <div
            style={{
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: '#0f172a',
              transform: `translate(${pupilX}px, ${pupilY}px)`
            }}
          />
        </div>

        {/* Right Eye */}
        <div
          style={{
            width: voiceState === 'listening' ? '8px' : '6px',
            height: voiceState === 'listening' ? '10px' : '6px',
            borderRadius: '50%',
            background: '#ffffff',
            position: 'relative',
            transition: 'all 0.2s ease'
          }}
        >
          <div
            style={{
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: '#0f172a',
              transform: `translate(${pupilX}px, ${pupilY}px)`
            }}
          />
        </div>
      </div>
    </div>
  )
}

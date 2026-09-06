/**
 * Overlay App — Transparent Multi-Monitor Overlay Root Component
 *
 * Mounts CursorBuddy, AudioWaveform, ProcessingIndicator, SpeechBubble, and BoundingBoxHighlight.
 * Handles state synchronization over Electron IPC bridge.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.2 (renderer/overlay module)
 *   PHASE_1_MODULES_AND_TASKS.md Task G.1-G.7 scoped checklist
 */

import React, { useEffect, useState } from 'react'
import './index.css'
import { CursorBuddy } from './components/CursorBuddy'
import { AudioWaveform } from './components/AudioWaveform'
import { ProcessingIndicator } from './components/ProcessingIndicator'
import { SpeechBubble } from './components/SpeechBubble'
import { BoundingBoxHighlight, BoundingBoxRect } from './components/BoundingBoxHighlight'
import { subscribeOverlayEvents, subscribeCursorVisibility } from './events'

function App(): React.JSX.Element {
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing' | 'responding'>('idle')
  const [powerLevel, setPowerLevel] = useState<number>(0)
  const [targetPos, setTargetPos] = useState<{ x: number; y: number }>({
    x: Math.round(window.innerWidth / 2),
    y: Math.round(window.innerHeight / 2)
  })
  const [responseText, setResponseText] = useState<string>('')
  const [targetRect, setTargetRect] = useState<BoundingBoxRect | null>(null)
  const [targetLabel, setTargetLabel] = useState<string>('')
  const [cursorEnabled, setCursorEnabled] = useState(false)


  useEffect(() => {
    if (window.pipAPI) return subscribeCursorVisibility(window.pipAPI, setCursorEnabled)
  }, [])

  useEffect(() => {
    if (!window.pipAPI) return

    const unsubscribe = subscribeOverlayEvents(window.pipAPI, {
      setVoiceState,

      resetResponse: () => {
        setResponseText('')
        setTargetRect(null)
      },
      setPowerLevel,
      setPoint: ({ x, y, label }) => {
        setTargetPos({ x, y })
        setTargetLabel(label ?? '')
        // Display-local conversion and multi-monitor routing are tracked in B18.
        setTargetRect({ x: x - 40, y: y - 20, width: 80, height: 40 })
      },
      appendText: (text) => setResponseText((previous) => previous + text)
    })

    return unsubscribe
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Target Element Highlight Box */}
      <BoundingBoxHighlight
        rect={targetRect}
        label={targetLabel}
        isVisible={cursorEnabled && voiceState === 'responding' && targetRect !== null}
      />

      {/* Animated Cursor Companion */}
      {cursorEnabled && <CursorBuddy
        targetX={targetPos.x}
        targetY={targetPos.y}
        voiceState={voiceState}
      />}

      {/* Auxiliary Overlay Widget Container positioned above Pip */}
      <div
        style={{
          position: 'absolute',
          left: `${targetPos.x}px`,
          top: `${targetPos.y - 45}px`,
          transform: 'translate(-50%, -100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'none',
          zIndex: 9995
        }}
      >
        <AudioWaveform
          powerLevel={powerLevel}
          isVisible={voiceState === 'listening'}
        />

        <ProcessingIndicator
          isVisible={voiceState === 'processing'}
        />

        <SpeechBubble
          text={responseText}
          isVisible={voiceState === 'responding'}
        />
      </div>
    </div>
  )
}

export default App

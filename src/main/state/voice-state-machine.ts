/**
 * Central Voice State Machine
 *
 * Manages deterministic state transitions for the AI companion:
 *   idle ↔ listening ↔ processing ↔ responding
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.1 (main/state module)
 *   PHASE_1_MODULES_AND_TASKS.md Task F.1 scoped checklist
 */

import { BrowserWindow } from 'electron'
import { VoiceState, VoiceStateChangedPayload } from '../../shared/types/ipc'
import { IpcChannel } from '../ipc/channels'
import { PipError } from '../errors'
import { createLogger } from '../logger'

const log = createLogger('state-machine')

export type VoiceStateListener = (state: VoiceState, reason?: string) => void

export class VoiceStateMachine {
  private currentState: VoiceState = 'idle'
  private listeners: Set<VoiceStateListener> = new Set()

  /**
   * Allowed state transition rules map.
   * Maps current state to array of valid next states.
   */
  private readonly allowedTransitions: Record<VoiceState, VoiceState[]> = {
    idle: ['listening'],
    listening: ['processing', 'idle'],
    processing: ['responding', 'idle'],
    responding: ['idle']
  }

  /**
   * Get the current companion state.
   */
  public getState(): VoiceState {
    return this.currentState
  }

  /**
   * Check if a transition to `nextState` is allowed.
   */
  public canTransitionTo(nextState: VoiceState): boolean {
    if (nextState === 'idle') return true // Forced reset to idle is always permitted
    return this.allowedTransitions[this.currentState].includes(nextState)
  }

  /**
   * Transition to `nextState` if valid, otherwise throw PipError.
   *
   * @param nextState - Target voice state
   * @param reason - Optional reason describing the transition trigger
   */
  public transitionTo(nextState: VoiceState, reason?: string): void {
    if (this.currentState === nextState) {
      return // No-op if already in target state
    }

    if (!this.canTransitionTo(nextState)) {
      const errorMsg = `Invalid state transition from '${this.currentState}' to '${nextState}'`
      log.error(errorMsg, { currentState: this.currentState, nextState, reason })
      throw new PipError('INVALID_STATE_TRANSITION', errorMsg, 'medium')
    }

    const previousState = this.currentState
    this.currentState = nextState

    log.info('Voice state changed', { from: previousState, to: nextState, reason })

    // Notify registered JS listeners
    for (const listener of this.listeners) {
      try {
        listener(nextState, reason)
      } catch (err) {
        log.error('Listener callback failed', { error: String(err) })
      }
    }

    // Broadcast IPC message to all renderer windows
    this.broadcastStateChange(nextState, reason)
  }

  /**
   * Force reset companion state back to 'idle'.
   */
  public reset(reason: string = 'force-reset'): void {
    this.currentState = 'idle'
    log.info('Voice state reset to idle', { reason })
    this.broadcastStateChange('idle', reason)
  }

  /**
   * Register a state change listener.
   */
  public onStateChange(listener: VoiceStateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Broadcast state update via IPC to all open BrowserWindows.
   */
  private broadcastStateChange(state: VoiceState, reason?: string): void {
    const payload: VoiceStateChangedPayload = { state, reason }
    const windows = BrowserWindow.getAllWindows()

    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(IpcChannel.VOICE_STATE_CHANGED, payload)
      }
    }
  }
}

// Global state machine singleton instance
export const voiceStateMachine = new VoiceStateMachine()

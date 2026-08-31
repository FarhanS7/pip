/**
 * Shared type definitions for the Pip API exposed via preload bridge.
 *
 * Renderers access this via `window.pip.*` — types defined here
 * ensure main and renderer processes agree on the contract.
 */

export interface PipAPI {
  /** Send a request to main process and await a response (renderer → main). */
  invoke(channel: string, ...args: unknown[]): Promise<unknown>

  /** Subscribe to events from main process (main → renderer). */
  on(channel: string, callback: (...args: unknown[]) => void): void

  /** Unsubscribe from main process events. */
  off(channel: string, callback: (...args: unknown[]) => void): void
}

// Augment the global Window interface so renderers can use `window.pip`
declare global {
  interface Window {
    pip: PipAPI
  }
}

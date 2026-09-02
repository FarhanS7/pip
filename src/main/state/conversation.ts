/**
 * Conversation History Manager
 *
 * Maintains a rolling buffer of recent conversation turns (default max 10 exchanges).
 * Strips coordinate tags before storing assistant turns for clean context history.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.3 (Data / Storage Design — In-memory array, max 10 entries)
 */

import { parsePointingCoordinates } from '../ai/response-parser'

export interface Exchange {
  userTranscript: string
  assistantResponse: string
  timestamp: number
}

export class ConversationHistory {
  private history: Exchange[] = []
  private readonly maxEntries: number

  constructor(maxEntries: number = 10) {
    this.maxEntries = maxEntries
  }

  /**
   * Add a turn exchange to history.
   * Strips coordinate tags from assistant responses before storing.
   */
  public add(userTranscript: string, assistantResponse: string): void {
    const cleanUserText = userTranscript.trim()
    const parsed = parsePointingCoordinates(assistantResponse)
    const cleanAssistantText = parsed.spokenText

    if (!cleanUserText && !cleanAssistantText) {
      return
    }

    this.history.push({
      userTranscript: cleanUserText,
      assistantResponse: cleanAssistantText,
      timestamp: Date.now()
    })

    // Cap rolling window size
    if (this.history.length > this.maxEntries) {
      this.history.shift()
    }
  }

  /**
   * Get formatted conversation history entries.
   */
  public getHistory(): readonly Exchange[] {
    return [...this.history]
  }

  /**
   * Get current number of stored turns.
   */
  public get length(): number {
    return this.history.length
  }

  /**
   * Clear all stored history (e.g. on session reset or app quit).
   */
  public clear(): void {
    this.history = []
  }
}

// Singleton conversation history instance
export const conversationHistory = new ConversationHistory(10)


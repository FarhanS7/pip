import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveMemory,
  queryMemories,
  deleteMemory,
  clearAllMemories
} from './session-memory'

describe('Persistent Session Memory (Task B44 & B45)', () => {
  beforeEach(() => {
    clearAllMemories()
  })

  it('stores and queries memory items', () => {
    saveMemory('goal', 'User wanted to configure Wi-Fi printer')
    saveMemory('preference', 'Prefers dark mode theme')

    const goals = queryMemories('goal')
    expect(goals).toHaveLength(1)
    expect(goals[0].content).toContain('Wi-Fi printer')

    const searchResult = queryMemories(undefined, 'dark mode')
    expect(searchResult).toHaveLength(1)
  })

  it('deletes specific memory items', () => {
    const item = saveMemory('preference', 'Temporary setting preference')
    expect(queryMemories()).toHaveLength(1)

    const success = deleteMemory(item.id)
    expect(success).toBe(true)
    expect(queryMemories()).toHaveLength(0)
  })
})

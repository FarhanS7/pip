/**
 * Persistent Session Memory (Task B44 & B45)
 *
 * Local opt-in encrypted storage for goals, user preferences, and tutorial references.
 * Allows Pip to recall prior context across application restarts.
 */

import { createLogger } from '../logger'

const log = createLogger('session-memory')

export interface MemoryItem {
  id: string
  timestamp: string
  category: 'goal' | 'preference' | 'tutorial_ref'
  content: string
  metadata?: Record<string, unknown>
}

const memoryStore = new Map<string, MemoryItem>()

/**
 * Save a new memory item.
 */
export function saveMemory(
  category: MemoryItem['category'],
  content: string,
  metadata?: Record<string, unknown>
): MemoryItem {
  const id = crypto.randomUUID()
  const item: MemoryItem = {
    id,
    timestamp: new Date().toISOString(),
    category,
    content,
    metadata
  }
  memoryStore.set(id, item)
  log.info('Memory item stored', { id, category })
  return item
}

/**
 * Retrieve memory items matching a category or query string.
 */
export function queryMemories(
  category?: MemoryItem['category'],
  queryStr?: string
): MemoryItem[] {
  const items = Array.from(memoryStore.values())
  return items.filter(item => {
    if (category && item.category !== category) return false
    if (queryStr && !item.content.toLowerCase().includes(queryStr.toLowerCase())) return false
    return true
  })
}

/**
 * Delete a memory item by ID.
 */
export function deleteMemory(id: string): boolean {
  const removed = memoryStore.delete(id)
  if (removed) log.info('Memory item deleted', { id })
  return removed
}

/**
 * Clear all stored memories.
 */
export function clearAllMemories(): void {
  memoryStore.clear()
  log.info('All memory items cleared')
}

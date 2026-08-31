import { describe, it, expect, beforeEach } from 'vitest'
import { ConversationHistory } from './conversation'

describe('ConversationHistory', () => {
  let conversation: ConversationHistory

  beforeEach(() => {
    conversation = new ConversationHistory(3) // Cap at 3 for easy testing
  })

  it('stores turns and caps at maxEntries', () => {
    conversation.add('User turn 1', 'Assistant response 1')
    conversation.add('User turn 2', 'Assistant response 2')
    conversation.add('User turn 3', 'Assistant response 3')

    expect(conversation.length).toBe(3)
    expect(conversation.getHistory()[0].userTranscript).toBe('User turn 1')

    // 4th turn pushes out the 1st turn
    conversation.add('User turn 4', 'Assistant response 4')
    expect(conversation.length).toBe(3)
    expect(conversation.getHistory()[0].userTranscript).toBe('User turn 2')
    expect(conversation.getHistory()[2].userTranscript).toBe('User turn 4')
  })

  it('strips point tags from stored assistant responses', () => {
    conversation.add(
      'Where is the submit button?',
      'Click the button at the bottom right. [POINT:800,600:submit button]'
    )

    const history = conversation.getHistory()
    expect(history[0].assistantResponse).toBe('Click the button at the bottom right.')
  })

  it('clears history', () => {
    conversation.add('Hi', 'Hello')
    expect(conversation.length).toBe(1)

    conversation.clear()
    expect(conversation.length).toBe(0)
    expect(conversation.getHistory()).toEqual([])
  })
})

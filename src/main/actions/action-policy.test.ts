import { describe, it, expect } from 'vitest'
import {
  createActionProposal,
  validateActionProposal,
  DEFAULT_ACTION_POLICY
} from './action-policy'

describe('Permissioned Action Policy Engine (Task B39)', () => {
  it('creates and validates valid action proposals', () => {
    const proposal = createActionProposal(
      'click',
      { x: 500, y: 300, width: 80, height: 30 },
      'User requested clicking submit button',
      undefined,
      'chrome.exe'
    )

    const result = validateActionProposal(proposal)
    expect(result.allowed).toBe(true)
  })

  it('rejects action proposals targeting blocked administrative applications', () => {
    const proposal = createActionProposal(
      'click',
      { x: 100, y: 100 },
      'Attempt administrative action',
      undefined,
      'powershell.exe'
    )

    const result = validateActionProposal(proposal)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('safety blocklist')
  })

  it('rejects expired action proposals', () => {
    const proposal = createActionProposal(
      'click',
      { x: 100, y: 100 },
      'Expired proposal'
    )
    proposal.expiresAt = Date.now() - 1000 // Expired 1 second ago

    const result = validateActionProposal(proposal)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('expired')
  })
})

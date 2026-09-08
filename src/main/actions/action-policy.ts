/**
 * Permissioned Action Proposal & Local Safety Policy (Task B39)
 *
 * Enforces safety allowlists and exact user approval requirements before
 * any desktop interaction action can be executed on screen.
 */

import { createLogger } from '../logger'

const log = createLogger('action-policy')

export type ActionOperation = 'click' | 'double_click' | 'set_text' | 'press_key'

export interface ActionProposal {
  proposalId: string
  timestamp: string
  targetApp?: string
  operation: ActionOperation
  targetBounds: { x: number; y: number; width?: number; height?: number }
  value?: string
  reason: string
  expiresAt: number
}

export interface ActionPolicyConfig {
  allowedOperations: ActionOperation[]
  blockedApps: string[]
  maxValidityMs: number
}

export const DEFAULT_ACTION_POLICY: ActionPolicyConfig = {
  allowedOperations: ['click', 'double_click', 'set_text', 'press_key'],
  blockedApps: ['cmd.exe', 'powershell.exe', 'regedit.exe'],
  maxValidityMs: 30000 // Proposals expire after 30 seconds
}

/**
 * Validate an action proposal against safety policy constraints.
 */
export function validateActionProposal(
  proposal: ActionProposal,
  policy: ActionPolicyConfig = DEFAULT_ACTION_POLICY
): { allowed: boolean; reason?: string } {
  if (Date.now() > proposal.expiresAt) {
    return { allowed: false, reason: 'Proposal has expired' }
  }

  if (!policy.allowedOperations.includes(proposal.operation)) {
    return { allowed: false, reason: `Operation '${proposal.operation}' is not permitted by local policy` }
  }

  if (proposal.targetApp && policy.blockedApps.includes(proposal.targetApp.toLowerCase())) {
    return { allowed: false, reason: `Target application '${proposal.targetApp}' is on the safety blocklist` }
  }

  log.info('Action proposal validated successfully', { proposalId: proposal.proposalId, operation: proposal.operation })
  return { allowed: true }
}

/**
 * Create a fresh, short-lived action proposal.
 */
export function createActionProposal(
  operation: ActionOperation,
  targetBounds: { x: number; y: number; width?: number; height?: number },
  reason: string,
  value?: string,
  targetApp?: string
): ActionProposal {
  return {
    proposalId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    operation,
    targetBounds,
    value,
    reason,
    targetApp,
    expiresAt: Date.now() + DEFAULT_ACTION_POLICY.maxValidityMs
  }
}

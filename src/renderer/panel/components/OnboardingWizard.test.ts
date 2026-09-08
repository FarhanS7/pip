import { describe, it, expect } from 'vitest'
import { OnboardingWizard } from './OnboardingWizard'

describe('OnboardingWizard (Task B26)', () => {
  it('exports OnboardingWizard component function', () => {
    expect(typeof OnboardingWizard).toBe('function')
  })
})

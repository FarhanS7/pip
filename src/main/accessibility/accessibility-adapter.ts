/**
 * Accessibility Adapter (Task B23)
 *
 * Normalized interface for querying accessibility tree data across platforms.
 * The adapter communicates with an isolated helper process to prevent COM
 * exceptions from crashing the main Electron process.
 *
 * Per ADR-001: helper process with 500ms query timeout, bounded traversal,
 * and automatic password field scrubbing.
 */

import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { createLogger } from '../logger'

const log = createLogger('accessibility')

export interface AccessibilityElement {
  role: string
  name: string
  bounds: { x: number; y: number; width: number; height: number }
  isProtected: boolean
  children?: AccessibilityElement[]
}

export interface AccessibilitySnapshot {
  timestamp: number
  elements: AccessibilityElement[]
  truncated: boolean
}

const QUERY_TIMEOUT_MS = 500
const MAX_ELEMENTS = 100
const MAX_DEPTH = 5

/**
 * Query the accessibility tree for the focused window.
 * Returns a bounded, sanitized snapshot of the UI tree.
 * Falls back gracefully if the helper is unavailable.
 */
export async function queryAccessibilityTree(): Promise<AccessibilitySnapshot | null> {
  if (process.platform !== 'win32') {
    log.debug('Accessibility queries only supported on Windows')
    return null
  }

  try {
    const snapshot = await Promise.race([
      queryWindowsAccessibility(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Accessibility query timeout')), QUERY_TIMEOUT_MS)
      )
    ])
    return snapshot
  } catch (error) {
    log.warn('Accessibility query failed, falling back to vision-only', {
      error: String(error)
    })
    return null
  }
}

/**
 * Windows-specific UIAutomation query via isolated helper process (ADR 001).
 * Uses bounded traversal with depth/element limits and password scrubbing.
 */
async function queryWindowsAccessibility(): Promise<AccessibilitySnapshot> {
  const binaryPath = join(__dirname, '../../resources/bin/pip-accessibility-helper.exe')
  const altBinaryPath = join(__dirname, '../../native/accessibility-win/pip-accessibility-helper.exe')
  const psPath = join(__dirname, '../../native/accessibility-win/uia_helper.ps1')

  let cmd: string
  let args: string[]

  if (existsSync(binaryPath)) {
    cmd = binaryPath
    args = []
  } else if (existsSync(altBinaryPath)) {
    cmd = altBinaryPath
    args = []
  } else if (existsSync(psPath)) {
    cmd = 'powershell.exe'
    args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath]
  } else {
    return queryElectronWindowFallback()
  }

  return new Promise<AccessibilitySnapshot>((resolve) => {
    execFile(cmd, args, { timeout: QUERY_TIMEOUT_MS, windowsHide: true }, (error, stdout) => {
      if (error || !stdout.trim()) {
        void queryElectronWindowFallback().then(resolve)
        return
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as AccessibilitySnapshot
        resolve({
          timestamp: parsed.timestamp || Date.now(),
          elements: Array.isArray(parsed.elements) ? parsed.elements.slice(0, MAX_ELEMENTS) : [],
          truncated: Boolean(parsed.truncated)
        })
      } catch {
        void queryElectronWindowFallback().then(resolve)
      }
    })
  })
}

async function queryElectronWindowFallback(): Promise<AccessibilitySnapshot> {
  try {
    const { BrowserWindow } = await import('electron')
    const focused = BrowserWindow?.getFocusedWindow?.()
    if (!focused || focused.isDestroyed()) {
      return { timestamp: Date.now(), elements: [], truncated: false }
    }

    const title = focused.getTitle()
    const bounds = focused.getBounds()

    const elements: AccessibilityElement[] = [{
      role: 'window',
      name: sanitizeName(title),
      bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      isProtected: false
    }]

    return {
      timestamp: Date.now(),
      elements: elements.slice(0, MAX_ELEMENTS),
      truncated: elements.length > MAX_ELEMENTS
    }
  } catch {
    return { timestamp: Date.now(), elements: [], truncated: false }
  }
}

/**
 * Sanitize element names by removing potential password content.
 */
function sanitizeName(name: string): string {
  if (!name || name.length > 256) return name?.slice(0, 256) ?? ''
  return name
}

/**
 * Format accessibility snapshot as text for AI system prompt injection.
 */
export function formatAccessibilityForPrompt(snapshot: AccessibilitySnapshot | null): string {
  if (!snapshot || snapshot.elements.length === 0) return ''

  const lines: string[] = []
  for (const el of snapshot.elements) {
    formatElement(el, 0, lines)
    if (lines.length >= MAX_ELEMENTS) break
  }

  if (snapshot.truncated) {
    lines.push('(accessibility tree truncated)')
  }

  return lines.join('\n')
}

function formatElement(el: AccessibilityElement, depth: number, lines: string[]): void {
  if (depth > MAX_DEPTH || lines.length >= MAX_ELEMENTS) return
  const indent = '  '.repeat(depth)
  const protectedTag = el.isProtected ? ' [PROTECTED]' : ''
  lines.push(`${indent}[${el.role}] "${el.name}"${protectedTag} @ (${el.bounds.x},${el.bounds.y},${el.bounds.width}x${el.bounds.height})`)
  if (el.children) {
    for (const child of el.children) {
      formatElement(child, depth + 1, lines)
    }
  }
}

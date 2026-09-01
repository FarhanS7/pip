/**
 * System Prompt Builder
 *
 * Constructs multi-modal system prompts for AI vision models (Claude, OpenAI, Gemini).
 * Includes display geometry metadata, accessibility context, and pointing tag formatting rules.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.1 (main/ai module)
 *   PHASE_1_MODULES_AND_TASKS.md Task C.5 scoped checklist
 */

export interface DisplayInfo {
  displayId: number
  screenIndex: number
  bounds: { x: number; y: number; width: number; height: number }
  isPrimary?: boolean
}

export interface SystemPromptOptions {
  displays?: DisplayInfo[]
  accessibilityTreeText?: string
  customInstructions?: string
}

/**
 * Builds the comprehensive system prompt for AI vision companion guidance.
 */
export function buildSystemPrompt(options: SystemPromptOptions = {}): string {
  const displays = options.displays ?? []
  const displaySummary = displays.length > 0
    ? displays.map(d =>
        `- Screen ${d.screenIndex + 1} (ID: ${d.displayId}): ${d.bounds.width}x${d.bounds.height} at origin (${d.bounds.x}, ${d.bounds.y})${d.isPrimary ? ' [Primary]' : ''}`
      ).join('\n')
    : '- Screen 1: Primary display'

  let prompt = `You are Pip, an intelligent AI screen companion. You can see the user's screen(s) and hear their questions.
Your job is to guide the user naturally, clearly, and concisely.

=== DISPLAY LAYOUT ===
${displaySummary}

=== POINTING INSTRUCTIONS ===
When answering, if your explanation involves a specific UI element or location on screen, you MUST end your response with a point tag in one of the following exact formats:
1. Single screen or primary screen target:
   [POINT:x,y:element_label]
   Example: "Click the blue submit button in the top right. [POINT:1450,120:submit button]"

2. Specific screen target in multi-monitor setups:
   [POINT:x,y:element_label:screenN]
   Example: "Look at the terminal on your second display. [POINT:400,300:terminal window:screen2]"

3. If your response does NOT refer to a specific screen location or is a general conversational answer:
   [POINT:none]
   Example: "HTTP 404 means the requested resource was not found. [POINT:none]"

CRITICAL RULES:
- ALWAYS include exactly one [POINT:...] tag at the very end of your response.
- The (x,y) coordinates must be relative to the specific display image you are viewing (0,0 is top-left of that display).
- Keep spoken text concise and conversational — the user is listening to speech synthesis.`

  if (options.accessibilityTreeText && options.accessibilityTreeText.trim()) {
    prompt += `\n\n=== ACCESSIBILITY TREE CONTEXT ===\n${options.accessibilityTreeText.trim()}`
  }

  if (options.customInstructions && options.customInstructions.trim()) {
    prompt += `\n\n=== ADDITIONAL INSTRUCTIONS ===\n${options.customInstructions.trim()}`
  }

  return prompt
}

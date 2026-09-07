import type { VisionPromptPayload } from './ai-provider'

/** Attach each current image once, to the latest user message only. */
export function visionMessages(payload: VisionPromptPayload, provider: 'claude' | 'openai' | 'gemini'): unknown[] {
  const images = payload.images ?? (payload.screenshotJpegBase64 ? [{ screenIndex: 0, jpegBase64: payload.screenshotJpegBase64 }] : [])
  if (images.length > 4 || images.reduce((sum, item) => sum + item.jpegBase64.length, 0) > 8 * 1024 * 1024 ||
      new Set(images.map(item => item.screenIndex)).size !== images.length ||
      images.some(item => !Number.isSafeInteger(item.screenIndex) || item.screenIndex < 0 || !item.jpegBase64)) throw new Error('Invalid or excessive screenshot input')
  const messages = payload.messages.filter(message => message.role !== 'system')
  const lastUser = messages.map(message => message.role).lastIndexOf('user')
  return messages.map((message, index) => {
    const current = index === lastUser ? images : []
    if (provider === 'gemini') return {
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }, ...current.flatMap(image => [
        { text: `Screen ${image.screenIndex + 1}` },
        { inline_data: { mime_type: 'image/jpeg', data: image.jpegBase64 } }
      ])]
    }
    if (!current.length) return { role: message.role, content: message.content }
    if (provider === 'openai') return { role: message.role, content: [
      { type: 'text', text: message.content }, ...current.flatMap(image => [
        { type: 'text', text: `Screen ${image.screenIndex + 1}` },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image.jpegBase64}` } }
      ])
    ] }
    return { role: message.role, content: [
      { type: 'text', text: message.content }, ...current.flatMap(image => [
        { type: 'text', text: `Screen ${image.screenIndex + 1}` },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.jpegBase64 } }
      ])
    ] }
  })
}

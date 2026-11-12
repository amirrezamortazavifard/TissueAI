export const OUT_OF_CONTEXT_SIZE = 'out_of_context_size'

export function isContextOverflowMessage(message: string): boolean {
  return message.toLowerCase().includes('context') && 
    (message.toLowerCase().includes('overflow') || message.toLowerCase().includes('exceed'))
}

export function parseContextOverflow(message: string): { requestTokens: number; contextTokens: number } | null {
  const match = message.match(/(\d+)\s*(?:request|input).*?(\d+)\s*(?:context|limit)/i)
  if (match) {
    return { requestTokens: parseInt(match[1]), contextTokens: parseInt(match[2]) }
  }
  return null
}

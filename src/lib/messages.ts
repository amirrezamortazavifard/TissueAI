/* eslint-disable @typescript-eslint/no-explicit-any */
import type { UIMessage } from '@ai-sdk/react'

// TissueAI simplified message types (replacing Jan's @janhq/core types)
export type TissueContentType = 'text' | 'reasoning' | 'image' | 'input_audio' | 'input_video' | 'tool_call'

export type TissueContent =
  | { type: 'text'; text: { value: string; annotations: string[] } }
  | { type: 'reasoning'; text: { value: string; annotations: string[] } }
  | { type: 'image'; image_url: { url: string; detail: string } }
  | { type: 'input_audio'; input_audio: { data: string; format: string } }
  | { type: 'input_video'; input_video: { data: string; format: string } }
  | {
      type: 'tool_call'
      tool_call_id: string
      tool_name: string
      input: unknown
      output?: unknown
    }

export type TissueMessage = {
  id: string
  object: 'thread.message'
  thread_id: string
  role: 'user' | 'assistant' | 'system'
  content: TissueContent[]
  status: 'ready' | 'pending' | 'error'
  created_at: number
  completed_at: number
  metadata?: Record<string, unknown>
}

/**
 * Convert AI SDK UIMessage to TissueAI's TissueMessage format.
 */
export function convertUIMessageToTissueMessage(
  uiMessage: UIMessage,
  threadId: string
): TissueMessage {
  const content: TissueContent[] = []

  for (const part of uiMessage.parts as any[]) {
    if (part.type === 'text') {
      content.push({
        type: 'text',
        text: {
          value: part.text,
          annotations: [],
        },
      })
    } else if (part.type === 'reasoning') {
      const reasoningText = part.reasoning ?? part.text ?? ''
      const existingText = content.find((c) => c.type === 'text')
      if (existingText && existingText.type === 'text') {
        existingText.text.value = `<think>${reasoningText}</think>${existingText.text.value}`
      } else {
        content.unshift({
          type: 'text',
          text: {
            value: `<think>${reasoningText}</think>`,
            annotations: [],
          },
        })
      }
    } else if (part.type === 'file' && part.mediaType) {
      const mediaType = part.mediaType as string
      if (mediaType?.startsWith('image/')) {
        content.push({
          type: 'image',
          image_url: {
            url: part.url,
            detail: 'auto',
          },
        })
      } else if (mediaType === 'audio/wav' || mediaType === 'audio/mpeg') {
        const format = mediaType === 'audio/wav' ? 'wav' : 'mp3'
        const url = part.url as string | undefined
        const data =
          typeof url === 'string' && url.startsWith('data:')
            ? url.slice(url.indexOf(',') + 1)
            : (url ?? '')
        content.push({
          type: 'input_audio',
          input_audio: { data, format },
        })
      } else if (mediaType?.startsWith('video/')) {
        const url = part.url as string | undefined
        const data =
          typeof url === 'string' && url.startsWith('data:')
            ? url.slice(url.indexOf(',') + 1)
            : (url ?? '')
        content.push({
          type: 'input_video',
          input_video: { data, format: mediaType },
        })
      }
    }
  }

  if (content.length === 0) {
    content.push({
      type: 'text',
      text: {
        value: '',
        annotations: [],
      },
    })
  }

  const toolCalls = (uiMessage.parts as any[])
    .filter((part) => part.type.startsWith('tool'))
    .map((part) => {
      const toolName = part.type.replace('tool-', '')
      return {
        tool: {
          id: part.toolCallId || part.toolInvocationId,
          type: 'function' as const,
          function: {
            name: toolName,
            arguments:
              typeof part.input === 'string'
                ? part.input
                : JSON.stringify(part.input ?? part.args),
          },
        },
        state: part.state === 'output-available' ? 'completed' : 'pending',
        response: part.output ?? part.result,
      }
    })

  const metadata = uiMessage.metadata as Record<string, unknown> | undefined
  const createdAt =
    metadata?.createdAt instanceof Date ? metadata.createdAt.getTime() : Date.now()

  return {
    id: uiMessage.id,
    object: 'thread.message',
    thread_id: threadId,
    role: uiMessage.role as TissueMessage['role'],
    content,
    status: 'ready',
    created_at: createdAt,
    completed_at: createdAt,
    metadata: toolCalls.length > 0 ? { tool_calls: toolCalls } : undefined,
  }
}

/**
 * Convert an array of AI SDK UIMessages to TissueAI's TissueMessage format.
 */
export function convertUIMessagesToTissueMessages(
  uiMessages: UIMessage[],
  threadId: string
): TissueMessage[] {
  return uiMessages.map((msg) => convertUIMessageToTissueMessage(msg, threadId))
}

// Define a temporary type for the expected tool result shape (ToolResult as before)
export type ToolResult = {
  content: Array<{
    type?: string
    text?: string
    data?: string
    image_url?: { url: string; detail?: string }
  }>
  error?: string
}

/**
 * Parse reasoning segments from the given text.
 * @param text - The text to parse reasoning from.
 * @returns
 */
export const parseReasoning = (text: string) => {
  // Check for thinking formats
  const hasThinkTag =
    (text.includes('<think>') && !text.includes('</think>')) ||
    (text.includes('<thought>') && !text.includes('</thought>'))
  const hasAnalysisChannel =
    text.includes('<|channel|>analysis<|message|>') &&
    !text.includes('<|start|>assistant<|channel|>final<|message|>')

  if (hasThinkTag || hasAnalysisChannel)
    return { reasoningSegment: text, textSegment: '' }

  // Check for completed think tag format
  const thinkMatch = text.match(/<(think|thought)>([\s\S]*?)<\/\1>/)
  if (thinkMatch?.index !== undefined) {
    const splitIndex = thinkMatch.index + thinkMatch[0].length
    return {
      reasoningSegment: text.slice(0, splitIndex),
      textSegment: text.slice(splitIndex),
    }
  }

  // Check for completed analysis channel format
  const analysisMatch = text.match(
    /<\|channel\|>analysis<\|message\|>([\s\S]*?)<\|start\|>assistant<\|channel\|>final<\|message\|>/
  )
  if (analysisMatch?.index !== undefined) {
    const splitIndex = analysisMatch.index + analysisMatch[0].length
    return {
      reasoningSegment: text.slice(0, splitIndex),
      textSegment: text.slice(splitIndex),
    }
  }

  return { reasoningSegment: undefined, textSegment: text }
}

/**
 * Convert TissueAI's TissueMessage format to AI SDK UIMessage format.
 * This is used to load existing messages into the AI SDK chat.
 */
export function convertTissueMessageToUIMessage(
  tissueMessage: TissueMessage
): UIMessage {
  const parts: any[] = []

  for (const content of tissueMessage.content || []) {
    if (content.type === 'reasoning' && content.text?.value) {
      parts.push({
        type: 'reasoning',
        text: content.text.value,
      })
    } else if (content.type === 'text' && content.text?.value) {
      const { reasoningSegment, textSegment } = parseReasoning(
        content.text.value
      )

      if (reasoningSegment) {
        const completedMatch = reasoningSegment.match(
          /<(think|thought)>([\s\S]*)<\/\1>/
        )
        if (completedMatch) {
          parts.push({
            type: 'reasoning',
            text: completedMatch[2],
          })
        } else {
          const inProgressMatch = reasoningSegment.match(/<(think|thought)>([\s\S]*)/)
          if (inProgressMatch) {
            parts.push({
              type: 'reasoning',
              text: inProgressMatch[2],
            })
          }
        }
      }

      if (textSegment) {
        const trimmedText = textSegment.trim()
        if (trimmedText) {
          parts.push({
            type: 'text',
            text: trimmedText,
          })
        }
      } else if (!reasoningSegment) {
        parts.push({
          type: 'text',
          text: content.text.value,
        })
      }
    } else if (content.type === 'image' && content.image_url?.url) {
      parts.push({
        type: 'file',
        mediaType: 'image/jpeg',
        url: content.image_url.url,
      })
    } else if (content.type === 'input_audio' && content.input_audio?.data) {
      const fmt = content.input_audio.format
      const mediaType = fmt === 'mp3' ? 'audio/mpeg' : 'audio/wav'
      parts.push({
        type: 'file',
        mediaType,
        url: `data:${mediaType};base64,${content.input_audio.data}`,
      })
    } else if (content.type === 'input_video' && content.input_video?.data) {
      const mediaType = content.input_video.format || 'video/mp4'
      parts.push({
        type: 'file',
        mediaType,
        url: `data:${mediaType};base64,${content.input_video.data}`,
      })
    } else if (content.type === 'tool_call') {
      if (content.output != null) {
        parts.push({
          type: `tool-${content.tool_name}`,
          toolCallId: content.tool_call_id,
          input: content.input,
          state: 'output-available',
          output: content.output,
        })
      } else {
        parts.push({
          type: `tool-${content.tool_name}`,
          toolCallId: content.tool_call_id,
          input: content.input,
          state: 'input-available',
        })
      }
    }
  }

  const toolCalls = (tissueMessage.metadata as any)?.tool_calls
  if (Array.isArray(toolCalls)) {
    for (const tc of toolCalls) {
      let result
      if (tc.response?.content) {
        if (tc.response.content.length === 1 && tc.response.content[0].type === 'text') {
          result = tc.response.content[0].text
        } else {
          result = tc.response.content
        }
      }

      const toolName = tc.tool?.function?.name || tc.name
      let toolInput: unknown
      if (typeof tc.tool?.function?.arguments === 'string') {
        try {
          toolInput = JSON.parse(tc.tool.function.arguments)
        } catch (error) {
          console.warn('Failed to parse tool call arguments; using raw string:', error)
          toolInput = tc.tool.function.arguments
        }
      } else {
        toolInput = tc.tool?.function?.arguments || tc.args
      }
      const toolCallId = tc.tool?.id || tc.id

      if (result != null || tc.state === 'ready' || tc.state === 'completed' || tc.state === 'result') {
        parts.push({
          type: `tool-${toolName}`,
          toolCallId,
          input: toolInput,
          state: 'output-available',
          output: result,
        })
      } else {
        parts.push({
          type: `tool-${toolName}`,
          toolCallId,
          input: toolInput,
          state: 'input-available',
        })
      }
    }
  }

  if (parts.length === 0) {
    parts.push({
      type: 'text',
      text: '',
    })
  }

  return {
    id: tissueMessage.id,
    role: tissueMessage.role as 'user' | 'assistant' | 'system',
    parts,
    metadata: {
      ...(tissueMessage.metadata || {}),
      createdAt: new Date(tissueMessage.created_at || Date.now()),
    },
  } as UIMessage
}

export function uiMessageHasMeaningfulContent(message: {
  parts?: any[]
}): boolean {
  if (!message.parts?.length) return false
  for (const part of message.parts) {
    if (!part || typeof part !== 'object') continue
    if (part.type === 'text' && typeof part.text === 'string' && part.text.trim())
      return true
    if (
      part.type === 'reasoning' &&
      ((typeof part.text === 'string' && part.text.trim()) ||
        (typeof part.reasoning === 'string' && part.reasoning.trim()))
    )
      return true
    if (part.type === 'file' && part.url) return true
    if (
      typeof part.type === 'string' &&
      part.type.startsWith('tool-') &&
      (part.input !== undefined || part.args !== undefined ||
        part.output !== undefined || part.result !== undefined)
    )
      return true
  }
  return false
}

export function tissueMessageIsEmpty(message: TissueMessage): boolean {
  if (message.role !== 'assistant') return false
  const content = message.content || []
  if (content.length === 0) return true
  for (const c of content) {
    if (c.type === 'text' || c.type === 'reasoning') {
      if (c.text?.value && c.text.value.trim()) return false
    } else if (c.type === 'image' && c.image_url?.url) {
      return false
    } else if (c.type === 'input_audio' && c.input_audio?.data) {
      return false
    } else if (c.type === 'input_video' && c.input_video?.data) {
      return false
    } else if (c.type === 'tool_call') {
      return false
    }
  }
  return true
}

/**
 * Convert an array of TissueAI's TissueMessages to AI SDK UIMessage format.
 */
export function convertTissueMessagesToUIMessages(
  tissueMessages: TissueMessage[]
): UIMessage[] {
  return tissueMessages
    .map(convertTissueMessageToUIMessage)
    .filter((msg): msg is UIMessage => msg !== null)
}

/**
 * Extract content from UIMessage parts as separate TissueContent items.
 */
export function extractContentPartsFromUIMessage(message: UIMessage): TissueContent[] {
  const content: TissueContent[] = []
  const parts = (message.parts ?? []) as any[]

  for (const part of parts) {
    if (part.type === 'reasoning') {
      const reasoningText = part.reasoning ?? part.text ?? ''
      if (reasoningText) {
        content.push({
          type: 'reasoning',
          text: {
            value: reasoningText,
            annotations: [],
          },
        })
      }
    } else if (part.type === 'text') {
      const textContent = part.text ?? ''
      if (textContent) {
        content.push({
          type: 'text',
          text: {
            value: textContent,
            annotations: [],
          },
        })
      }
    } else if (part.type === 'file' && part.mediaType) {
      const mediaType = part.mediaType as string
      if (mediaType?.startsWith('image/')) {
        content.push({
          type: 'image',
          image_url: {
            url: part.url,
            detail: 'auto',
          },
        })
      } else if (mediaType === 'audio/wav' || mediaType === 'audio/mpeg') {
        const format = mediaType === 'audio/wav' ? 'wav' : 'mp3'
        const url = part.url as string | undefined
        const data =
          typeof url === 'string' && url.startsWith('data:')
            ? url.slice(url.indexOf(',') + 1)
            : (url ?? '')
        content.push({
          type: 'input_audio',
          input_audio: { data, format },
        })
      } else if (mediaType?.startsWith('video/')) {
        const url = part.url as string | undefined
        const data =
          typeof url === 'string' && url.startsWith('data:')
            ? url.slice(url.indexOf(',') + 1)
            : (url ?? '')
        content.push({
          type: 'input_video',
          input_video: { data, format: mediaType },
        })
      }
    } else if (part.type.startsWith('tool-')) {
      const toolName = (part.type as string).replace('tool-', '')
      const toolCallId = part.toolCallId || part.toolInvocationId
      const input = part.input || part.args
      const output = part.output || part.result

      content.push({
        type: 'tool_call',
        tool_call_id: toolCallId,
        tool_name: toolName,
        input: input,
        output: output,
      })
    }
  }

  if (content.length === 0) {
    content.push({
      type: 'text',
      text: {
        value: '',
        annotations: [],
      },
    })
  }

  return content
}

import { useState, useCallback, useMemo } from 'react'
import type { UIMessage } from 'ai'
import { IconLoader2 } from '@tabler/icons-react'
import { useChat } from '@/hooks/use-chat'
import { useModelProvider } from '@/hooks/useModelProvider'
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation'
import { MessageItem } from '@/containers/MessageItem'
import ChatInput from '@/containers/ChatInput'
import DropdownModelProvider from '@/containers/DropdownModelProvider'

const CHAT_STATUS = {
  STREAMING: 'streaming',
  SUBMITTED: 'submitted',
} as const

export default function Chat() {
  const [sessionId] = useState(() => `chat-${Date.now()}`)

  const selectedModel = useModelProvider((state) => state.selectedModel)

  const {
    messages,
    sendMessage,
    stop,
    status,
    error,
  } = useChat({
    sessionId,
    systemMessage: 'You are TissueAI, a helpful assistant for histopathology and tissue analysis.',
  })

  const effectiveStatus = useMemo(() => {
    if (error) return 'error'
    return status
  }, [status, error])

  const handleRegenerate = useCallback((messageId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === messageId)
    if (msgIndex <= 0) return
    const prevUserMsg = messages[msgIndex - 1]
    const text = prevUserMsg.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('') || ''
    if (text) {
      sendMessage({ parts: [{ type: 'text', text }] })
    }
  }, [messages, sendMessage])

  const handleContinue = useCallback((messageId: string) => {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg) return
    const text = msg.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('') || ''
    if (text) {
      sendMessage({ parts: [{ type: 'text', text: 'Continue.' }] })
    }
  }, [messages, sendMessage])

  const handleSubmit = useCallback((text: string) => {
    if (!text.trim()) return
    sendMessage({ parts: [{ type: 'text', text }] })
  }, [sendMessage])

  const isStreaming = effectiveStatus === CHAT_STATUS.STREAMING || effectiveStatus === CHAT_STATUS.SUBMITTED

  return (
    <div className="flex flex-col h-[calc(100dvh-(env(safe-area-inset-bottom)+env(safe-area-inset-top)))]">
      {/* Header */}
      <div className="flex items-center justify-between w-full px-3 py-2 flex-shrink-0">
        <DropdownModelProvider model={selectedModel ?? undefined} />
      </div>

      {/* Messages Area */}
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        <div className="flex-1 relative">
          <Conversation className="absolute inset-0 text-start">
            <ConversationContent className="mx-auto w-full md:w-4/5 xl:w-4/6">
              {messages.map((message, index) => {
                const isLastMessage = index === messages.length - 1
                const isFirstMessage = index === 0
                return (
                  <MessageItem
                    key={message.id}
                    message={message as UIMessage}
                    isFirstMessage={isFirstMessage}
                    isLastMessage={isLastMessage}
                    status={effectiveStatus as any}
                    onRegenerate={handleRegenerate}
                    onContinue={handleContinue}
                  />
                )
              })}
              {effectiveStatus === CHAT_STATUS.SUBMITTED && !isStreaming && (
                <div className="flex flex-row items-center gap-2">
                  <IconLoader2 className="size-4 animate-spin text-[var(--text-4)]" />
                  <span className="text-sm text-[var(--text-4)]">Thinking...</span>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>

        {/* Chat Input - Fixed at bottom */}
        <div className="py-4 mx-auto w-full md:w-4/5 xl:w-4/6">
          <ChatInput
            model={selectedModel ?? undefined}
            onSubmit={handleSubmit}
            onStop={stop}
            chatStatus={effectiveStatus as any}
          />
        </div>
      </div>
    </div>
  )
}

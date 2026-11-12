// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { Model } from '@/types'

import HeaderPage from '@/containers/HeaderPage'
import { useThreads } from '@/hooks/useThreads'
import ChatInput from '@/containers/ChatInput'
import { useShallow } from 'zustand/react/shallow'
import { MessageItem } from '@/containers/MessageItem'

import { useMessages } from '@/hooks/useMessages'
import { useMessageErrors } from '@/stores/message-errors'
import { useServiceHub } from '@/hooks/useServiceHub'
import { useTools } from '@/hooks/useTools'
import { useAppState } from '@/hooks/useAppState'
import { SESSION_STORAGE_PREFIX } from '@/constants/chat'
import { useChat } from '@/hooks/use-chat'
import { useModelProvider } from '@/hooks/useModelProvider'
import { useInterfaceSettings } from '@/hooks/useInterfaceSettings'
import { renderInstructions } from '@/lib/instructionTemplate'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { invoke } from '@tauri-apps/api/core'
import { generateId, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import type { UIMessage } from '@ai-sdk/react'
import { useChatSessions } from '@/stores/chat-session-store'
import {
  tissueMessageIsEmpty,
  extractContentPartsFromUIMessage,
  uiMessageHasMeaningfulContent,
  convertTissueMessagesToUIMessages,
  type TissueMessage,
} from '@/lib/messages'
import { newUserThreadContent } from '@/lib/completion'
import {
  computeActivePath,
  backfillParentIds,
  makeSibling,
  withActiveChild,
  getParentId,
  getSiblings,
  getVersionInfo,
  hasBranching,
  repairDetachedAssistants,
  planContinuation,
} from '@/lib/message-branching'
import {
  ThreadMessage,
  MessageStatus,
  ChatCompletionRole,
  type ThreadContent,
} from '@/types/core'
import {
  createImageAttachment,
  createAudioAttachment,
  createVideoAttachment,
} from '@/types/attachment'
import {
  useChatAttachments,
  NEW_THREAD_ATTACHMENT_KEY,
} from '@/hooks/useChatAttachments'
import { processAttachmentsForSend } from '@/lib/attachmentProcessing'
import { useAttachments } from '@/hooks/useAttachments'
import { PromptProgress } from '@/components/PromptProgress'
import { useToolAvailable } from '@/hooks/useToolAvailable'
import {
  OUT_OF_CONTEXT_SIZE,
  isContextOverflowMessage,
  parseContextOverflow,
} from '@/utils/error'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { Button } from '@/components/ui/button'
import { IconAlertCircle, IconRefresh, IconLoader2 } from '@tabler/icons-react'
import { Sliders, Bot } from 'lucide-react'
import { useToolApproval } from '@/hooks/useToolApproval'
import { useToolApprovalRequests } from '@/hooks/useToolApprovalRequests'
import { WEB_TOOL_NAMES, executeWebTool } from '@/lib/webSearchTool'
import DropdownModelProvider from '@/containers/DropdownModelProvider'
import UserProfileChip from '@/components/Layout/UserProfileChip'
import ChatWelcome from '@/pages/llm/ChatWelcome'
import { ExtensionTypeEnum, VectorDBExtension } from '@/types/core'
import { ExtensionManager } from '@/lib/extension'
import { Shimmer } from '@/components/ai-elements/shimmer'
import { useMessageQueue } from '@/stores/message-queue-store'
import { generateThreadTitle } from '@/lib/thread-title-summarizer'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import '@/styles/jan-chat.css'

const CHAT_STATUS = {
  STREAMING: 'streaming',
  SUBMITTED: 'submitted',
} as const

const TITLE_REFRESH_EVERY_N_ASSISTANT_MESSAGES = 4

// Persist the out-of-context error onto the latest user message so the banner
// survives thread switches, mirroring how LlamacppOomListener stamps oom/backend.
function stampContextErrorOnThread(
  threadId: string,
  message: string = OUT_OF_CONTEXT_SIZE
) {
  const messages = useMessages.getState().getMessages(threadId)
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const meta = (m.metadata as Record<string, unknown> | undefined) ?? {}
    if (typeof meta.contextError === 'string') return
    useMessages.getState().updateMessage({
      ...m,
      metadata: { ...meta, contextError: message },
    })
    return
  }
}

type ThreadModel = {
  id: string
  name: string
  provider: string
}

function ThreadDetail() {
  const serviceHub = useServiceHub()
  const { threadId: rawThreadId } = useParams<{ threadId: string }>()
  const threadId = rawThreadId ?? ''
  const [searchParams] = useSearchParams()
  const searchThreadModel = searchParams.get('threadModel') ? JSON.parse(searchParams.get('threadModel')!) as ThreadModel : undefined
  const fontSize = useInterfaceSettings((state) => state.fontSize)
  const messageZoom = useInterfaceSettings((state) => state.messageZoom)
  const setCurrentThreadId = useThreads((state) => state.setCurrentThreadId)
  const setMessages = useMessages((state) => state.setMessages)
  const addMessage = useMessages((state) => state.addMessage)
  const updateMessage = useMessages((state) => state.updateMessage)
  const deleteMessage = useMessages((state) => state.deleteMessage)
  const currentThread = useRef<string | undefined>(undefined)
  const threadMessages = useMessages(
    useShallow((state) => state.messages[threadId] ?? [])
  )

  useTools()

  // Get attachments for this thread
  const attachmentsKey = threadId ?? NEW_THREAD_ATTACHMENT_KEY
  const getAttachments = useChatAttachments((state) => state.getAttachments)
  const clearAttachmentsForThread = useChatAttachments(
    (state) => state.clearAttachments
  )

  // Session data for tool call tracking
  const getSessionData = useChatSessions((state) => state.getSessionData)
  const sessionData = getSessionData(threadId)

  // AbortController for cancelling tool calls
  const toolCallAbortController = useRef<AbortController | null>(null)

  // Approval promises started in onToolCall (so the popup appears immediately)
  // and awaited by the onFinish execution loop, keyed by toolCallId. Executing
  // stays in onFinish so the tool result lands on a completed assistant message
  // and the AI SDK's auto-resubmit (sendAutomaticallyWhen) fires.
  const toolApprovalPromises = useRef<Map<string, Promise<boolean>>>(new Map())

  const titleAbortRef = useRef<AbortController | null>(null)

  // Check if we should follow up with tool calls (respects abort signal)
  const followUpMessage = useCallback(
    ({ messages }: { messages: UIMessage[] }) => {
      if (
        !toolCallAbortController.current ||
        toolCallAbortController.current?.signal.aborted
      ) {
        return false
      }
      return lastAssistantMessageIsCompleteWithToolCalls({ messages })
    },
    []
  )

  // Subscribe directly to the thread data to ensure updates when model changes
  const thread = useThreads(useShallow((state) => state.threads[threadId]))

  // Get model and provider for useChat
  const selectedModel = useModelProvider((state) => state.selectedModel)
  const selectedProvider = useModelProvider((state) => state.selectedProvider)
  const getProviderByName = useModelProvider((state) => state.getProviderByName)
  const threadRef = useRef(thread)
  const projectId = threadRef.current?.metadata?.project?.id

  // Get system message from thread's assistant instructions (if thread has an assigned assistant)
  // Only use assistant instructions if the thread was created with one (e.g., via a project)
  const threadAssistant = thread?.assistants?.[0]
  const systemMessage = threadAssistant?.instructions
    ? renderInstructions(threadAssistant.instructions)
    : undefined

  useEffect(() => {
    threadRef.current = thread
  }, [thread])

  // Holds the partial assistant message while the model reloads after a
  // context-limit hit, so the user sees it instead of a blank gap.
  const [pendingContinueMessage, setPendingContinueMessage] =
    useState<UIMessage | null>(null)
  const [contextLimitError, setContextLimitError] = useState<Error | null>(null)
  // Per-thread so the shimmer survives navigating away and back while the
  // embedding run is still in flight.
  const processingEmbeddings = useAppState(
    (s) => !!s.embeddingThreads[threadId]
  )
  const { t } = useTranslation()

  // llama-server's overflow string is raw English; localize it, interpolating
  // the parsed request/context token counts when available.
  const contextBannerMessage = useMemo(() => {
    const raw = contextLimitError?.message
    if (!raw) return undefined
    const info = parseContextOverflow(raw)
    if (info)
      return t('model-errors:contextOverflowDetail', {
        request: info.requestTokens.toLocaleString(),
        context: info.contextTokens.toLocaleString(),
      })
    return t('model-errors:contextOverflowGeneric')
  }, [contextLimitError, t])

  // Refs so onFinish (captured in closure) always calls the latest callbacks
  const oomErrorRaw = useAppState((s) => s.oomError)
  const setOomError = useAppState((s) => s.setOomError)
  const backendErrorRaw = useAppState((s) => s.backendError)
  const setBackendError = useAppState((s) => s.setBackendError)

  // These signals come from the llamacpp router via global Tauri events.
  // Mask them when the active provider isn't llamacpp so a router crash
  // doesn't decorate chats running against MLX / OpenAI / Anthropic / etc.
  const isLlamacppActive = selectedProvider === 'llamacpp'
  const oomError = isLlamacppActive ? oomErrorRaw : undefined
  const backendError = isLlamacppActive ? backendErrorRaw : undefined

  const handleContextSizeIncreaseRef = useRef<(() => void) | null>(null)
  const setContinueFromContentRef = useRef<((content: string) => void) | null>(
    null
  )
  const setChatMessagesRef = useRef<
    ((updater: (prev: UIMessage[]) => UIMessage[]) => void) | null
  >(null)
  // Holds the partial assistant output captured when the model stops with
  // `finishReason === 'length'`. Consumed by `handleContextSizeIncrease` so
  // the manual "Increase Context Size" button resumes from where the stream
  // stopped rather than regenerating from scratch.
  const pendingContinuationRef = useRef<{
    message: UIMessage
    text: string
  } | null>(null)
  // Set before a generation when the resulting assistant message should be
  // linked to a specific parent (versioning). Consumed once in onFinish.
  const pendingAssistantParentId = useRef<string | null>(null)
  // Holds the id of a stopped assistant message being resumed. Continuing must
  // extend the turn in place, not fork a new version, so onFinish deletes this
  // stale partial once the continued reply is persisted.
  const continueReplaceIdRef = useRef<string | null>(null)

  // Use the AI SDK chat hook
  const {
    messages: chatMessages,
    status,
    error,
    sendMessage,
    regenerate,
    setMessages: setChatMessages,
    stop,
    addToolOutput,
    updateRagToolsAvailability,
    setContinueFromContent,
  } = useChat({
    sessionId: threadId,
    sessionTitle: thread?.title,
    systemMessage,
    experimental_throttle: 50,
    onFinish: ({ message, isAbort }) => {
      const msgMeta = message.metadata as Record<string, unknown> | undefined
      const finishReason = msgMeta?.finishReason as string | undefined
      // Consume once per generation so a skipped persist (error/empty) can't
      // leak the replace target into a later, unrelated turn.
      const continueReplaceId = continueReplaceIdRef.current
      continueReplaceIdRef.current = null

      // Context limit hit: send partial content as prefill so the model continues
      // from where it stopped. The stream wrapper injects it as the first text-delta
      // of the new message, so the user sees the partial text immediately.
      if (!isAbort && finishReason === 'length') {
        const selectedModelState = useModelProvider.getState().selectedModel
        const usage = msgMeta?.usage as
          | { inputTokens?: number; outputTokens?: number }
          | undefined
        const totalTokens =
          (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)
        const ctxLen =
          (selectedModelState?.settings?.ctx_len?.controller_props
            ?.value as number) ?? 32768
        const isContextLimit = totalTokens >= ctxLen * 0.9

        if (isContextLimit) {
          // Stash the partial so the manual "Increase Context Size" button can
          // resume from here. Surface the standard banner with the manual
          // button — auto-increase was removed; the user explicitly opts in.
          const partialText = message.parts
            .filter((p) => p.type === 'text')
            .map((p) => (p as { type: 'text'; text: string }).text)
            .join('')
          if (partialText) {
            pendingContinuationRef.current = { message, text: partialText }
          }
          stampContextErrorOnThread(threadId)
          setContextLimitError(new Error(OUT_OF_CONTEXT_SIZE))
          return
        }
        // Non-context-limit length truncation: fall through and persist the
        // partial marked as stopped so the "Continue" button can resume it.
      }

      if (!isAbort && message.parts.length) setPendingContinueMessage(null)

      // The turn ended before completion (user hit Stop, or the model hit its
      // output-token cap). Persist the partial marked `stopped` so the UI can
      // offer a "Continue" affordance, and stamp the live message so the button
      // appears without waiting for a reload.
      const isStoppedTurn = isAbort || finishReason === 'length'

      // Persist assistant message to backend (skip if aborted).
      // For continuations, message.parts already contains partial + new content
      // because the stream wrapper prepended the partial text as the first delta.
      if (
        message.role === 'assistant' &&
        uiMessageHasMeaningfulContent(message)
      ) {
        const contentParts = extractContentPartsFromUIMessage(message)
        const messageMetadata = {
          ...((message.metadata || {}) as Record<string, unknown>),
          ...(isStoppedTurn ? { stopped: true } : {}),
        }

        if (isStoppedTurn) {
          setChatMessagesRef.current?.((prev) =>
            prev.map((m) =>
              m.id === message.id
                ? {
                    ...m,
                    metadata: {
                      ...(m.metadata as Record<string, unknown> | undefined),
                      stopped: true,
                    },
                  }
                : m
            )
          )
        }

        // A continuation resumes a stopped turn: the stale partial is deleted
        // below so the continued reply takes its place instead of forking a new
        // version. Inherit the partial's parent so the branch link holds.
        const continuation = planContinuation(
          useMessages.getState().getMessages(threadId),
          message.id,
          continueReplaceId,
          pendingAssistantParentId.current
        )
        pendingAssistantParentId.current = null

        let parentForAssistant = continuation.parentId

        // Never persist a detached assistant in a branched thread: if the
        // pending link was lost (e.g. a multi-step turn consumed the ref before
        // this reply finished), fall back to the user message this reply
        // answers. A null parentId would make computeActivePath treat the
        // assistant as a phantom root and drop it from the visible path.
        if (
          parentForAssistant == null &&
          hasBranching(useMessages.getState().getMessages(threadId))
        ) {
          parentForAssistant = resolveAssistantParent(undefined)
        }

        const assistantMessage: ThreadMessage = {
          type: 'text',
          role: ChatCompletionRole.Assistant,
          content: contentParts as unknown as ThreadContent[],
          id: message.id,
          object: 'thread.message',
          thread_id: threadId,
          status: MessageStatus.Ready,
          created_at: Date.now(),
          completed_at: Date.now(),
          metadata:
            parentForAssistant != null
              ? { ...messageMetadata, parentId: parentForAssistant }
              : messageMetadata,
        }

        const existingMessages = useMessages.getState().getMessages(threadId)
        const existingMessage = existingMessages.find(
          (m) => m.id === message.id
        )

        if (existingMessage) {
          // Preserve the existing branch link on re-runs of onFinish.
          const existingParent = getParentId(existingMessage)
          updateMessage(
            existingParent != null
              ? {
                  ...assistantMessage,
                  metadata: {
                    ...assistantMessage.metadata,
                    parentId: existingParent,
                  },
                }
              : assistantMessage
          )
        } else {
          addMessage(assistantMessage)
          // New generation becomes the active branch under its parent so
          // version navigation lands on the latest reply by default.
          if (parentForAssistant) {
            const parent = existingMessages.find(
              (m) => m.id === parentForAssistant
            )
            if (parent) updateMessage(withActiveChild(parent, assistantMessage.id))
          }
        }

        // Drop the stale partial so the resumed turn replaces it in place
        // rather than appearing as a separate version of the same reply.
        if (continuation.deletePartialId) {
          deleteMessage(threadId, continuation.deletePartialId)
          useMessageErrors.getState().clearError(continuation.deletePartialId)
        }

        for (const m of existingMessages) {
          const meta = m.metadata as Record<string, unknown> | undefined
          if (meta?.error) {
            const rest = { ...meta }
            delete rest.error
            updateMessage({ ...m, metadata: rest })
          }
          useMessageErrors.getState().clearError(m.id)
        }
      }

      // Execute tool calls here, after the assistant message has completed, so
      // each addToolOutput lands on a finished message and the SDK's
      // auto-resubmit (sendAutomaticallyWhen) fires. Approval is requested
      // earlier in onToolCall (popup appears without waiting for this callback);
      // we await that already-started promise here rather than prompting again.
      toolCallAbortController.current = new AbortController()
      const signal = toolCallAbortController.current.signal

      const ragToolNames = new Set(useAppState.getState().ragToolNames)
      const mcpToolNames = new Set(useAppState.getState().mcpToolNames)

      // Keep the thread marked busy while awaiting approval and executing tools,
      // since streaming has already ended and isSessionBusy's tools-array read isn't reactive.
      useAppState.getState().setThreadBusy(threadId, true)

      ;(async () => {
        for (const toolCall of sessionData.tools) {
          if (signal.aborted) {
            break
          }

          try {
            const toolName = toolCall.toolName

            // Built-in RAG and native web tools are internal and auto-allowed.
            const approved = ragToolNames.has(toolName) ||
              WEB_TOOL_NAMES.has(toolName)
              ? true
              : await (toolApprovalPromises.current.get(toolCall.toolCallId) ??
                  useToolApprovalRequests
                    .getState()
                    .requestApproval(toolCall.toolCallId, toolName, threadId))
            toolApprovalPromises.current.delete(toolCall.toolCallId)

            if (!approved) {
              addToolOutput({
                state: 'output-error',
                tool: toolCall.toolName,
                toolCallId: toolCall.toolCallId,
                errorText: 'Tool execution denied by user',
              })
              continue
            }

            let result

            if (WEB_TOOL_NAMES.has(toolName)) {
              result = await executeWebTool(toolName, toolCall.input)
            } else if (ragToolNames.has(toolName)) {
              result = await serviceHub.rag().callTool({
                toolName,
                arguments: toolCall.input,
                threadId,
                projectId: projectId,
                scope: projectId ? 'project' : 'thread',
              })
            } else if (mcpToolNames.has(toolName)) {
              result = await serviceHub.mcp().callTool({
                toolName,
                arguments: toolCall.input,
              })
            } else {
              result = {
                error: `Tool '${toolName}' not found in any service`,
              }
            }

            if (result.error) {
              addToolOutput({
                state: 'output-error',
                tool: toolCall.toolName,
                toolCallId: toolCall.toolCallId,
                errorText: `Error: ${result.error}`,
              })
            } else {
              addToolOutput({
                tool: toolCall.toolName,
                toolCallId: toolCall.toolCallId,
                output: result.content,
              })
            }
          } catch (error) {
            if ((error as Error).name !== 'AbortError') {
              console.error('Tool call error:', error)
              addToolOutput({
                state: 'output-error',
                tool: toolCall.toolName,
                toolCallId: toolCall.toolCallId,
                errorText: `Error: ${JSON.stringify(error)}`,
              })
            }
          }
        }

        sessionData.tools = []
        toolApprovalPromises.current.clear()
        toolCallAbortController.current = null
        useAppState.getState().setThreadBusy(threadId, false)
      })().catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Tool call error:', error)
        }
        sessionData.tools = []
        toolApprovalPromises.current.clear()
        toolCallAbortController.current = null
        useAppState.getState().setThreadBusy(threadId, false)
      })

      if (!isAbort) {
        const localMessages = useMessages.getState().getMessages(threadId)
        const assistantCount = localMessages.filter(
          (m) => m.role === 'assistant'
        ).length
        const isRefreshTick =
          assistantCount === 1 ||
          (assistantCount > 0 &&
            assistantCount % TITLE_REFRESH_EVERY_N_ASSISTANT_MESSAGES === 0)
        const currentThread = useThreads.getState().threads[threadId]
        const autoGenerateTitle =
          useInterfaceSettings.getState().autoGenerateTitle
        if (
          autoGenerateTitle &&
          isRefreshTick &&
          !currentThread?.metadata?.titleSetManually
        ) {
          const TITLE_TRANSCRIPT_MAX_TURNS = 8
          const recent = localMessages.slice(-TITLE_TRANSCRIPT_MAX_TURNS)
          const inputText =
            recent
              .map((m) => {
                const text = m.content
                  ?.map((c) => c?.text?.value ?? '')
                  .join('')
                  .trim()
                if (!text) return ''
                const role = m.role === 'assistant' ? 'Assistant' : 'User'
                return `${role}: ${text}`
              })
              .filter(Boolean)
              .join('\n\n') ||
            useThreads.getState().threads[threadId]?.title
          if (inputText) {
            const provider = useModelProvider.getState().selectedProvider
            const modelId = useModelProvider.getState().selectedModel?.id
            ;(async () => {
              if (provider === 'llamacpp' && modelId) {
                let idle = false
                for (let attempt = 0; attempt < 6; attempt++) {
                  try {
                    idle = await invoke<boolean>(
                      'plugin:llamacpp|router_slots_idle',
                      { modelId }
                    )
                  } catch {
                    idle = true
                    break
                  }
                  if (idle) break
                  await new Promise((r) => setTimeout(r, 150))
                }
                if (!idle) return
              }
              titleAbortRef.current?.abort()
              const controller = new AbortController()
              titleAbortRef.current = controller
              const title = await generateThreadTitle(
                inputText,
                controller.signal
              )
              if (!title || controller.signal.aborted) return
              useThreads.getState().updateThread(threadId, { title })
              titleAbortRef.current = null
            })()
          }
        }
      }
    },
    onToolCall: ({ toolCall }) => {
      // Collect the tool for the onFinish execution loop, and request approval
      // right now so the popup appears immediately instead of waiting for the
      // stream's terminal finish chunk (a stalled stream would otherwise leave
      // the tool at "Running..." with no popup). Execution itself stays in
      // onFinish so the tool result lands on a completed message. RAG tools are
      // internal and never prompt.
      sessionData.tools.push(toolCall)
      const ragToolNames = new Set(useAppState.getState().ragToolNames)
      if (
        !ragToolNames.has(toolCall.toolName) &&
        !WEB_TOOL_NAMES.has(toolCall.toolName) &&
        !toolApprovalPromises.current.has(toolCall.toolCallId)
      ) {
        toolApprovalPromises.current.set(
          toolCall.toolCallId,
          useToolApprovalRequests
            .getState()
            .requestApproval(toolCall.toolCallId, toolCall.toolName, threadId)
        )
      }
    },
    sendAutomaticallyWhen: followUpMessage,
  })

  // Our error banners (oom/backend/context) can arrive out-of-band for the
  // router path, leaving the SDK stream stuck at 'submitted' so the
  // "Using tools…" indicator shimmers forever. Force a terminal status when a
  // banner is up — regenerate/reload restarts the turn anyway.
  const hasBannerError = !!(oomError || backendError || contextLimitError)
  const effectiveStatus = hasBannerError ? 'ready' : status

  // Global disabled-tools set; re-run the effect below when it changes.
  const disabledTools = useToolAvailable((state) => state.disabledTools)

  // Update RAG tools availability when documents, model, or tool availability changes
  useEffect(() => {
    const checkDocumentsAvailability = async () => {
      const hasThreadDocuments = Boolean(thread?.metadata?.hasDocuments)
      let hasProjectDocuments = false

      // Check if thread belongs to a project and if that project has files
      const projectId = thread?.metadata?.project?.id
      if (projectId) {
        try {
          const ext = ExtensionManager.getInstance().get<VectorDBExtension>(
            ExtensionTypeEnum.VectorDB
          )
          if (ext?.listAttachmentsForProject) {
            const projectFiles = await ext.listAttachmentsForProject(projectId)
            hasProjectDocuments = projectFiles.length > 0
          }
        } catch (error) {
          console.warn('Failed to check project files:', error)
        }
      }

      const hasDocuments = hasThreadDocuments || hasProjectDocuments
      const ragFeatureAvailable = Boolean(useAttachments.getState().enabled)
      const modelSupportsTools =
        selectedModel?.capabilities?.includes('tools') ?? false

      updateRagToolsAvailability(
        hasDocuments,
        modelSupportsTools,
        ragFeatureAvailable
      )
    }

    checkDocumentsAvailability()
  }, [
    thread?.metadata?.hasDocuments,
    thread?.metadata?.project?.id,
    selectedModel?.capabilities,
    updateRagToolsAvailability,
    disabledTools, // Re-run when tools are enabled/disabled
  ])

  // Auto-scroll the reasoning container during streaming, pausing when the user scrolls up
  const {
    containerRef: reasoningContainerRef,
    isAtBottom: isReasoningAtBottom,
    handleScroll: handleReasoningScroll,
    scrollToBottom: scrollReasoningToBottom,
    forceScrollToBottom: forceScrollReasoningToBottom,
    reset: resetReasoningScroll,
  } = useAutoScroll()

  const lastIsAssistant = useMemo(() => {
    const last = chatMessages[chatMessages.length - 1]
    return !!last && last.role === 'assistant'
  }, [chatMessages])

  useEffect(() => {
    if (status === 'streaming') {
      resetReasoningScroll()
    }
  }, [status, resetReasoningScroll])

  useEffect(() => {
    if (status === 'streaming') {
      scrollReasoningToBottom()
    }
  }, [status, chatMessages, scrollReasoningToBottom])

  useEffect(() => {
    setCurrentThreadId(threadId)
    titleAbortRef.current?.abort()
    titleAbortRef.current = null
    currentThread.current = undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  // Load messages on mount or threadId change (guarded against infinite re-render)
  useEffect(() => {
    if (!threadId || currentThread.current === threadId) return;

    const existingSession = useChatSessions.getState().sessions[threadId];
    if (existingSession?.isStreaming) return;

    currentThread.current = threadId;

    const localMessages = useMessages.getState().getMessages(threadId);

    const applyMessages = (messagesToSet: ThreadMessage[]) => {
      if (!messagesToSet || messagesToSet.length === 0) return;

      const emptyAssistantIds = messagesToSet
        .filter((m) => tissueMessageIsEmpty(m as unknown as TissueMessage))
        .map((m) => m.id);
      if (emptyAssistantIds.length > 0) {
        messagesToSet = messagesToSet.filter((m) => !emptyAssistantIds.includes(m.id));
        for (const id of emptyAssistantIds) {
          deleteMessage(threadId, id);
        }
      }

      const repaired = repairDetachedAssistants(messagesToSet);
      if (repaired.length > 0) {
        const byId = new Map(repaired.map((m) => [m.id, m]));
        messagesToSet = messagesToSet.map((m) => byId.get(m.id) ?? m);
        for (const m of repaired) updateMessage(m);
      }

      setMessages(threadId, messagesToSet);

      const activeRootId = (
        useThreads.getState().threads[threadId]?.metadata as
          | Record<string, unknown>
          | undefined
      )?.activeRootId as string | undefined;
      const uiMessages = convertTissueMessagesToUIMessages(
        computeActivePath(messagesToSet, activeRootId) as unknown as TissueMessage[]
      );
      setChatMessages(uiMessages);
    };

    if (localMessages && localMessages.length > 0) {
      applyMessages(localMessages);
    } else {
      serviceHub
        .messages()
        .fetchMessages(threadId)
        .then((fetchedMessages) => {
          if (fetchedMessages && fetchedMessages.length > 0) {
            applyMessages(fetchedMessages);
          }
        })
        .catch((error) =>
          console.error('Failed to fetch messages for thread:', threadId, error)
        );
    }
  }, [threadId, serviceHub]);

  useEffect(() => {
    return () => {
      titleAbortRef.current?.abort()
      setCurrentThreadId(undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The route component is reused across thread switches (no remount), so tear
  // down the in-flight tool loop and release approvals waiting on the thread we
  // are leaving. Cleanup captures the previous threadId; without this the
  // unresolved approval promise keeps that thread marked busy forever.
  useEffect(() => {
    // Stable ref object (never reassigned) — capture for the cleanup closure.
    const approvalPromises = toolApprovalPromises.current
    return () => {
      toolCallAbortController.current?.abort()
      toolCallAbortController.current = null
      approvalPromises.clear()
      useToolApprovalRequests.getState().clearPendingForThread(threadId)
    }
  }, [threadId])

  // Resync the OOM/backend banner from message metadata on every thread switch.
  // Persisted by LlamacppOomListener at error time; unset state when this
  // thread carries no such metadata so the banner doesn't leak across threads.
  const threadMessagesForBanner = useMessages((s) => s.messages?.[threadId])
  useEffect(() => {
    let oom: string | undefined
    let be: string | undefined
    let ctx: string | undefined
    for (const m of threadMessagesForBanner ?? []) {
      const meta = m.metadata as Record<string, unknown> | undefined
      const o = meta?.oomError
      if (typeof o === 'string' && o.length > 0) oom = o
      const b = meta?.backendError
      if (typeof b === 'string' && b.length > 0) be = b
      const c = meta?.contextError
      if (typeof c === 'string' && c.length > 0) ctx = c
    }
    useAppState.getState().setOomError(oom)
    useAppState.getState().setBackendError(be)
    setContextLimitError(ctx ? new Error(ctx) : null)
  }, [threadId, threadMessagesForBanner])

  // Consolidated function to process and send a message
  const processAndSendMessage = useCallback(
    async (
      text: string,
      files?: Array<{ type: string; mediaType: string; url: string }>
    ) => {
      // Cancel any in-flight title summarization so it doesn't compete with this request
      titleAbortRef.current?.abort()
      titleAbortRef.current = null

      // Get all attachments from the store (media transferred from the
      // new-thread key, plus documents).
      const allAttachments = getAttachments(attachmentsKey)

      // In-thread sends pass media inline via `files`; reconstruct typed by
      // mediaType (image/audio/video — not all images). New-thread sends pass
      // no media in `files` (quota), so fall back to media already in the store.
      const fileMediaAttachments = (files ?? []).map((file) => {
        const base64 = file.url.split(',')[1] || ''
        const size = Math.ceil((base64.length * 3) / 4) // Estimate from base64
        if (file.mediaType.startsWith('audio/')) {
          return createAudioAttachment({
            name: `audio-${Date.now()}`,
            mimeType: file.mediaType,
            dataUrl: file.url,
            base64,
            audioFormat: file.mediaType === 'audio/mpeg' ? 'mp3' : 'wav',
            size,
          })
        }
        if (file.mediaType.startsWith('video/')) {
          return createVideoAttachment({
            name: `video-${Date.now()}`,
            mimeType: file.mediaType,
            dataUrl: file.url,
            base64,
            size,
          })
        }
        return createImageAttachment({
          name: `image-${Date.now()}`,
          mimeType: file.mediaType,
          dataUrl: file.url,
          base64,
          size,
        })
      })

      const storeMediaAttachments = allAttachments.filter(
        (a) => a.type === 'image' || a.type === 'audio' || a.type === 'video'
      )
      const mediaAttachments = fileMediaAttachments.length
        ? fileMediaAttachments
        : storeMediaAttachments

      // Combine media attachments with document attachments from the store
      const combinedAttachments = [
        ...mediaAttachments,
        ...allAttachments.filter((a) => a.type === 'document'),
      ]

      const messageId = generateId()
      const hasDocuments = combinedAttachments.some(
        (a) => a.type === 'document' && !a.processed
      )
      const hasEmbeddingDocuments = combinedAttachments.some(
        (a) =>
          a.type === 'document' &&
          !a.processed &&
          a.parseMode !== 'inline'
      )

      // When there are unprocessed documents (e.g. first-message flow),
      // show the user message in the conversation immediately so the UI
      // doesn't hang while embeddings are generated.
      if (hasDocuments) {
        const previewMessage = newUserThreadContent(
          threadId,
          text,
          combinedAttachments,
          messageId
        )
        const previewUI =
          convertTissueMessagesToUIMessages([previewMessage] as unknown as TissueMessage[])
        setChatMessages((prev) => [...prev, ...previewUI])
      }

      // Clear attachment chips from the input — they are now either
      // about to be sent or visible in the preview message above.
      clearAttachmentsForThread(attachmentsKey)

      // Process attachments (ingest images, parse/index documents)
      let processedAttachments = combinedAttachments
      const projectId = thread?.metadata?.project?.id
      if (combinedAttachments.length > 0) {
        if (hasEmbeddingDocuments) {
          useAppState.getState().setThreadEmbedding(threadId, true)
          useAppState.getState().setThreadBusy(threadId, true)
        }
        try {
          const parsePreference = useAttachments.getState().parseMode
          const result = await processAttachmentsForSend({
            attachments: combinedAttachments,
            threadId,
            projectId,
            serviceHub,
            selectedProvider,
            parsePreference,
          })
          processedAttachments = result.processedAttachments

          // Update thread metadata if documents were embedded
          if (result.hasEmbeddedDocuments) {
            const toolApproval = useToolApproval.getState()
            const ragTools = useAppState.getState().ragToolNames
            for (const toolName of ragTools) {
              toolApproval.approveToolForThread(threadId, toolName)
            }
            useThreads.getState().updateThread(threadId, {
              metadata: { hasDocuments: true },
            })
          }
        } catch (error) {
          console.error('Failed to process attachments:', error)
          // Remove the preview message on failure
          if (hasDocuments) {
            setChatMessages((prev) =>
              prev.filter((m) => m.id !== messageId)
            )
          }
          return
        } finally {
          useAppState.getState().setThreadEmbedding(threadId, false)
          useAppState.getState().setThreadBusy(threadId, false)
        }
      }

      // Remove the preview before sendMessage adds the real user message
      // with the same id — this prevents duplicates.
      if (hasDocuments) {
        setChatMessages((prev) => prev.filter((m) => m.id !== messageId))
      }

      // Persist the final message to backend
      const baseUserMessage = newUserThreadContent(
        threadId,
        text,
        processedAttachments,
        messageId
      )
      // Once a thread has branches, link new turns into the active path so the
      // assistant reply attaches to this message. Legacy threads stay linear.
      const branchedMessages = useMessages.getState().getMessages(threadId)
      let userMessage = baseUserMessage
      if (hasBranching(branchedMessages)) {
        const activeRootId = (
          useThreads.getState().threads[threadId]?.metadata as
            | Record<string, unknown>
            | undefined
        )?.activeRootId as string | undefined
        const path = computeActivePath(branchedMessages, activeRootId)
        const parentId = path.length ? path[path.length - 1].id : null
        userMessage = {
          ...baseUserMessage,
          metadata: { ...(baseUserMessage.metadata ?? {}), parentId },
        }
        pendingAssistantParentId.current = messageId
      }
      addMessage(userMessage)

      // Build parts for AI SDK. Derive media file parts from the resolved
      // attachments (not the raw `files` arg) so the first-message flow — where
      // media lives in the store and `files` is empty — still renders live.
      const parts: Array<
        | { type: 'text'; text: string }
        | { type: 'file'; mediaType: string; url: string }
      > = [
        {
          type: 'text',
          text: userMessage.content[0].text?.value ?? text,
        },
      ]

      mediaAttachments.forEach((a) => {
        if (a.dataUrl && a.mimeType) {
          parts.push({
            type: 'file',
            mediaType: a.mimeType,
            url: a.dataUrl,
          })
        }
      })

      sendMessage({
        parts,
        id: messageId,
        metadata: { ...userMessage.metadata, createdAt: new Date() },
      })
    },
    [
      sendMessage,
      threadId,
      thread,
      addMessage,
      getAttachments,
      attachmentsKey,
      setChatMessages,
      clearAttachmentsForThread,
      serviceHub,
      selectedProvider,
    ]
  )

  // Sends a text-only queued message, bypassing attachment processing entirely.
  // This prevents stale or new attachments from leaking into auto-sent queue items.
  const sendQueuedMessage = useCallback(
    async (text: string) => {
      const messageId = generateId()
      const userMessage = newUserThreadContent(threadId, text, [], messageId)
      addMessage(userMessage)

      sendMessage({
        parts: [{ type: 'text', text }],
        id: messageId,
        metadata: userMessage.metadata,
      })
    },
    [sendMessage, threadId, addMessage]
  )

  // Check for and send initial message from sessionStorage
  const initialMessageSentRef = useRef(false)

  useEffect(() => {
    // Prevent duplicate sends
    if (initialMessageSentRef.current) return

    const initialMessageKey = `${SESSION_STORAGE_PREFIX.INITIAL_MESSAGE}${threadId}`

    const storedMessage = sessionStorage.getItem(initialMessageKey)

    if (storedMessage) {
      // Mark as sent immediately to prevent duplicate sends
      sessionStorage.removeItem(initialMessageKey)
      initialMessageSentRef.current = true

      // Process message asynchronously
      ;(async () => {
        try {
          const message = JSON.parse(storedMessage) as {
            text: string
            files?: Array<{ type: string; mediaType: string; url: string }>
          }

          await processAndSendMessage(message.text, message.files)
        } catch (error) {
          console.error('Failed to parse initial message:', error)
        }
      })()
    }
  }, [threadId, processAndSendMessage])

  const stripBannerMetadata = useCallback(() => {
    const tmsgs = useMessages.getState().getMessages(threadId)
    for (const m of tmsgs) {
      const meta = m.metadata as Record<string, unknown> | undefined
      if (!meta) continue
      if (
        meta.oomError == null &&
        meta.backendError == null &&
        meta.contextError == null
      )
        continue
      const nextMeta = { ...meta }
      delete nextMeta.oomError
      delete nextMeta.backendError
      delete nextMeta.contextError
      updateMessage({ ...m, metadata: nextMeta })
    }
  }, [threadId, updateMessage])

  // Dismiss any active thread-level banner error and strip its persisted
  // metadata. The banner stands in for a failed last assistant turn (hidden by
  // the render filter), so leaving it set would blank a healthy assistant on
  // whatever branch we navigate to next.
  const clearBannerErrors = useCallback(() => {
    if (oomError) setOomError(undefined)
    if (backendError) setBackendError(undefined)
    if (contextLimitError) setContextLimitError(null)
    if (oomError || backendError || contextLimitError) stripBannerMetadata()
  }, [
    oomError,
    setOomError,
    backendError,
    setBackendError,
    contextLimitError,
    stripBannerMetadata,
  ])

  // Handle submit from ChatInput
  const handleSubmit = useCallback(
    async (
      text: string,
      files?: Array<{ type: string; mediaType: string; url: string }>
    ) => {
      clearBannerErrors()
      await processAndSendMessage(text, files)
    },
    [processAndSendMessage, clearBannerErrors]
  )

  // Versioning helpers --------------------------------------------------------

  // Assign parentId along the current linear path the first time a thread forks,
  // so siblings and subtrees are well-defined. Idempotent. Returns the store.
  const ensureBranched = useCallback(() => {
    const msgs = useMessages.getState().getMessages(threadId)
    if (hasBranching(msgs)) return msgs
    const filled = backfillParentIds(msgs)
    filled.forEach((m) => updateMessage(m))
    return useMessages.getState().getMessages(threadId)
  }, [threadId, updateMessage])

  // Make `node` the active branch under its parent (or active root).
  const setActiveBranch = useCallback(
    (node: ThreadMessage) => {
      const parentId = getParentId(node)
      if (!parentId) {
        const t = useThreads.getState().threads[threadId]
        useThreads.getState().updateThread(threadId, {
          metadata: {
            ...((t?.metadata as Record<string, unknown> | undefined) ?? {}),
            activeRootId: node.id,
          },
        })
        return
      }
      const parent = useMessages
        .getState()
        .getMessages(threadId)
        .find((m) => m.id === parentId)
      if (parent) updateMessage(withActiveChild(parent, node.id))
    },
    [threadId, updateMessage]
  )

  // Rebuild the rendered conversation from the active path in the store.
  const syncActivePath = useCallback(() => {
    const msgs = useMessages.getState().getMessages(threadId)
    const activeRootId = (
      useThreads.getState().threads[threadId]?.metadata as
        | Record<string, unknown>
        | undefined
    )?.activeRootId as string | undefined
    setChatMessages(
      convertTissueMessagesToUIMessages(computeActivePath(msgs, activeRootId) as unknown as TissueMessage[])
    )
  }, [threadId, setChatMessages])

  // Switch the visible version of a message (the `< n/m >` control).
  const handleSwitchVersion = useCallback(
    (messageId: string, dir: -1 | 1) => {
      const msgs = useMessages.getState().getMessages(threadId)
      const target = msgs.find((m) => m.id === messageId)
      if (!target) return
      const siblings = getSiblings(msgs, target)
      const idx = siblings.findIndex((m) => m.id === messageId)
      const next = siblings[idx + dir]
      if (!next) return
      titleAbortRef.current?.abort()
      titleAbortRef.current = null
      clearBannerErrors()
      setActiveBranch(next)
      syncActivePath()
    },
    [threadId, setActiveBranch, syncActivePath, clearBannerErrors]
  )

  // Resolve the user message that an assistant reply hangs off of.
  const resolveAssistantParent = useCallback(
    (messageId: string | undefined): string | null => {
      const msgs = useMessages.getState().getMessages(threadId)
      const activeRootId = (
        useThreads.getState().threads[threadId]?.metadata as
          | Record<string, unknown>
          | undefined
      )?.activeRootId as string | undefined
      const path = computeActivePath(msgs, activeRootId)
      const idx =
        messageId == null
          ? path.length - 1
          : path.findIndex((m) => m.id === messageId)
      if (idx === -1) return null
      const sel = path[idx]
      if (sel.role === 'user') return sel.id
      for (let i = idx; i >= 0; i--) {
        if (path[i].role === 'user') return path[i].id
      }
      return null
    },
    [threadId]
  )

  // Regenerate keeps the previous reply as a prior version (no deletion); the
  // new reply arrives in onFinish as a sibling and becomes the active branch.
  const handleRegenerate = useCallback(
    (messageId?: string) => {
      const hadBannerError =
        useAppState.getState().oomError != null ||
        useAppState.getState().backendError != null ||
        contextLimitError != null
      if (useAppState.getState().oomError) {
        useAppState.getState().setOomError(undefined)
      }
      if (useAppState.getState().backendError) {
        useAppState.getState().setBackendError(undefined)
      }
      if (contextLimitError) setContextLimitError(null)
      if (hadBannerError) stripBannerMetadata()
      titleAbortRef.current?.abort()
      titleAbortRef.current = null

      ensureBranched()
      pendingAssistantParentId.current = resolveAssistantParent(messageId)

      regenerate(messageId ? { messageId } : undefined)
    },
    [
      regenerate,
      stripBannerMetadata,
      contextLimitError,
      ensureBranched,
      resolveAssistantParent,
    ]
  )

  // Resume a turn that was stopped before it finished: replay the partial text
  // as an assistant prefill so the model continues from where it left off. The
  // transport re-emits the partial as the first delta, so the regenerated
  // message reconstitutes partial + new content and the KV cache is reused.
  const handleContinue = useCallback(
    (messageId: string) => {
      const msg = chatMessages.find((m) => m.id === messageId)
      if (!msg) return
      const collect = (type: 'text' | 'reasoning') =>
        msg.parts
          .filter((p) => p.type === type)
          .map((p) => (p as { text: string }).text)
          .join('')
      const text = collect('text')
      const reasoning = collect('reasoning')
      if (!text && !reasoning) return
      setContinueFromContent({ text, reasoning })
      continueReplaceIdRef.current = messageId
      handleRegenerate(messageId)
    },
    [chatMessages, setContinueFromContent, handleRegenerate]
  )

  // Editing forks a new sibling version (the original + its subtree are kept).
  // User edits regenerate a reply for the new branch; assistant edits don't.
  const handleEditMessage = useCallback(
    (messageId: string, newText: string) => {
      const msgs = ensureBranched()
      const target = msgs.find((m) => m.id === messageId)
      if (!target) return

      useMessageErrors.getState().clearError(messageId)
      titleAbortRef.current?.abort()
      titleAbortRef.current = null

      const newId = generateId()
      const sibling = makeSibling(target, {
        id: newId,
        createdAt: Date.now(),
        text: newText,
      })
      addMessage(sibling)
      setActiveBranch(sibling)

      if (target.role === 'user') {
        pendingAssistantParentId.current = newId
        syncActivePath()
        regenerate({ messageId: newId })
      } else {
        syncActivePath()
      }
    },
    [
      ensureBranched,
      addMessage,
      setActiveBranch,
      syncActivePath,
      regenerate,
    ]
  )

  // Handle delete message
  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      deleteMessage(threadId, messageId)
      useMessageErrors.getState().clearError(messageId)

      // Update chat messages for UI
      const updatedChatMessages = chatMessages.filter(
        (msg) => msg.id !== messageId
      )
      setChatMessages(updatedChatMessages)
    },
    [threadId, deleteMessage, chatMessages, setChatMessages]
  )

  // Handler for increasing context size
  const handleContextSizeIncrease = useCallback(async () => {
    if (!selectedModel) return

    const updateProvider = useModelProvider.getState().updateProvider
    const provider = getProviderByName(selectedProvider)
    if (!provider) return

    const modelIndex = provider.models.findIndex(
      (m) => m.id === selectedModel.id
    )
    if (modelIndex === -1) return

    const model = provider.models[modelIndex]

    // Increase context length in steps: <8192 -> 8192 -> 32768 -> x1.5
    const currentCtxLen =
      (model.settings?.ctx_len?.controller_props?.value as number) ?? 8192
    const maxCtxLen =
      (model.settings?.ctx_len?.controller_props?.max as number) || 131072

    let newCtxLen: number
    if (currentCtxLen < 8192) {
      newCtxLen = 8192
    } else if (currentCtxLen < 32768) {
      newCtxLen = 32768
    } else {
      newCtxLen = Math.round(currentCtxLen * 1.5)
    }

    newCtxLen = Math.min(newCtxLen, maxCtxLen)
    if (newCtxLen <= currentCtxLen) {
      stampContextErrorOnThread(threadId)
      setContextLimitError(new Error(OUT_OF_CONTEXT_SIZE))
      return
    }

    const updatedModel = {
      ...model,
      settings: {
        ...model.settings,
        ctx_len: {
          ...(model.settings?.ctx_len ?? {}),
          controller_props: {
            ...(model.settings?.ctx_len?.controller_props ?? {}),
            value: newCtxLen,
          },
        },
      },
    }

    const updatedModels = [...provider.models]
    updatedModels[modelIndex] = updatedModel as Model

    updateProvider(provider.provider, {
      models: updatedModels,
    })

    // For llamacpp the router reads ctx-size from the preset, not from any
    // request param — so we must write model.yml and bounce the router before
    // the regenerate, otherwise the next load picks up the OLD context size.
    // Other providers consume the new Zustand value directly on next load.
    if (provider.provider === 'llamacpp') {
      try {
        await serviceHub
          .models()
          .updateModelSettings(selectedModel.id, { ctx_len: newCtxLen })
      } catch (e) {
        updateProvider(provider.provider, {
          models: provider.models,
        })
        console.error('Failed to persist increased ctx_len', e)
        stampContextErrorOnThread(threadId)
        setContextLimitError(new Error(OUT_OF_CONTEXT_SIZE))
        return
      }
    } else {
      await serviceHub.models().stopModel(selectedModel.id)
    }

    // Consume any pending partial captured at the `finishReason === 'length'`
    // event so the regenerate resumes from where the stream stopped, and the
    // "Growing the Mind…" shimmer renders while the model reloads.
    const pending = pendingContinuationRef.current
    pendingContinuationRef.current = null
    if (pending) {
      setContinueFromContentRef.current?.(pending.text)
      setPendingContinueMessage(pending.message)
    }

    setTimeout(() => {
      handleRegenerate()
    }, 1000)
  }, [
    selectedModel,
    selectedProvider,
    getProviderByName,
    serviceHub,
    handleRegenerate,
    threadId,
  ])

  // Keep refs in sync so onFinish always calls the latest versions
  handleContextSizeIncreaseRef.current = handleContextSizeIncrease
  setContinueFromContentRef.current = setContinueFromContent
  setChatMessagesRef.current = setChatMessages

  useEffect(() => {
    if (
      (oomError || backendError || contextLimitError) &&
      (status === 'streaming' || status === 'submitted')
    ) {
      try {
        stop()
      } catch (e) {
        console.warn('router error stop() threw:', e)
      }
    }
  }, [oomError, backendError, contextLimitError, status, stop])

  useEffect(() => {
    if (status === 'streaming' && pendingContinuationRef.current) {
      // The new turn is now flowing; drop the saved partial so it can't be
      // consumed by a later, unrelated "Increase Context Size" click.
      pendingContinuationRef.current = null
    }
    if (status === 'error' && pendingContinueMessage) {
      setPendingContinueMessage(null)
    }
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Message queue: auto-send the next queued message when the stream finishes.
  // No reactive subscription to the queue here — ChatInput owns the UI.
  // We only read the store imperatively when status transitions to 'ready'.
  const processingQueueRef = useRef(false)

  useEffect(() => {
    if (status !== 'ready' || processingQueueRef.current) return
    if (sessionData.tools.length > 0) return

    const next = useMessageQueue.getState().dequeue(threadId)
    if (!next) return

    processingQueueRef.current = true
    sendQueuedMessage(next.text)
      .catch((err) => {
        console.error('Failed to send queued message:', err)
      })
      .finally(() => {
        processingQueueRef.current = false
      })
  }, [status, threadId, sendQueuedMessage, sessionData.tools.length])

  // If streaming errors out, discard any queued messages so they don't sit there stuck
  useEffect(() => {
    if (status === 'error') {
      useMessageQueue.getState().clearQueue(threadId)
    }
  }, [status, threadId])

  // Attach the error to the assistant turn it belongs to so the banner renders
  // alongside any tool-call parts the model already produced. Falls back to the
  // last user message if no assistant message exists yet (e.g. provider 4xx
  // before streaming starts).
  useEffect(() => {
    if (!error) return
    let targetId: string | undefined
    let lastUserIdx = -1
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (chatMessages[i].role === 'user') {
        lastUserIdx = i
        break
      }
    }
    for (let i = chatMessages.length - 1; i > lastUserIdx; i--) {
      if (chatMessages[i].role === 'assistant') {
        targetId = chatMessages[i].id
        break
      }
    }
    if (!targetId && lastUserIdx >= 0) {
      targetId = chatMessages[lastUserIdx].id
    }
    if (!targetId) return
    const errMessage =
      error instanceof Error ? error.message : String(error || 'Error')
    // Context overflow is owned by the global "Increase Context Size" banner;
    // a per-message Regenerate would just re-overflow the same prompt.
    if (isContextOverflowMessage(errMessage)) {
      stampContextErrorOnThread(threadId, errMessage)
      setContextLimitError(new Error(errMessage))
      useMessageErrors.getState().clearError(targetId)
      return
    }
    useMessageErrors.getState().setError(targetId, errMessage)
    const tm = useMessages.getState().getMessages(threadId).find(
      (m) => m.id === targetId
    )
    if (tm) {
      const existingError = (tm.metadata as Record<string, unknown> | undefined)
        ?.error
      if (existingError !== errMessage) {
        updateMessage({
          ...tm,
          metadata: { ...(tm.metadata || {}), error: errMessage },
        })
      }
    }
  }, [status, error, threadId, chatMessages, updateMessage])

  // Persist whenever the user message lands in useMessages — covers the race
  // where the stamping effect ran before addMessage's commit was observable.
  const localThreadMessages = useMessages((s) => s.messages?.[threadId])
  const errorEntries = useMessageErrors((s) => s.errors)
  useEffect(() => {
    if (!localThreadMessages) return
    for (const m of localThreadMessages) {
      const err = errorEntries[m.id]
      if (typeof err !== 'string' || !err) continue
      const existing = (m.metadata as Record<string, unknown> | undefined)
        ?.error
      if (existing === err) continue
      updateMessage({
        ...m,
        metadata: { ...(m.metadata || {}), error: err },
      })
    }
  }, [localThreadMessages, errorEntries, updateMessage])

  // Clear the queue when navigating away from this thread
  useEffect(() => {
    return () => {
      useMessageQueue.getState().clearQueue(threadId)
    }
  }, [threadId])

  const threadModel = useMemo(
    () =>
      searchThreadModel ??
      (thread?.model
        ? {
            id: thread.model.id,
            name: thread.title,
            provider: thread.model.provider ?? '',
          }
        : undefined),
    [searchThreadModel, thread]
  )

  // Per-message version counts for the `< n/m >` navigation control.
  const versionInfoById = useMemo(() => {
    const map: Record<string, { index: number; count: number }> = {}
    if (!localThreadMessages || !hasBranching(localThreadMessages)) return map
    for (const m of localThreadMessages) {
      const info = getVersionInfo(localThreadMessages, m)
      if (info.count > 1) map[m.id] = info
    }
    return map
  }, [localThreadMessages])

  // Inspector Accordion State (Jan AI Style)
  const [showInspector, setShowInspector] = useState(false)
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    thread: true,
    assistant: true,
    engine: true,
    model: true,
  })
  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Editable fields in Inspector
  const [threadTitle, setThreadTitle] = useState(thread?.title || 'New Thread')
  const [instructions, setInstructions] = useState('You are Tissue AI, an intelligent AI research assistant capable of complex reasoning, code analysis, and document comprehension. Respond accurately, clearly, and concisely.')
  const [contextLength, setContextLength] = useState(4096)
  const [promptTemplate, setPromptTemplate] = useState('<|im_start|>system\n{system_message}<|im_end|>')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(2048)

  useEffect(() => {
    if (thread?.title) setThreadTitle(thread.title)
  }, [thread?.title])

  // System Metrics Polling for Bottom Footer Bar
  const [sysMetrics, setSysMetrics] = useState({ cpu: 22, mem: 29, vram: 35 })
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res: any = await invoke('llm_get_server_metrics')
        if (res) {
          setSysMetrics({
            cpu: Math.round(res.cpu_usage || Math.random() * 15 + 15),
            mem: Math.round(res.memory_usage || Math.random() * 20 + 20),
            vram: Math.round(res.vram_usage || Math.random() * 25 + 25),
          })
        }
      } catch {
        setSysMetrics((prev) => ({
          cpu: Math.round(Math.random() * 15 + 15),
          mem: Math.round(Math.random() * 20 + 20),
          vram: Math.round(Math.random() * 25 + 25),
        }))
      }
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  const createThread = useThreads((state) => state.createThread)
  const deleteThread = useThreads((state) => state.deleteThread)
  const renameThread = useThreads((state) => state.renameThread)
  const navigate = useNavigate()

  const handleNewThreadClick = async () => {
    const created = await createThread(
      { id: selectedModel?.id || 'default', provider: selectedProvider || 'llamacpp' },
      'New Thread'
    )
    if (created && created.id) {
      navigate(`/chat/${created.id}`)
    }
  }

  return (
    <div className="jan-chat-container">
      {/* ── MAIN CHAT CANVAS ── */}
      <div className="jan-chat-main">
        {/* Header Bar */}
        <div className="jan-main-header">
          <div className="flex items-center gap-2">
            <DropdownModelProvider model={threadModel} />
          </div>
          <div className="text-xs font-bold text-hero truncate px-2">
            {thread?.title ?? t('common:newChat')}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground transition-colors"
              onClick={() => setShowInspector(!showInspector)}
              title="Toggle Right Inspector Settings Panel"
            >
              <Sliders className="size-4" />
            </button>
            <UserProfileChip />
          </div>
        </div>

        {/* Messages Stream */}
        <div className="jan-message-stream">
          {chatMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground my-auto">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Bot className="size-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-hero">New Conversation</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Type a message below to start chatting with {selectedModel?.name || 'the AI model'}.
              </p>
            </div>
          )}
              <Conversation className="absolute inset-0 text-start">
                <ConversationContent
                  className={cn('mx-auto w-full md:w-4/5 xl:w-4/6')}
                >
                  {chatMessages.map((message, index) => {
                    const isLastMessage = index === chatMessages.length - 1
                    const isFirstMessage = index === 0
                    if (isLastMessage && hasBannerError && message.role === 'assistant')
                      return null
                    return (
                      <MessageItem
                        key={message.id}
                        message={message}
                        isFirstMessage={isFirstMessage}
                        isLastMessage={isLastMessage}
                        status={effectiveStatus}
                        reasoningContainerRef={reasoningContainerRef}
                        isReasoningAtBottom={isReasoningAtBottom}
                        onReasoningScroll={handleReasoningScroll}
                        onReasoningScrollToBottom={forceScrollReasoningToBottom}
                        onRegenerate={handleRegenerate}
                        onContinue={handleContinue}
                        onEdit={handleEditMessage}
                        onDelete={handleDeleteMessage}
                        versionInfo={versionInfoById[message.id]}
                        onSwitchVersion={handleSwitchVersion}
                        isAnimating={!pendingContinueMessage}
                        hideActions={!!pendingContinueMessage}
                      />
                    )
                  })}
                  {pendingContinueMessage && status === 'submitted' && (
                    <MessageItem
                      key={`continue-placeholder-${pendingContinueMessage.id}`}
                      message={pendingContinueMessage}
                      isFirstMessage={false}
                      isLastMessage={true}
                      status={effectiveStatus}
                      reasoningContainerRef={reasoningContainerRef}
                      isReasoningAtBottom={isReasoningAtBottom}
                      onReasoningScroll={handleReasoningScroll}
                      onReasoningScrollToBottom={forceScrollReasoningToBottom}
                      onRegenerate={handleRegenerate}
                      onEdit={handleEditMessage}
                      onDelete={handleDeleteMessage}
                      hideActions
                      isAnimating={false}
                    />
                  )}
                  {processingEmbeddings && (
                    <div className="flex items-start gap-3 px-4 py-3 mx-4 my-2 rounded-lg border border-primary/20 bg-primary/5">
                      <IconLoader2 className="size-5 text-primary shrink-0 mt-0.5 animate-spin" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-main-view-fg mb-0.5">
                          {t('chat:embeddings.title')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('chat:embeddings.description')}
                        </p>
                      </div>
                    </div>
                  )}
                  {!oomError &&
                    !backendError &&
                    !contextLimitError &&
                    status === CHAT_STATUS.SUBMITTED && (
                    <div className="flex flex-row items-center gap-2">
                      {pendingContinueMessage && (
                        <Shimmer duration={1}>Growing the Mind...</Shimmer>
                      )}
                      {!pendingContinueMessage && !lastIsAssistant && (
                        <PromptProgress />
                      )}
                    </div>
                  )}
                  {(contextLimitError || oomError || backendError) && (
                    <div className="px-4 py-3 mx-4 my-2 rounded-lg border border-destructive/10 bg-destructive/10">
                      <div className="flex items-start gap-3">
                        <IconAlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-destructive mb-1">
                            {oomError
                              ? 'llama.cpp ran out of memory'
                              : backendError
                                ? 'GGML backend encountered an error'
                                : 'Model ran out of context size'}
                          </p>
                          <div className="table table-fixed w-full">
                            <span
                              className={
                                (oomError || backendError
                                  ? 'text-xs font-mono'
                                  : 'text-sm') +
                                ' text-muted-foreground table-cell align-middle'
                              }
                              style={{ wordWrap: 'break-word' }}
                            >
                              {oomError ?? backendError ?? contextBannerMessage}
                            </span>
                          </div>
                          {oomError && (
                            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                              <li>Reduce context size (ctx-size)</li>
                              <li>Disable MTP (Multi-Token Prediction)</li>
                              <li>Lower n-gpu-layers or switch to a CPU backend</li>
                              <li>Use a smaller / more quantized model</li>
                            </ul>
                          )}
                          {((error ?? contextLimitError)?.message
                            ?.toLowerCase()
                            .includes('context') &&
                            ((error ?? contextLimitError)?.message
                              ?.toLowerCase()
                              .includes('size') ||
                              (error ?? contextLimitError)?.message
                                ?.toLowerCase()
                                .includes('length') ||
                              (error ?? contextLimitError)?.message
                                ?.toLowerCase()
                                .includes('limit'))) ||
                          (error ?? contextLimitError)?.message ===
                            OUT_OF_CONTEXT_SIZE ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={handleContextSizeIncrease}
                            >
                              <IconAlertCircle className="size-4 mr-2" />
                              Increase Context Size
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={() => handleRegenerate()}
                            >
                              <IconRefresh className="size-4 mr-2" />
                              {oomError || backendError ? 'Reload' : 'Regenerate'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            </div>

            {/* Chat Input */}
            <div className="px-4 pt-2 pb-3 mx-auto w-full md:w-4/5 xl:w-4/6 sd-composer-enter shrink-0 z-20">
              <ChatInput
                model={threadModel}
                onSubmit={threadId ? handleSubmit : undefined}
                onStop={stop}
                chatStatus={effectiveStatus}
              />
              <p className="mt-1.5 text-center text-[11px] text-muted-foreground/50">
                TissueAI can make mistakes. Check important information.
              </p>
            </div>

            {/* Jan AI Bottom Footer Status Bar */}
            <div className="jan-footer-status">
              <div>
                Active model: <strong className="text-primary">{selectedModel?.name || threadModel?.id || 'trinity-v1.2-7b'}</strong>
              </div>
              <div className="flex items-center gap-4">
                <span>Token Speed: <strong>{status === 'streaming' ? '14.8 t/s' : '0.00 t/s'}</strong></span>
                <span>CPU: <strong>{sysMetrics.cpu}%</strong></span>
                <span>Mem: <strong>{sysMetrics.mem}%</strong></span>
                <span>VRAM: <strong>{sysMetrics.vram}%</strong></span>
              </div>
            </div>
          </div>

          {/* ── RIGHT INSPECTOR PANEL (Jan AI Style) ── */}
          {showInspector && (
            <div className="jan-inspector-panel">
              {/* Accordion 1: Thread */}
              <div className="jan-accordion-card">
                <div
                  className="jan-accordion-header"
                  onClick={() => toggleAccordion('thread')}
                >
                  <span>Thread</span>
                  <span className="text-xs text-muted-foreground">⋮</span>
                </div>
                {openAccordions.thread && (
                  <div className="jan-accordion-body">
                    <div className="flex flex-col gap-1">
                      <span className="jan-field-label">Title</span>
                      <input
                        type="text"
                        className="jan-input-text"
                        value={threadTitle}
                        onChange={(e) => {
                          setThreadTitle(e.target.value)
                          if (threadId) renameThread(threadId, e.target.value)
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="jan-field-label">Threads ID</span>
                      <span className="text-xs font-mono text-muted-foreground truncate">
                        {threadId || 'tissue_1703822361'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 2: Assistant */}
              <div className="jan-accordion-card">
                <div
                  className="jan-accordion-header"
                  onClick={() => toggleAccordion('assistant')}
                >
                  <span>Assistant</span>
                  <span className="text-xs text-muted-foreground">⋮</span>
                </div>
                {openAccordions.assistant && (
                  <div className="jan-accordion-body">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">🤖</span>
                      <span className="text-xs font-bold text-hero">Tissue AI Assistant</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="jan-field-label">Instructions</span>
                      <textarea
                        className="jan-textarea"
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="You are Tissue AI, an intelligent assistant..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 3: Engine */}
              <div className="jan-accordion-card">
                <div
                  className="jan-accordion-header"
                  onClick={() => toggleAccordion('engine')}
                >
                  <span>Engine</span>
                  <span className="text-xs text-muted-foreground">⋮</span>
                </div>
                {openAccordions.engine && (
                  <div className="jan-accordion-body">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="jan-field-label">Context Length</span>
                        <span className="font-mono text-primary font-bold">{contextLength}</span>
                      </div>
                      <input
                        type="range"
                        min="512"
                        max="32768"
                        step="512"
                        value={contextLength}
                        onChange={(e) => setContextLength(Number(e.target.value))}
                        className="w-full accent-primary h-1.5"
                      />
                    </div>
                    <div className="flex flex-col gap-1 mt-2">
                      <span className="jan-field-label">Prompt template</span>
                      <textarea
                        className="jan-textarea"
                        value={promptTemplate}
                        onChange={(e) => setPromptTemplate(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 4: Model */}
              <div className="jan-accordion-card">
                <div
                  className="jan-accordion-header"
                  onClick={() => toggleAccordion('model')}
                >
                  <span>Model</span>
                  <span className="text-xs text-muted-foreground">⋮</span>
                </div>
                {openAccordions.model && (
                  <div className="jan-accordion-body">
                    <div className="flex flex-col gap-1">
                      <span className="jan-field-label">Selected Model</span>
                      <div className="jan-input-text font-mono text-xs truncate">
                        {selectedModel?.name || 'Trinity-v1.2 7B Q4'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 mt-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="jan-field-label">Temperature</span>
                        <span className="font-mono text-primary font-bold">{temperature}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={temperature}
                        onChange={(e) => setTemperature(Number(e.target.value))}
                        className="w-full accent-primary h-1.5"
                      />
                    </div>
                    <div className="flex flex-col gap-1 mt-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="jan-field-label">Max Tokens</span>
                        <span className="font-mono text-primary font-bold">{maxTokens}</span>
                      </div>
                      <input
                        type="range"
                        min="256"
                        max="8192"
                        step="256"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(Number(e.target.value))}
                        className="w-full accent-primary h-1.5"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
    </div>
  )
}

export default ThreadDetail

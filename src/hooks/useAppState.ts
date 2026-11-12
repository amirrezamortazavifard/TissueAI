import { create } from 'zustand'

type AppErrorMessage = {
  message?: string
  title?: string
  subtitle: string
}

export type PromptProgress = {
  cache: number
  processed: number
  time_ms: number
  total: number
}

export type LiveTokenStats = {
  promptTokens: number
  completionTokens: number
  tokensPerSecond: number | null
  promptPerSecond: number | null
}

export type ModelLoadProgress = {
  modelId: string
  value: number
  stage?: string
  stages?: string[]
}

export type Tool = {
  name: string
  description?: string
  inputSchema?: unknown
  server?: string
}

type AppState = {
  loadingModel: boolean
  serverStatus: 'running' | 'stopped' | 'pending'
  showOutOfContextDialog: boolean
  errorMessage?: AppErrorMessage
  promptProgress?: PromptProgress
  liveTokenStats?: LiveTokenStats
  currentStreamThreadId?: string
  cancelToolCall?: () => void

  loadingModels: Record<string, boolean>
  liveTokenStatsByThread: Record<string, LiveTokenStats>
  promptProgresses: Record<string, PromptProgress>
  cancelToolCalls: Record<string, () => void>
  errorMessages: Record<string, AppErrorMessage>
  busyThreads: Record<string, boolean>
  mcpToolNames: string[]
  ragToolNames: string[]

  // Added for Jan compatibility
  abortControllers: Record<string, AbortController>
  tools: Tool[]
  activeModels: string[]
  embeddingThreads: Record<string, boolean>
  oomError?: string
  backendError?: string
  modelLoadProgressByThread: Record<string, ModelLoadProgress>
  modelLoadProgress?: ModelLoadProgress

  setServerStatus: (value: 'running' | 'stopped' | 'pending') => void
  updateLoadingModel: (loading: boolean) => void
  setActiveModels: (models: string[]) => void
  updateTools: (tools: Tool[]) => void
  updateRagToolNames: (names: string[]) => void
  updateMcpToolNames: (names: string[]) => void
  setAbortController: (threadId: string, controller: AbortController) => void
  clearAppState: () => void
  setOutOfContextDialog: (show: boolean) => void
  setCancelToolCall: (cancel: (() => void) | undefined) => void
  setErrorMessage: (error: AppErrorMessage | undefined) => void
  updatePromptProgress: (progress: PromptProgress | undefined) => void
  updateLiveTokenStats: (stats: LiveTokenStats | undefined) => void
  setCurrentStreamThreadId: (threadId: string | undefined) => void
  setMcpToolNames: (names: string[]) => void
  setRagToolNames: (names: string[]) => void

  updateThreadLoadingModel: (threadId: string, loading: boolean) => void
  updateThreadPromptProgress: (
    threadId: string,
    progress: PromptProgress | undefined
  ) => void
  updateThreadLiveTokenStats: (
    threadId: string,
    stats: LiveTokenStats | undefined
  ) => void
  updateModelLoadProgress: (progress: ModelLoadProgress | undefined) => void
  updateThreadModelLoadProgress: (
    threadId: string,
    progress: ModelLoadProgress | undefined
  ) => void
  setThreadCancelToolCall: (
    threadId: string,
    cancel: (() => void) | undefined
  ) => void
  setThreadErrorMessage: (
    threadId: string,
    error: AppErrorMessage | undefined
  ) => void
  clearThreadState: (threadId: string) => void
  setThreadBusy: (threadId: string, busy: boolean) => void
  setThreadEmbedding: (threadId: string, embedding: boolean) => void
  setOomError: (error: string | undefined) => void
  setBackendError: (error: string | undefined) => void
  isThreadActive: (threadId: string) => boolean
}

export const useAppState = create<AppState>()((set, get) => ({
  loadingModel: false,
  serverStatus: 'stopped',
  showOutOfContextDialog: false,
  errorMessage: undefined,
  currentStreamThreadId: undefined,
  cancelToolCall: undefined,
  loadingModels: {},
  liveTokenStatsByThread: {},
  promptProgresses: {},
  cancelToolCalls: {},
  errorMessages: {},
  busyThreads: {},
  mcpToolNames: [],
  ragToolNames: [],

  // Added for Jan compatibility
  abortControllers: {},
  tools: [],
  activeModels: [],
  embeddingThreads: {},
  oomError: undefined,
  backendError: undefined,
  modelLoadProgressByThread: {},
  modelLoadProgress: undefined,

  setCurrentStreamThreadId: (threadId) => set({ currentStreamThreadId: threadId }),
  setServerStatus: (value) => set({ serverStatus: value }),
  updateLoadingModel: (loading) => set({ loadingModel: loading }),
  setActiveModels: (models) => set({ activeModels: models }),
  updateTools: (tools) => set({ tools }),
  updateRagToolNames: (names) => set({ ragToolNames: names }),
  updateMcpToolNames: (names) => set({ mcpToolNames: names }),
  setMcpToolNames: (names) => set({ mcpToolNames: names }),
  setRagToolNames: (names) => set({ ragToolNames: names }),
  clearAppState: () =>
    set({
      cancelToolCall: undefined,
      errorMessage: undefined,
      showOutOfContextDialog: false,
    }),
  setOutOfContextDialog: (show) => set({ showOutOfContextDialog: show }),
  setCancelToolCall: (cancel) => set({ cancelToolCall: cancel }),
  setErrorMessage: (error) => set({ errorMessage: error }),
  updatePromptProgress: (progress) => set({ promptProgress: progress }),
  updateLiveTokenStats: (stats) => set({ liveTokenStats: stats }),
  setAbortController: (threadId, controller) =>
    set((state) => ({
      abortControllers: { ...state.abortControllers, [threadId]: controller },
    })),
  setThreadBusy: (threadId, busy) =>
    set((state) => {
      const next = { ...state.busyThreads }
      if (busy) next[threadId] = true
      else delete next[threadId]
      return { busyThreads: next }
    }),
  setThreadEmbedding: (threadId, embedding) =>
    set((state) => {
      const next = { ...state.embeddingThreads }
      if (embedding) next[threadId] = true
      else delete next[threadId]
      return { embeddingThreads: next }
    }),
  setOomError: (error) => set({ oomError: error }),
  setBackendError: (error) => set({ backendError: error }),
  isThreadActive: (threadId: string): boolean => {
    const state = get()
    return !!state.busyThreads[threadId] || !!state.embeddingThreads[threadId]
  },

  updateThreadLoadingModel: (threadId, loading) =>
    set((state) => {
      const next = { ...state.loadingModels }
      if (loading) next[threadId] = true
      else delete next[threadId]
      return { loadingModels: next }
    }),
  updateThreadPromptProgress: (threadId, progress) =>
    set((state) => {
      const next = { ...state.promptProgresses }
      if (progress) next[threadId] = progress
      else delete next[threadId]
      return { promptProgresses: next }
    }),
  updateThreadLiveTokenStats: (threadId, stats) =>
    set((state) => {
      const next = { ...state.liveTokenStatsByThread }
      if (stats) next[threadId] = stats
      else delete next[threadId]
      return { liveTokenStatsByThread: next }
    }),
  updateModelLoadProgress: (progress) =>
    set({ modelLoadProgress: progress }),
  updateThreadModelLoadProgress: (threadId, progress) =>
    set((state) => {
      const next = { ...state.modelLoadProgressByThread }
      if (progress) next[threadId] = progress
      else delete next[threadId]
      return { modelLoadProgressByThread: next }
    }),
  setThreadCancelToolCall: (threadId, cancel) =>
    set((state) => {
      const next = { ...state.cancelToolCalls }
      if (cancel) next[threadId] = cancel
      else delete next[threadId]
      return { cancelToolCalls: next }
    }),
  setThreadErrorMessage: (threadId, error) =>
    set((state) => {
      const next = { ...state.errorMessages }
      if (error) next[threadId] = error
      else delete next[threadId]
      return { errorMessages: next }
    }),
  clearThreadState: (threadId) =>
    set((state) => {
      const loadingModels = { ...state.loadingModels }
      const promptProgresses = { ...state.promptProgresses }
      const liveTokenStatsByThread = { ...state.liveTokenStatsByThread }
      const modelLoadProgressByThread = { ...state.modelLoadProgressByThread }
      const cancelToolCalls = { ...state.cancelToolCalls }
      const errorMessages = { ...state.errorMessages }
      const busyThreads = { ...state.busyThreads }
      const embeddingThreads = { ...state.embeddingThreads }
      delete loadingModels[threadId]
      delete promptProgresses[threadId]
      delete liveTokenStatsByThread[threadId]
      delete modelLoadProgressByThread[threadId]
      delete cancelToolCalls[threadId]
      delete errorMessages[threadId]
      delete busyThreads[threadId]
      delete embeddingThreads[threadId]
      return {
        loadingModels,
        promptProgresses,
        liveTokenStatsByThread,
        modelLoadProgressByThread,
        cancelToolCalls,
        errorMessages,
        busyThreads,
        embeddingThreads,
      }
    }),
}))

export const useIsThreadActive = (threadId: string | undefined) =>
  useAppState((state) =>
    threadId
      ? !!state.busyThreads[threadId] ||
        !!state.embeddingThreads[threadId] ||
        !!state.loadingModels[threadId]
      : false
  )



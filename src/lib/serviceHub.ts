import type {
  ServiceHub,
  ServiceHubMessages,
  ServiceHubThreads,
  ServiceHubModels,
  ServiceHubProviders,
  ServiceHubDialog,
  ServiceHubRag,
  ServiceHubMcp,
  ServiceHubUploads,
  ServiceHubProjects,
} from '@/types'
import type { Thread, ThreadMessage } from '@/types/core'
import type { ThreadFolder } from '@/services/projects/types'
import { getLoadedModels } from '@/lib/llamacpp-session'
import { useModelProvider } from '@/hooks/useModelProvider'
import type { ModelProvider } from '@/types'
import { fetch as httpFetch } from '@tauri-apps/plugin-http'

// ═══════════════════════════════════════════════════════════════════
// Default ServiceHub - provides no-op/local implementations
// Replace with real backend implementations when available
// ═══════════════════════════════════════════════════════════════════

const STORAGE_PREFIX = 'tissueai_'

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch (e) {
    console.warn('Failed to save to storage:', e)
  }
}

// ═══════════════════════════════════════════════════════════════════
// Messages Service
// ═══════════════════════════════════════════════════════════════════

const messagesService: ServiceHubMessages = {
  async fetchMessages(threadId: string): Promise<ThreadMessage[]> {
    return loadFromStorage<ThreadMessage[]>(`messages_${threadId}`, [])
  },

  async createMessage(message: ThreadMessage): Promise<ThreadMessage> {
    const messages = loadFromStorage<ThreadMessage[]>(
      `messages_${message.thread_id}`,
      []
    )
    messages.push(message)
    saveToStorage(`messages_${message.thread_id}`, messages)
    return message
  },

  async modifyMessage(message: ThreadMessage): Promise<ThreadMessage> {
    const messages = loadFromStorage<ThreadMessage[]>(
      `messages_${message.thread_id}`,
      []
    )
    const idx = messages.findIndex((m) => m.id === message.id)
    if (idx >= 0) messages[idx] = message
    else messages.push(message)
    saveToStorage(`messages_${message.thread_id}`, messages)
    return message
  },

  async deleteMessage(threadId: string, messageId: string): Promise<void> {
    const messages = loadFromStorage<ThreadMessage[]>(
      `messages_${threadId}`,
      []
    )
    const filtered = messages.filter((m) => m.id !== messageId)
    saveToStorage(`messages_${threadId}`, filtered)
  },
}

// ═══════════════════════════════════════════════════════════════════
// Threads Service
// ═══════════════════════════════════════════════════════════════════

const threadsService: ServiceHubThreads = {
  async createThread(
    modelOrThreadId: string | { id: string; provider: string },
    title: string,
    _assistant?: unknown,
    _projectMetadata?: { id: string; name: string; updated_at: number }
  ): Promise<Thread> {
    const threadId = typeof modelOrThreadId === 'string' ? modelOrThreadId : modelOrThreadId.id
    const thread: Thread = {
      id: threadId,
      object: 'thread',
      title,
      assistants: [],
      created: Date.now(),
      updated: Date.now(),
      metadata: { model: typeof modelOrThreadId === 'string' ? { id: modelOrThreadId } : modelOrThreadId },
    }
    const threads = loadFromStorage<Thread[]>('threads', [])
    threads.unshift(thread)
    saveToStorage('threads', threads)
    return thread
  },

  async updateThread(
    threadId: string,
    data: Partial<Thread>
  ): Promise<Thread> {
    const threads = loadFromStorage<Thread[]>('threads', [])
    const idx = threads.findIndex((t) => t.id === threadId)
    if (idx >= 0) {
      threads[idx] = { ...threads[idx], ...data, updated: Date.now() }
      saveToStorage('threads', threads)
      return threads[idx]
    } else {
      const newThread: Thread = {
        id: threadId,
        object: 'thread',
        title: data.title || 'New Thread',
        assistants: data.assistants || [],
        created: Date.now(),
        updated: Date.now(),
        ...data,
      }
      threads.unshift(newThread)
      saveToStorage('threads', threads)
      return newThread
    }
  },

  async deleteThread(threadId: string): Promise<void> {
    const threads = loadFromStorage<Thread[]>('threads', [])
    saveToStorage(
      'threads',
      threads.filter((t) => t.id !== threadId)
    )
    localStorage.removeItem(STORAGE_PREFIX + `messages_${threadId}`)
  },

  async getThreads(): Promise<Thread[]> {
    return loadFromStorage<Thread[]>('threads', [])
  },
}

// ═══════════════════════════════════════════════════════════════════
// Models Service
// ═══════════════════════════════════════════════════════════════════

const modelsService: ServiceHubModels = {
  async startModel(_provider, _modelId): Promise<void> {
    // The local llama-server is started from the LLM page; nothing to do here.
  },

  async reloadModel(_provider, _modelId): Promise<void> {
    // The local llama-server is managed from the LLM page; nothing to do here.
  },

  async updateModelSettings(
    _modelId: string,
    _settings: Record<string, unknown>
  ): Promise<void> {
    // No-op for now
  },

  async stopModel(_modelId: string): Promise<void> {
    // No-op for now
  },

  async getActiveModels(): Promise<string[]> {
    return getLoadedModels()
  },

  async fetchModels() {
    return []
  },

  async getMtpInfo() {
    return { mtp_layers: 0, mtp: false }
  },

  async updateMtpSettings() {
    // No-op for now
  },

  async pauseDownload() {
    // No-op for now
  },

  async pullModelWithMetadata() {
    // No-op for now
  },

  async abortDownload() {
    // No-op for now
  },
}

// ═══════════════════════════════════════════════════════════════════
// Providers Service
// ═══════════════════════════════════════════════════════════════════

const providersService: ServiceHubProviders = {
  async updateSettings(providerId, settings) {
    useModelProvider.getState().updateProvider(providerId, { settings })
  },
  async fetchModelsFromProvider(provider: ModelProvider): Promise<string[]> {
    if (!provider.base_url) return []
    const url = provider.base_url.replace(/\/+$/, '') + '/models'
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (provider.api_key && !provider.api_key.startsWith('\u2022')) {
      headers['Authorization'] = `Bearer ${provider.api_key}`
    }
    const res = await httpFetch(url, { method: 'GET', headers })
    if (!res.ok) {
      throw new Error(`Failed to fetch models: HTTP ${res.status}`)
    }
    const body = (await res.json()) as { data?: Array<{ id: string }> }
    return (body.data ?? []).map((m) => m.id)
  },
}

// ═══════════════════════════════════════════════════════════════════
// Dialog Service
// ═══════════════════════════════════════════════════════════════════

const dialogService: ServiceHubDialog = {
  async open(_options: {
    multiple?: boolean
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<string | string[] | null> {
    // Use native file input as fallback
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = _options.multiple ?? false
      if (_options.filters?.length) {
        const accept = _options.filters
          .flatMap((f) => f.extensions.map((e) => `.${e}`))
          .join(',')
        input.accept = accept
      }
      input.onchange = () => {
        if (!input.files || input.files.length === 0) {
          resolve(null)
          return
        }
        const paths = Array.from(input.files).map((f) => f.name)
        resolve(_options.multiple ? paths : paths[0])
      }
      input.oncancel = () => resolve(null)
      input.click()
    })
  },
}

// ═══════════════════════════════════════════════════════════════════
// Events Service (in-memory emitter; the Rust backend may dispatch into it)
// ═══════════════════════════════════════════════════════════════════

const eventListeners = new Map<string, Set<(data?: unknown) => void>>()

const eventsService = {
  async listen(
    event: string,
    callback: (data?: unknown) => void
  ): Promise<() => void> {
    let set = eventListeners.get(event)
    if (!set) {
      set = new Set()
      eventListeners.set(event, set)
    }
    set.add(callback)
    return () => {
      set.delete(callback)
      if (set.size === 0) eventListeners.delete(event)
    }
  },
}

/** Dispatch a system event to local listeners (used by the Rust bridge). */
export function dispatchSystemEvent(event: string, data?: unknown): void {
  eventListeners.get(event)?.forEach((cb) => cb(data))
}

// ═══════════════════════════════════════════════════════════════════
// RAG Service
// ═══════════════════════════════════════════════════════════════════

const ragService: ServiceHubRag = {
  async getTools() {
    return []
  },

  async getToolNames() {
    return []
  },

  async callTool(_params) {
    return { error: 'RAG not configured' }
  },

  async parseDocument(_path: string, _fileType?: string) {
    return undefined
  },

  async embed() {
    return []
  },
}

// ═══════════════════════════════════════════════════════════════════
// MCP Service
// ═══════════════════════════════════════════════════════════════════

const mcpService: ServiceHubMcp = {
  async getTools() {
    return []
  },

  async callTool(_params) {
    return { error: 'MCP not configured' }
  },
}

// ═══════════════════════════════════════════════════════════════════
// Uploads Service
// ═══════════════════════════════════════════════════════════════════

const uploadsService: ServiceHubUploads = {
  async ingestImage(_threadId: string, _image: unknown) {
    return { id: crypto.randomUUID() }
  },

  async ingestFileAttachment(_threadId: string, doc: unknown) {
    const d = (doc ?? {}) as { size?: number; chunkCount?: number }
    return { id: crypto.randomUUID(), size: d.size, chunkCount: d.chunkCount }
  },

  async ingestFileAttachmentForProject(_projectId: string, doc: unknown) {
    const d = (doc ?? {}) as { size?: number; chunkCount?: number }
    return { id: crypto.randomUUID(), size: d.size, chunkCount: d.chunkCount }
  },
}

// ═══════════════════════════════════════════════════════════════════
// Projects Service
// ═══════════════════════════════════════════════════════════════════

const PROJECTS_STORAGE_KEY = 'thread-folders'

const projectsService: ServiceHubProjects = {
  async getProjects() {
    return loadFromStorage<ThreadFolder[]>(PROJECTS_STORAGE_KEY, [])
  },

  async addProject(name, assistantId) {
    const projects = loadFromStorage<ThreadFolder[]>(PROJECTS_STORAGE_KEY, [])
    const folder: ThreadFolder = {
      id: crypto.randomUUID(),
      name,
      updated_at: Date.now(),
      assistantId,
    }
    projects.unshift(folder)
    saveToStorage(PROJECTS_STORAGE_KEY, projects)
    return folder
  },

  async updateProject(id, name, assistantId) {
    const projects = loadFromStorage<ThreadFolder[]>(PROJECTS_STORAGE_KEY, [])
    const idx = projects.findIndex((p) => p.id === id)
    if (idx === -1) return
    projects[idx] = { ...projects[idx], name, assistantId, updated_at: Date.now() }
    saveToStorage(PROJECTS_STORAGE_KEY, projects)
  },

  async deleteProject(id) {
    const projects = loadFromStorage<ThreadFolder[]>(PROJECTS_STORAGE_KEY, [])
    saveToStorage(
      PROJECTS_STORAGE_KEY,
      projects.filter((p) => p.id !== id)
    )
  },

  async getProjectById(id) {
    const projects = loadFromStorage<ThreadFolder[]>(PROJECTS_STORAGE_KEY, [])
    return projects.find((p) => p.id === id)
  },

  async setProjects(projects) {
    saveToStorage(PROJECTS_STORAGE_KEY, projects)
  },
}

// ═══════════════════════════════════════════════════════════════════
// Default ServiceHub
// ═══════════════════════════════════════════════════════════════════

export const defaultServiceHub: ServiceHub = {
  messages: () => messagesService,
  threads: () => threadsService,
  models: () => modelsService,
  providers: () => providersService,
  dialog: () => dialogService,
  rag: () => ragService,
  mcp: () => mcpService,
  uploads: () => uploadsService,
  projects: () => projectsService,
  assistants: () => ({
    createAssistant: async (a) => a,
    deleteAssistant: async () => {},
    getAssistants: async () => [],
  }),
  path: () => ({
    sep: () => '/',
  }),
  events: () => eventsService,
  core: () => ({
    invoke: async <T>(cmd: string, _args?: Record<string, unknown>): Promise<T> => {
      throw new Error(`No backend for command '${cmd}' (web build)`)
    },
  }),
}

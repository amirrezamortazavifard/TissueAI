// TissueAI type declarations

import type { Thread, ThreadMessage, Assistant, ModelInfo } from '@/types/core'
import type { ProjectsService } from '@/services/projects/types'

export type ProviderApiType = 'openai' | 'anthropic' | 'ollama'

// ═══════════════════════════════════════════════════════════════════
// Provider Setting Types (Jan-compatible dynamic settings)
// ═══════════════════════════════════════════════════════════════════

export type ControllerType = 'input' | 'slider' | 'checkbox' | 'dropdown' | 'tag'

export type ControllerProps = {
  value?: unknown
  placeholder?: string
  type?: string
  min?: number
  max?: number
  step?: number
  options?: Array<{ name: string; value: string | number }>
  input_actions?: string[]
  [key: string]: unknown
}

export type ProviderSetting = {
  key: string
  title?: string
  description?: string
  controller_type: ControllerType
  controller_props: ControllerProps
}

// ═══════════════════════════════════════════════════════════════════
// Model Types
// ═══════════════════════════════════════════════════════════════════

export type ModelSettingValue = {
  controller_props?: {
    value?: unknown
    max?: number
    [key: string]: unknown
  }
}

export type Model = {
  id: string
  model?: string
  name: string
  displayName?: string
  provider: string
  api_type?: ProviderApiType
  max_tokens?: number
  max_context_tokens?: number
  capabilities?: string[]
  settings?: Record<string, ModelSettingValue>
  embedding?: boolean
  version?: string
  description?: string
  template_kwargs?: Array<{
    name: string
    type: 'boolean' | 'number' | 'string'
    default: boolean | number | string
  }>
  _userConfiguredCapabilities?: boolean
  _autoDetectedVision?: boolean
}

// ═══════════════════════════════════════════════════════════════════
// Model Provider Types (Jan-compatible)
// ═══════════════════════════════════════════════════════════════════

export type ModelProvider = {
  provider: string
  active?: boolean
  api_type?: ProviderApiType
  api_key?: string
  api_key_fallbacks?: string[]
  base_url?: string
  explore_models_url?: string
  custom_header?: Array<{ header: string; value: string }>
  models: Model[]
  settings: ProviderSetting[]
  persist?: boolean
  hidden_models?: string[]
}

export type ProviderObject = {
  provider: string
  active?: boolean
  models?: Model[]
  settings?: ProviderSetting[]
  api_type?: ProviderApiType
  api_key?: string
  api_key_fallbacks?: string[]
  base_url?: string
  explore_models_url?: string
  custom_header?: Array<{ header: string; value: string }>
  persist?: boolean
}

export type ThreadModel = {
  id: string
  provider: string
}

export type ThreadAssistantInfo = {
  id: string
  name: string
  model?: ModelInfo
  instructions?: string
  parameters?: Record<string, unknown>
}

export type { Thread, ThreadMessage, Assistant }

// ═══════════════════════════════════════════════════════════════════
// ServiceHub Interfaces
// ═══════════════════════════════════════════════════════════════════

export type ServiceHubMessages = {
  fetchMessages: (threadId: string) => Promise<ThreadMessage[]>
  createMessage: (message: ThreadMessage) => Promise<ThreadMessage>
  modifyMessage: (message: ThreadMessage) => Promise<ThreadMessage>
  deleteMessage: (threadId: string, messageId: string) => Promise<void>
}

export type ServiceHubThreads = {
  createThread: (
    threadId: string,
    title: string,
    assistant?: unknown,
    projectMetadata?: { id: string; name: string; updated_at: number }
  ) => Promise<Thread>
  updateThread: (threadId: string, data: Partial<Thread>) => Promise<Thread>
  deleteThread: (threadId: string) => Promise<void>
  getThreads: () => Promise<Thread[]>
}

export type ServiceHubModels = {
  startModel: (provider: ProviderObject, modelId: string) => Promise<void>
  reloadModel: (provider: ProviderObject, modelId: string) => Promise<void>
  updateModelSettings: (modelId: string, settings: Record<string, unknown>) => Promise<void>
  stopModel: (modelId: string) => Promise<void>
  checkMmprojExists?: (modelId: string) => Promise<boolean>
  checkMmprojExistsAndUpdateOffloadMMprojSetting?: (
    modelId: string,
    updateProvider: (name: string, data: Partial<ModelProvider>) => void,
    getProviderByName: (name: string) => ModelProvider | undefined
  ) => Promise<void>
  getActiveModels?: () => Promise<string[]>
  fetchModels?: () => Promise<Array<{ id: string; providerId: string; sizeBytes?: number | null }>>
  getMtpInfo?: (modelId: string) => Promise<{
    mtp_layers: number
    mtp: boolean
    spec_draft_n_max?: number
    spec_draft_n_min?: number
    spec_draft_p_min?: number
  }>
  updateMtpSettings?: (
    modelId: string,
    patch: {
      mtp?: boolean
      spec_draft_n_max?: number | null
      spec_draft_n_min?: number | null
      spec_draft_p_min?: number | null
    }
  ) => Promise<void>
  pauseDownload: (modelId: string) => Promise<void>
  pullModelWithMetadata: (
    modelId: string,
    modelPath: string,
    mmprojPath?: string,
    hfToken?: string
  ) => Promise<void>
  abortDownload: (name: string) => Promise<void>
}

export type ServiceHubProviders = {
  updateSettings: (
    providerId: string,
    settings: ProviderSetting[]
  ) => Promise<void>
  fetchModelsFromProvider: (provider: ModelProvider) => Promise<string[]>
}

export type ServiceHubDialog = {
  open: (options: {
    multiple?: boolean
    filters?: Array<{ name: string; extensions: string[] }>
  }) => Promise<string | string[] | null>
}

export type ServiceHubRag = {
  getTools: () => Promise<Array<{ name: string; description: string; inputSchema: unknown }>>
  getToolNames?: () => Promise<string[]>
  callTool: (params: {
    toolName: string
    arguments: unknown
    threadId: string
    projectId?: string
    scope: 'project' | 'thread'
  }) => Promise<{ content?: unknown; error?: string }>
  parseDocument?: (path: string, fileType?: string) => Promise<string | undefined>
  embed?: (texts: string[]) => Promise<number[][]>
}

export type ServiceHubMcp = {
  getTools: () => Promise<Array<{ name: string; description: string; inputSchema: unknown; server?: string }>>
  callTool: (params: {
    toolName: string
    arguments: unknown
  }) => Promise<{ content?: unknown; error?: string }>
  getToolsForServers?: (serverNames: string[]) => Promise<Array<{ name: string; description: string; inputSchema: unknown; server?: string }>>
  updateMCPConfig?: (config: string) => Promise<void>
  restartMCPServers?: () => Promise<void>
  getMCPConfig?: () => Promise<string>
  getServerSummaries?: () => Promise<Array<{ name: string; connected: boolean; capabilities?: string[]; description?: string }>>
  checkJanBrowserExtensionConnected?: () => Promise<boolean>
  activateMCPServer?: (name: string, config?: unknown) => Promise<void>
  deactivateMCPServer?: (name: string) => Promise<void>
}

export type ServiceHubUploads = {
  ingestImage: (threadId: string, image: unknown) => Promise<{ id: string } | null>
  ingestFileAttachment: (threadId: string, doc: unknown) => Promise<{ id?: string; size?: number; chunkCount?: number }>
  ingestFileAttachmentForProject: (projectId: string, doc: unknown) => Promise<{ id?: string; size?: number; chunkCount?: number }>
}

export type ServiceHubCore = {
  invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>
}

export type ServiceHubProjects = ProjectsService

export type ServiceHubAssistants = {
  createAssistant: (assistant: unknown) => Promise<unknown>
  deleteAssistant: (assistant: unknown) => Promise<void>
  getAssistants: () => Promise<unknown[]>
}

export type ServiceHubPath = {
  sep: () => string
}

export type ServiceHubEvents = {
  listen: (
    event: string,
    callback: (data?: unknown) => void
  ) => Promise<() => void>
}

export type ServiceHub = {
  messages(): ServiceHubMessages
  threads(): ServiceHubThreads
  models(): ServiceHubModels
  providers(): ServiceHubProviders
  dialog(): ServiceHubDialog
  rag(): ServiceHubRag
  mcp(): ServiceHubMcp
  uploads(): ServiceHubUploads
  projects(): ServiceHubProjects
  assistants(): ServiceHubAssistants
  path(): ServiceHubPath
  events(): ServiceHubEvents
  core(): ServiceHubCore
}

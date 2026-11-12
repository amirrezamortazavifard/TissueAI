// Core types adapted from @janhq/core for TissueAI

// ═══════════════════════════════════════════════════════════════════
// Extension Stubs (Jan-specific, simplified for TissueAI)
// ═══════════════════════════════════════════════════════════════════

export enum ExtensionTypeEnum {
  VectorDB = 'vector_db',
  RAG = 'rag',
  MCP = 'mcp',
}

export interface MCPExtension {
  [key: string]: unknown
  getDefaultDisabledTools?: () => Promise<string[]>
}

export interface VectorDBExtension {
  [key: string]: unknown
  deleteFile?: (threadId: string, fileId: string) => Promise<void>
  deleteCollection?: (collectionName: string) => Promise<void>
  listAttachments?: (threadId: string, limit?: number) => Promise<Array<{ id: string; name?: string }>>
  listAttachmentsForProject?: (projectId: string, limit?: number) => Promise<Array<{ id: string; name?: string }>>
}

export interface SettingComponentProps {
  key: string
  title?: string
  description?: string
  controllerProps: {
    value: unknown
    [key: string]: unknown
  }
}

export interface RAGExtension {
  [key: string]: unknown
  getSettings?: () => Promise<SettingComponentProps[]>
  updateSettings?: (settings: Partial<SettingComponentProps>[]) => Promise<void>
}

// ═══════════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════════

export enum MessageStatus {
  Ready = 'ready',
  Pending = 'pending',
  Error = 'error',
  Stopped = 'stopped',
}

export enum ChatCompletionRole {
  System = 'system',
  Assistant = 'assistant',
  User = 'user',
  Tool = 'tool',
}

export enum ContentType {
  Text = 'text',
  Reasoning = 'reasoning',
  Image = 'image_url',
  InputAudio = 'input_audio',
  InputVideo = 'input_video',
  ToolCall = 'tool_call',
}

export enum ErrorCode {
  InvalidApiKey = 'invalid_api_key',
  AuthenticationError = 'authentication_error',
  InsufficientQuota = 'insufficient_quota',
  InvalidRequestError = 'invalid_request_error',
  Unknown = 'unknown',
}

// ═══════════════════════════════════════════════════════════════════
// Content Types
// ═══════════════════════════════════════════════════════════════════

export type ContentValue = {
  value: string
  annotations: string[]
}

export type ImageContentValue = {
  detail?: string
  url?: string
}

export type InputAudioContentValue = {
  data: string
  format: 'wav' | 'mp3'
}

export type InputVideoContentValue = {
  data: string
  format?: string
}

export type ThreadContent = {
  type: ContentType
  text?: ContentValue
  image_url?: ImageContentValue
  input_audio?: InputAudioContentValue
  input_video?: InputVideoContentValue
  tool_call_id?: string
  tool_name?: string
  input?: unknown
  output?: unknown
}

// ═══════════════════════════════════════════════════════════════════
// Message Types
// ═══════════════════════════════════════════════════════════════════

export type ThreadMessage = {
  id: string
  object: string
  thread_id: string
  assistant_id?: string
  attachments?: Array<MessageAttachment> | null
  role: ChatCompletionRole
  content: ThreadContent[]
  status: MessageStatus
  created_at: number
  completed_at: number
  metadata?: {
    project?: { id: string; name: string; updated_at: number }
    [key: string]: unknown
  }
  type?: string
  error_code?: ErrorCode
  tool_call_id?: string
}

export type MessageAttachment = {
  file_id?: string
  tools?: Array<{ type: string }>
}

// ═══════════════════════════════════════════════════════════════════
// Thread Types
// ═══════════════════════════════════════════════════════════════════

export type ModelInfo = {
  id: string
  provider?: string
  settings?: Record<string, unknown>
  parameters?: Record<string, unknown>
  engine?: string
}

export type AssistantTool = {
  type: string
  enabled: boolean
  useTimeWeightedRetriever?: boolean
  settings: unknown
}

export type ThreadAssistantInfo = {
  id: string
  name: string
  model?: ModelInfo
  instructions?: string
  tools?: AssistantTool[]
  parameters?: Record<string, unknown>
  avatar?: string
}

export type Thread = {
  id: string
  object: string
  title: string
  assistants: ThreadAssistantInfo[]
  created: number
  updated: number
  isFavorite?: boolean
  model?: { id: string; provider: string }
  metadata?: {
    project?: { id: string; name: string; updated_at: number }
    [key: string]: unknown
  }
}

export type Assistant = {
  id: string
  name: string
  created_at?: number
  parameters?: Record<string, unknown>
  avatar?: string
  description?: string
  instructions?: string
  tools?: AssistantTool[]
}

export type ThreadState = {
  hasMore: boolean
  waitingForResponse: boolean
  error?: Error
  lastMessage?: string
}

// ═══════════════════════════════════════════════════════════════════
// Inference Types
// ═══════════════════════════════════════════════════════════════════

export type ChatCompletionMessageContent =
  | string
  | Array<ChatCompletionMessageContentText | ChatCompletionMessageContentImage | ChatCompletionMessageContentDoc>

export enum ChatCompletionMessageContentType {
  Text = 'text',
  Image = 'image_url',
  Doc = 'doc_url',
}

export type ChatCompletionMessageContentText = {
  type: ChatCompletionMessageContentType
  text: string
}

export type ChatCompletionMessageContentImage = {
  type: ChatCompletionMessageContentType
  image_url: { url: string }
}

export type ChatCompletionMessageContentDoc = {
  type: ChatCompletionMessageContentType
  doc_url: { url: string }
}

export type ChatCompletionMessage = {
  content?: ChatCompletionMessageContent
  role: ChatCompletionRole
  type?: string
  output?: string
  tool_call_id?: string
}

// ═══════════════════════════════════════════════════════════════════
// Message Request Types
// ═══════════════════════════════════════════════════════════════════

export type MessageFunction = {
  name: string
  description?: string
  parameters?: Record<string, unknown>
  strict?: boolean
}

export type MessageTool = {
  type: string
  function: MessageFunction
}

export type MessageRequest = {
  id?: string
  threadId: string
  assistantId?: string
  attachments: Array<MessageAttachment> | null
  messages?: ChatCompletionMessage[]
  model?: ModelInfo
  thread?: Thread
  tools?: MessageTool[]
  engine?: string
  type?: string
}

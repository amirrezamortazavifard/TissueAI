import type { MCPTool } from '@/types/completion'

// ═══════════════════════════════════════════════════════════════════
// MCP Tool Types
// ═══════════════════════════════════════════════════════════════════

export type { MCPTool }

export interface ServerSummary {
  name: string
  connected: boolean
  capabilities?: string[]
  description?: string
}

export interface MCPServiceLike {
  getTools(): Promise<MCPTool[]>
  getToolsForServers(serverNames: string[]): Promise<MCPTool[]>
  getServerSummaries(): Promise<ServerSummary[]>
}

// ═══════════════════════════════════════════════════════════════════
// Intent Classification (Keyword Routing)
// ═══════════════════════════════════════════════════════════════════

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'don', 'now', 'and',
  'but', 'or', 'if', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
  'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it',
  'its', 'they', 'them', 'their', 'what', 'which', 'who', 'whom',
])

const ROUTING_THRESHOLD = 5

/**
 * Tokenize a message and remove stop words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
}

/**
 * Score a server against message tokens
 */
function scoreServer(
  tokens: string[],
  server: ServerSummary
): number {
  let score = 0
  const serverName = server.name.toLowerCase()
  const capabilities = (server.capabilities || []).map((c) => c.toLowerCase())
  const description = (server.description || '').toLowerCase()

  for (const token of tokens) {
    // Exact name match: +4
    if (serverName.includes(token)) {
      score += 4
    }

    // Capability match: +2
    for (const cap of capabilities) {
      if (cap.includes(token)) {
        score += 2
      }
    }

    // Description match: +1
    if (description.includes(token)) {
      score += 1
    }
  }

  return score
}

/**
 * Classify intent and return relevant server names using keyword routing
 */
export function classifyIntent(
  userMessage: string,
  summaries: ServerSummary[]
): string[] {
  const tokens = tokenize(userMessage)

  if (tokens.length === 0 || summaries.length === 0) {
    return []
  }

  const scored = summaries
    .map((server) => ({
      name: server.name,
      score: scoreServer(tokens, server),
    }))
    .filter((s) => s.score >= 2) // Minimum score threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, 5) // Max 5 servers

  return scored.map((s) => s.name)
}

// ═══════════════════════════════════════════════════════════════════
// MCP Orchestrator
// ═══════════════════════════════════════════════════════════════════

export type McpRoutingFallbackReason =
  | 'none'
  | 'llm_timeout'
  | 'llm_abort'
  | 'llm_error'
  | 'llm_empty_output'
  | 'selective_tools_empty'
  | 'selective_fetch_error'

export type McpRoutingTelemetry = {
  routingRan: boolean
  connectedServerCount: number
  bypassedRouting: boolean
  pickSource: 'keyword' | 'llm' | null
  selectedServerCount: number
  totalLatencyMs: number
  llmRouterLatencyMs: number | null
  llmInvoked: boolean
  llmAccepted: boolean
  fallbackReason: McpRoutingFallbackReason
  selectiveToolsWereEmpty: boolean
  selectiveFetchHadError: boolean
  fellBackToFullToolList: boolean
}

export interface GetRelevantToolsOptions {
  abortSignal?: AbortSignal
  onRoutingTelemetry?: (info: McpRoutingTelemetry) => void
}

interface CacheEntry {
  tools: MCPTool[]
  expiresAt: number
}

const CACHE_TTL_MS = 30_000
const SUMMARY_TTL_MS = 60_000

export class MCPOrchestrator {
  private toolCache = new Map<string, CacheEntry>()
  private summaryCache: ServerSummary[] | null = null
  private summaryExpiresAt = 0

  /**
   * Returns tools relevant to `userMessage` with disabled keys filtered out.
   */
  async getRelevantTools(
    userMessage: string,
    service: MCPServiceLike,
    disabledKeys: string[],
    options?: GetRelevantToolsOptions
  ): Promise<MCPTool[]> {
    const started = performance.now()
    const summaries = await this.fetchSummaries(service)
    const emit = options?.onRoutingTelemetry
    const totalLatencyMs = () => Math.round(performance.now() - started)

    // If few servers, load all tools (no routing needed)
    if (summaries.length <= ROUTING_THRESHOLD) {
      const tools = await this.fetchAllTools(service)
      emit?.({
        routingRan: false,
        connectedServerCount: summaries.length,
        bypassedRouting: true,
        pickSource: null,
        selectedServerCount: summaries.length,
        totalLatencyMs: totalLatencyMs(),
        llmRouterLatencyMs: null,
        llmInvoked: false,
        llmAccepted: false,
        fallbackReason: 'none',
        selectiveToolsWereEmpty: false,
        selectiveFetchHadError: false,
        fellBackToFullToolList: false,
      })
      return this.filterDisabled(tools, disabledKeys)
    }

    // Keyword routing
    const selectedNames = classifyIntent(userMessage, summaries)

    const { tools: routedTools, requestFailed } =
      await this.fetchToolsForServersWithStatus(selectedNames, service)
    let tools = routedTools
    const selectiveToolsWereEmpty = tools.length === 0
    let fellBackToFullToolList = false
    if (tools.length === 0) {
      fellBackToFullToolList = true
      tools = await this.fetchAllTools(service)
    }

    let fallbackReason: McpRoutingFallbackReason = 'none'
    if (fellBackToFullToolList) {
      fallbackReason = requestFailed ? 'selective_fetch_error' : 'selective_tools_empty'
    }

    const routedTelemetry: McpRoutingTelemetry = {
      routingRan: true,
      connectedServerCount: summaries.length,
      bypassedRouting: false,
      pickSource: 'keyword',
      selectedServerCount: selectedNames.length,
      totalLatencyMs: totalLatencyMs(),
      llmRouterLatencyMs: null,
      llmInvoked: false,
      llmAccepted: false,
      fallbackReason,
      selectiveToolsWereEmpty,
      selectiveFetchHadError: requestFailed,
      fellBackToFullToolList,
    }
    try { emit?.(routedTelemetry) } catch { /* telemetry must not crash routing */ }

    return this.filterDisabled(tools, disabledKeys)
  }

  /**
   * Clears cached tool data.
   */
  invalidateCache(serverName?: string): void {
    if (serverName) {
      this.toolCache.delete(serverName)
    } else {
      this.toolCache.clear()
      this.summaryCache = null
      this.summaryExpiresAt = 0
    }
  }

  private async fetchSummaries(service: MCPServiceLike): Promise<ServerSummary[]> {
    const now = Date.now()
    if (this.summaryCache !== null && now < this.summaryExpiresAt) {
      return this.summaryCache
    }
    try {
      const summaries = await service.getServerSummaries()
      this.summaryCache = summaries
      this.summaryExpiresAt = now + SUMMARY_TTL_MS
      return summaries
    } catch {
      return []
    }
  }

  private async fetchAllTools(service: MCPServiceLike): Promise<MCPTool[]> {
    try {
      return await service.getTools()
    } catch {
      return []
    }
  }

  private async fetchToolsForServersWithStatus(
    serverNames: string[],
    service: MCPServiceLike
  ): Promise<{ tools: MCPTool[]; requestFailed: boolean }> {
    const now = Date.now()
    const result: MCPTool[] = []
    const uncached: string[] = []

    for (const name of serverNames) {
      const entry = this.toolCache.get(name)
      if (entry && now < entry.expiresAt) {
        result.push(...entry.tools)
      } else {
        uncached.push(name)
      }
    }

    let requestFailed = false
    if (uncached.length > 0) {
      try {
        const fresh = await service.getToolsForServers(uncached)

        const byServer = new Map<string, MCPTool[]>()
        for (const tool of fresh) {
          const srv = (tool as { server?: string }).server ?? 'unknown'
          if (!byServer.has(srv)) byServer.set(srv, [])
          byServer.get(srv)!.push(tool)
        }

        for (const name of uncached) {
          const serverTools = byServer.get(name) ?? []
          this.toolCache.set(name, { tools: serverTools, expiresAt: now + CACHE_TTL_MS })
          result.push(...serverTools)
        }
      } catch {
        requestFailed = true
      }
    }

    return { tools: result, requestFailed }
  }

  private filterDisabled(tools: MCPTool[], disabledKeys: string[]): MCPTool[] {
    const filtered =
      disabledKeys.length === 0
        ? tools
        : tools.filter((tool) => {
            const key = `${(tool as { server?: string }).server ?? 'unknown'}::${tool.name}`
            return !disabledKeys.includes(key)
          })
    // Sort by (server, name) for stable ordering
    return [...filtered].sort((a, b) => {
      const serverA = (a as { server?: string }).server ?? 'unknown'
      const serverB = (b as { server?: string }).server ?? 'unknown'
      if (serverA !== serverB) return serverA < serverB ? -1 : 1
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    })
  }
}

// Shared across all instances within the same session
export const mcpOrchestrator = new MCPOrchestrator()

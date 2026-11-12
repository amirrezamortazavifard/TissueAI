import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ═══════════════════════════════════════════════════════════════════
// MCP Server Configuration Types (Jan-compatible)
// ═══════════════════════════════════════════════════════════════════

export type MCPServerConfig = {
  command: string
  args: string[]
  env: Record<string, string>
  active?: boolean
  type?: 'stdio' | 'http' | 'sse'
  url?: string
  headers?: Record<string, string>
  timeout?: number
  official?: boolean
  capabilities?: string[]
  description?: string
}

export type MCPServers = {
  [key: string]: MCPServerConfig
}

export type MCPSettings = {
  toolCallTimeoutSeconds: number
  baseRestartDelayMs: number
  maxRestartDelayMs: number
  backoffMultiplier: number
  enableSmartToolRouting: boolean
  useLightweightRouterModel: boolean
  routerModelProvider: string
  routerModelId: string
}

export const DEFAULT_MCP_SETTINGS: MCPSettings = {
  toolCallTimeoutSeconds: 30,
  baseRestartDelayMs: 1000,
  maxRestartDelayMs: 30000,
  backoffMultiplier: 2,
  enableSmartToolRouting: true,
  useLightweightRouterModel: false,
  routerModelProvider: '',
  routerModelId: '',
}

// ═══════════════════════════════════════════════════════════════════
// MCP Store State
// ═══════════════════════════════════════════════════════════════════

type MCPServerStoreState = {
  open: boolean
  mcpServers: MCPServers
  settings: MCPSettings
  loading: boolean
  deletedServerKeys: string[]
  getServerConfig: (key: string) => MCPServerConfig | undefined
  setLeftPanel: (value: boolean) => void
  addServer: (key: string, config: MCPServerConfig) => void
  editServer: (key: string, config: MCPServerConfig) => void
  renameServer: (
    oldKey: string,
    newKey: string,
    config: MCPServerConfig
  ) => void
  deleteServer: (key: string) => void
  setServers: (servers: MCPServers) => void
  setSettings: (settings: MCPSettings) => void
  updateSettings: (partial: Partial<MCPSettings>) => void
  syncServers: () => Promise<void>
  syncServersAndRestart: () => Promise<void>
}

// ═══════════════════════════════════════════════════════════════════
// Tauri Command Helpers
// ═══════════════════════════════════════════════════════════════════

async function invokeTauriCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

// ═══════════════════════════════════════════════════════════════════
// MCP Zustand Store
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'tissueai-mcp-servers'

export const useMCPServers = create<MCPServerStoreState>()(
  persist(
    (set, get) => ({
      open: true,
      mcpServers: {},
      settings: { ...DEFAULT_MCP_SETTINGS },
      loading: false,
      deletedServerKeys: [],

      setLeftPanel: (value) => set({ open: value }),

      getServerConfig: (key) => {
        const mcpServers = get().mcpServers
        return mcpServers[key] ? mcpServers[key] : undefined
      },

      addServer: (key, config) =>
        set((state) => {
          const { [key]: _, ...restServers } = state.mcpServers
          const mcpServers = { [key]: config, ...restServers }
          return { mcpServers }
        }),

      editServer: (key, config) =>
        set((state) => {
          if (!state.mcpServers[key]) return state
          const mcpServers = { ...state.mcpServers, [key]: config }
          return { mcpServers }
        }),

      renameServer: (oldKey, newKey, config) =>
        set((state) => {
          if (!state.mcpServers[oldKey]) return state

          const entries = Object.entries(state.mcpServers)
          const mcpServers: MCPServers = {}

          entries.forEach(([key, serverConfig]) => {
            if (key === oldKey) {
              mcpServers[newKey] = config
            } else {
              mcpServers[key] = serverConfig
            }
          })

          return { mcpServers }
        }),

      setServers: (servers) =>
        set((state) => {
          const mcpServers = { ...state.mcpServers, ...servers }
          return { mcpServers }
        }),

      setSettings: (settings) =>
        set(() => ({
          settings: {
            ...DEFAULT_MCP_SETTINGS,
            ...settings,
          },
        })),

      updateSettings: (partial) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ...partial,
          },
        })),

      deleteServer: (key) =>
        set((state) => {
          const updatedServers = { ...state.mcpServers }
          if (updatedServers[key]) {
            delete updatedServers[key]
          }
          return {
            mcpServers: updatedServers,
            deletedServerKeys: [...state.deletedServerKeys, key],
          }
        }),

      syncServers: async () => {
        const { mcpServers, settings } = get()
        try {
          await invokeTauriCommand('mcp_update_config', {
            configStr: JSON.stringify({
              mcpServers,
              mcpSettings: settings,
            }),
          })
        } catch (error) {
          console.error('Failed to sync MCP servers:', error)
        }
      },

      syncServersAndRestart: async () => {
        const { syncServers } = get()
        try {
          await syncServers()
          await invokeTauriCommand('mcp_restart_servers')
        } catch (error) {
          console.error('Failed to restart MCP servers:', error)
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    }
  )
)

import { useState, useMemo } from "react"
import {
  Puzzle,
  Plus,
  X,
  Play,
  Pause,
  Trash2,
  ChevronDown,
  ChevronRight,
  Settings,
  Wrench,
  Server,
  Info,
} from "lucide-react"
import { useMCPServers, type MCPServerConfig } from "@/hooks/useMCPServers"

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

const SERVER_TYPES = [
  { value: "stdio" as const, label: "Standard I/O", description: "Communicates via stdin/stdout" },
  { value: "http" as const, label: "HTTP", description: "Connects to HTTP endpoint" },
  { value: "sse" as const, label: "SSE", description: "Server-Sent Events connection" },
]

const OFFICIAL_SERVERS: { key: string; config: MCPServerConfig }[] = [
  {
    key: "filesystem",
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"],
      env: {},
      active: false,
      official: true,
      capabilities: ["read", "write", "list"],
      description: "Read and write files on the local filesystem",
    },
  },
  {
    key: "brave-search",
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: { BRAVE_API_KEY: "" },
      active: false,
      official: true,
      capabilities: ["search", "web"],
      description: "Web search via Brave Search API",
    },
  },
  {
    key: "github",
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
      active: false,
      official: true,
      capabilities: ["github", "repos", "issues"],
      description: "Interact with GitHub API (repos, issues, PRs)",
    },
  },
  {
    key: "postgres",
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres"],
      env: { POSTGRES_CONNECTION_STRING: "" },
      active: false,
      official: true,
      capabilities: ["database", "sql", "postgres"],
      description: "Query PostgreSQL databases",
    },
  },
  {
    key: "puppeteer",
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-puppeteer"],
      env: {},
      active: false,
      official: true,
      capabilities: ["browser", "screenshots", "automation"],
      description: "Browser automation with Puppeteer",
    },
  },
]

// ═══════════════════════════════════════════════════════════════════
// Server Card
// ═══════════════════════════════════════════════════════════════════

function ServerCard({
  name,
  config,
  onToggle,
  onEdit,
  onDelete,
}: {
  name: string
  config: MCPServerConfig
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/8 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: config.active
                ? "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(34,197,94,0.1))"
                : "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
              color: config.active ? "#22c55e" : "var(--text-4)",
            }}
          >
            {config.type === "sse" || config.type === "http" ? (
              <Server size={16} />
            ) : (
              <Wrench size={16} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-[var(--text-1)] truncate">
                {name}
              </p>
              {config.official && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  Official
                </span>
              )}
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded ${
                  config.active
                    ? "bg-green-500/15 text-green-400"
                    : "bg-white/5 text-[var(--text-4)]"
                }`}
              >
                {config.active ? "Active" : "Inactive"}
              </span>
            </div>
            {config.description && (
              <p className="text-[11px] text-[var(--text-4)] mt-0.5 line-clamp-1">
                {config.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-[var(--text-4)] font-mono bg-white/5 px-1.5 py-0.5 rounded">
                {config.type || "stdio"}
              </span>
              <span className="text-[10px] text-[var(--text-4)] truncate max-w-[200px]">
                {config.command} {config.args?.slice(0, 2).join(" ")}
              </span>
            </div>
            {config.capabilities && config.capabilities.length > 0 && (
              <div className="flex gap-1 mt-1.5">
                {config.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-[9px] px-1 py-0 rounded bg-white/5 text-[var(--text-3)]"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-4)]"
            title="Edit"
          >
            <Settings size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-500/15 text-[var(--text-4)] hover:text-red-400"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={onToggle}
            className={`p-1.5 rounded-lg transition-colors ${
              config.active
                ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                : "bg-white/5 text-[var(--text-4)] hover:bg-white/10"
            }`}
            title={config.active ? "Deactivate" : "Activate"}
          >
            {config.active ? <Pause size={13} /> : <Play size={13} />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Edit Server Modal
// ═══════════════════════════════════════════════════════════════════

function EditServerModal({
  serverKey,
  config,
  isNew,
  onSave,
  onClose,
}: {
  serverKey: string
  config: MCPServerConfig
  isNew: boolean
  onSave: (key: string, config: MCPServerConfig) => void
  onClose: () => void
}) {
  const [key, setKey] = useState(serverKey)
  const [command, setCommand] = useState(config.command || "")
  const [argsStr, setArgsStr] = useState((config.args || []).join("\n"))
  const [envStr, setEnvStr] = useState(
    Object.entries(config.env || {})
      .map(([k, v]) => `${k}=${v}`)
      .join("\n")
  )
  const [type, setType] = useState<"stdio" | "http" | "sse">(config.type || "stdio")
  const [url, setUrl] = useState(config.url || "")
  const [description, setDescription] = useState(config.description || "")
  const [capabilities, setCapabilities] = useState(
    (config.capabilities || []).join(", ")
  )

  const handleSave = () => {
    const args = argsStr.split("\n").filter((a) => a.trim())
    const env: Record<string, string> = {}
    envStr
      .split("\n")
      .filter((l) => l.trim())
      .forEach((line) => {
        const eq = line.indexOf("=")
        if (eq > 0) {
          const k = line.slice(0, eq).trim()
          const v = line.slice(eq + 1).trim()
          if (k) env[k] = v
        }
      })

    const caps = capabilities
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)

    onSave(key, {
      ...config,
      command,
      args,
      env,
      type,
      url: type !== "stdio" ? url : undefined,
      description: description || undefined,
      capabilities: caps.length > 0 ? caps : undefined,
      active: config.active ?? false,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[var(--text-1)]">
            {isNew ? "Add MCP Server" : "Edit MCP Server"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-4)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Server Name */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[var(--text-3)] block">
            Server Name
          </label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={!isNew}
            className="glass-input w-full text-[13px]"
            placeholder="my-mcp-server"
          />
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[var(--text-3)] block">
            Connection Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SERVER_TYPES.map((st) => (
              <button
                key={st.value}
                onClick={() => setType(st.value)}
                className={`p-2 rounded-lg text-center transition-all ${
                  type === st.value
                    ? "bg-primary/15 border border-primary/30 text-primary"
                    : "bg-white/3 border border-white/5 text-[var(--text-3)] hover:bg-white/6"
                }`}
              >
                <p className="text-[11px] font-medium">{st.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* URL for http/sse */}
        {type !== "stdio" && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[var(--text-3)] block">
              Server URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="glass-input w-full text-[13px]"
              placeholder="http://localhost:3000/mcp"
            />
          </div>
        )}

        {/* Command for stdio */}
        {type === "stdio" && (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--text-3)] block">
                Command
              </label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="glass-input w-full text-[13px]"
                placeholder="npx"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--text-3)] block">
                Arguments (one per line)
              </label>
              <textarea
                value={argsStr}
                onChange={(e) => setArgsStr(e.target.value)}
                className="glass-input w-full text-[13px] min-h-[60px] resize-y font-mono text-[12px]"
                placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/path/to/dir"}
              />
            </div>
          </>
        )}

        {/* Env */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[var(--text-3)] block">
            Environment Variables (KEY=value, one per line)
          </label>
          <textarea
            value={envStr}
            onChange={(e) => setEnvStr(e.target.value)}
            className="glass-input w-full text-[13px] min-h-[60px] resize-y font-mono text-[12px]"
            placeholder={"BRAVE_API_KEY=brave-xxx\nOTHER_VAR=value"}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[var(--text-3)] block">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="glass-input w-full text-[13px]"
            placeholder="What does this server do?"
          />
        </div>

        {/* Capabilities */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[var(--text-3)] block">
            Capabilities (comma-separated)
          </label>
          <input
            type="text"
            value={capabilities}
            onChange={(e) => setCapabilities(e.target.value)}
            className="glass-input w-full text-[13px]"
            placeholder="search, web, filesystem"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button onClick={onClose} className="btn-glass flex-1 text-[13px] py-2.5">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-accent flex-1 text-[13px] py-2.5">
            {isNew ? "Add Server" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

export default function McpSettings() {
  const {
    mcpServers,
    settings,
    addServer,
    editServer,
    deleteServer,
    updateSettings,
    syncServersAndRestart,
  } = useMCPServers()

  const [showAdd, setShowAdd] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [showOfficial, setShowOfficial] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const serverEntries = useMemo(() => Object.entries(mcpServers), [mcpServers])
  const activeCount = useMemo(
    () => serverEntries.filter(([, c]) => c.active).length,
    [serverEntries]
  )

  const editingConfig = editingKey
    ? editingKey === "__new__"
      ? {
          command: "",
          args: [],
          env: {},
          type: "stdio" as const,
          active: false,
        }
      : mcpServers[editingKey]
    : null

  const handleSave = (key: string, config: MCPServerConfig) => {
    if (editingKey === "__new__") {
      addServer(key, config)
    } else {
      editServer(key, config)
    }
    setEditingKey(null)
    setShowAdd(false)
    syncServersAndRestart()
  }

  const handleDelete = (key: string) => {
    if (confirm(`Delete server "${key}"?`)) {
      deleteServer(key)
      syncServersAndRestart()
    }
  }

  const handleToggle = (key: string) => {
    const config = mcpServers[key]
    if (!config) return
    editServer(key, { ...config, active: !config.active })
    syncServersAndRestart()
  }

  const handleAddOfficial = (officialKey: string) => {
    const official = OFFICIAL_SERVERS.find((o) => o.key === officialKey)
    if (!official || mcpServers[official.key]) return
    addServer(official.key, { ...official.config, active: false })
    setShowOfficial(false)
    syncServersAndRestart()
  }

  return (
    <div className="flex-1 overflow-y-auto relative page-enter">
      <div className="max-w-[800px] mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(236,72,153,0.15))",
                border: "1px solid rgba(139,92,246,0.2)",
              }}
            >
              <Puzzle size={20} style={{ color: "#8b5cf6" }} />
            </div>
            <div>
              <h1
                style={{ color: "var(--text-1)" }}
                className="text-[28px] font-bold leading-none tracking-tight"
              >
                MCP Servers
              </h1>
              <p
                style={{ color: "var(--text-3)" }}
                className="text-[13px] mt-1"
              >
                Model Context Protocol tools and integrations
              </p>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="glass-card-static p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Server size={14} className="text-[var(--text-3)]" />
                <span className="text-[13px] text-[var(--text-1)]">
                  {serverEntries.length} server{serverEntries.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-[12px] text-[var(--text-4)]">
                  {activeCount} active
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOfficial(!showOfficial)}
                className="btn-glass text-[12px] py-1.5 px-3 flex items-center gap-1"
              >
                <Info size={13} /> Presets
              </button>
              <button
                onClick={() => {
                  setEditingKey("__new__")
                  setShowAdd(true)
                }}
                className="btn-accent text-[12px] py-1.5 px-3 flex items-center gap-1"
              >
                <Plus size={14} /> Add Server
              </button>
            </div>
          </div>
        </div>

        {/* Official Presets */}
        {showOfficial && (
          <div className="glass-card-static p-5">
            <p className="text-[13px] font-medium text-[var(--text-1)] mb-3">
              Official MCP Servers
            </p>
            <div className="grid grid-cols-2 gap-2">
              {OFFICIAL_SERVERS.map((official) => {
                const exists = !!mcpServers[official.key]
                return (
                  <button
                    key={official.key}
                    onClick={() => handleAddOfficial(official.key)}
                    disabled={exists}
                    className="p-3 rounded-lg text-left transition-all bg-white/3 border border-white/5 hover:bg-white/6 disabled:opacity-40 disabled:cursor-default"
                  >
                    <p className="text-[12px] font-medium text-[var(--text-1)]">
                      {official.key}
                    </p>
                    <p className="text-[10px] text-[var(--text-4)] mt-0.5 line-clamp-1">
                      {official.config.description}
                    </p>
                    {exists && (
                      <span className="text-[9px] text-green-400 mt-1 inline-block">
                        Already added
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Servers List */}
        <div className="space-y-3">
          {serverEntries.length === 0 ? (
            <div className="glass-card-static p-8 text-center">
              <Puzzle
                size={32}
                className="mx-auto mb-3 text-[var(--text-4)]"
              />
              <p className="text-[14px] text-[var(--text-3)]">
                No MCP servers configured
              </p>
              <p className="text-[12px] text-[var(--text-4)] mt-1 mb-4">
                Add servers to extend the agent with external tools and data
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setShowOfficial(true)}
                  className="btn-glass text-[12px] py-2 px-4"
                >
                  Browse Presets
                </button>
                <button
                  onClick={() => {
                    setEditingKey("__new__")
                    setShowAdd(true)
                  }}
                  className="btn-accent text-[12px] py-2 px-4"
                >
                  Add Custom Server
                </button>
              </div>
            </div>
          ) : (
            serverEntries.map(([key, config]) => (
              <ServerCard
                key={key}
                name={key}
                config={config}
                onToggle={() => handleToggle(key)}
                onEdit={() => {
                  setEditingKey(key)
                  setShowAdd(true)
                }}
                onDelete={() => handleDelete(key)}
              />
            ))
          )}
        </div>

        {/* Advanced Settings */}
        <div className="glass-card-static p-5">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 w-full"
          >
            {showAdvanced ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            <Settings size={14} className="text-[var(--text-3)]" />
            <span className="text-[13px] font-medium text-[var(--text-1)]">
              Advanced Settings
            </span>
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              {/* Smart Routing */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-[var(--text-1)]">
                    Smart Tool Routing
                  </p>
                  <p className="text-[11px] text-[var(--text-4)]">
                    Auto-select tools based on query intent
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateSettings({
                      enableSmartToolRouting: !settings.enableSmartToolRouting,
                    })
                  }
                  className={`w-10 h-5 rounded-full transition-colors ${
                    settings.enableSmartToolRouting
                      ? "bg-primary"
                      : "bg-[var(--bg-3)]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.enableSmartToolRouting
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Tool Call Timeout */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-3)] block">
                  Tool Call Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={settings.toolCallTimeoutSeconds}
                  onChange={(e) =>
                    updateSettings({
                      toolCallTimeoutSeconds: Number(e.target.value),
                    })
                  }
                  className="glass-input w-full text-[13px]"
                  min={5}
                  max={300}
                />
              </div>

              {/* Restart Delays */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-[var(--text-3)] block">
                    Base Restart Delay (ms)
                  </label>
                  <input
                    type="number"
                    value={settings.baseRestartDelayMs}
                    onChange={(e) =>
                      updateSettings({
                        baseRestartDelayMs: Number(e.target.value),
                      })
                    }
                    className="glass-input w-full text-[13px]"
                    min={100}
                    max={10000}
                    step={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-[var(--text-3)] block">
                    Max Restart Delay (ms)
                  </label>
                  <input
                    type="number"
                    value={settings.maxRestartDelayMs}
                    onChange={(e) =>
                      updateSettings({
                        maxRestartDelayMs: Number(e.target.value),
                      })
                    }
                    className="glass-input w-full text-[13px]"
                    min={1000}
                    max={120000}
                    step={1000}
                  />
                </div>
              </div>

              {/* Backoff Multiplier */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-3)] block">
                  Backoff Multiplier
                </label>
                <input
                  type="number"
                  value={settings.backoffMultiplier}
                  onChange={(e) =>
                    updateSettings({
                      backoffMultiplier: Number(e.target.value),
                    })
                  }
                  className="glass-input w-full text-[13px]"
                  min={1}
                  max={10}
                  step={0.5}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showAdd && editingConfig && (
        <EditServerModal
          serverKey={editingKey === "__new__" ? "" : editingKey || ""}
          config={editingConfig}
          isNew={editingKey === "__new__"}
          onSave={handleSave}
          onClose={() => {
            setEditingKey(null)
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}

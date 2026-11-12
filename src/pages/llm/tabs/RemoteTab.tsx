import { useState, useMemo } from "react"
import {
  BrainCircuit,
  Cloud,
  Plus,
  X,
  Bot,
  Zap,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Check,
} from "lucide-react"
import { useModelProvider } from "@/hooks/useModelProvider"
import {
  predefinedProviders,
  providerHasRemoteApiKeys,
  getProviderTitle,
} from "@/constants/providers"
import type { ModelProvider, ProviderApiType, ProviderSetting } from "@/types"

const apiTypes = [
  { value: "openai" as const, label: "OpenAI", color: "#22c55e" },
  { value: "anthropic" as const, label: "Anthropic", color: "#f59e0b" },
  { value: "ollama" as const, label: "Ollama", color: "#8b5cf6" },
]

// ═══════════════════════════════════════════════════════════════════
// Dynamic Setting Component
// ═══════════════════════════════════════════════════════════════════

function DynamicSetting({
  setting,
  value,
  onChange,
}: {
  setting: ProviderSetting
  value: unknown
  onChange: (value: unknown) => void
}) {
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (typeof value === "string") {
      navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (setting.controller_type === "input") {
    const isPassword = setting.controller_props?.type === "password"
    return (
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-[var(--text-3)] block">
          {setting.title}
        </label>
        {setting.description && (
          <p className="text-[11px] text-[var(--text-4)] leading-relaxed">
            {setting.description}
          </p>
        )}
        <div className="relative">
          <input
            type={isPassword && !showKey ? "password" : "text"}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={setting.controller_props?.placeholder as string}
            className="glass-input w-full text-[13px] pr-20"
          />
          {isPassword && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="p-1 rounded hover:bg-white/10 text-[var(--text-4)]"
                title={showKey ? "Hide" : "Show"}
              >
                {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 rounded hover:bg-white/10 text-[var(--text-4)]"
                title="Copy"
              >
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (setting.controller_type === "dropdown") {
    return (
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-[var(--text-3)] block">
          {setting.title}
        </label>
        {setting.description && (
          <p className="text-[11px] text-[var(--text-4)] leading-relaxed">
            {setting.description}
          </p>
        )}
        <select
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className="glass-input w-full text-[13px]"
        >
          {setting.controller_props?.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.name}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (setting.controller_type === "checkbox") {
    return (
      <div className="flex items-center justify-between">
        <div>
          <label className="text-[13px] text-[var(--text-1)]">{setting.title}</label>
          {setting.description && (
            <p className="text-[11px] text-[var(--text-4)]">{setting.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`w-10 h-5 rounded-full transition-colors ${value ? "bg-primary" : "bg-[var(--bg-3)]"}`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
      </div>
    )
  }

  return null
}

// ═══════════════════════════════════════════════════════════════════
// Provider Card Component
// ═══════════════════════════════════════════════════════════════════

function ProviderCard({
  provider,
  isActive,
  onSelect,
  onConfigure,
}: {
  provider: ModelProvider
  isActive: boolean
  onSelect: () => void
  onConfigure: () => void
}) {
  const hasKey = providerHasRemoteApiKeys(provider)
  const modelCount = provider.models?.length || 0

  return (
    <div
      className={`p-4 rounded-xl cursor-pointer transition-all ${
        isActive
          ? "bg-primary/10 border border-primary/30"
          : "bg-white/5 border border-white/5 hover:bg-white/8"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
            style={{ background: predefinedProviders.find((p) => p.provider === provider.provider)?.settings ? undefined : "#888" }}
          >
            {provider.provider[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-[14px] font-medium text-[var(--text-1)]">
              {getProviderTitle(provider.provider)}
            </p>
            <p className="text-[11px] text-[var(--text-4)]">
              {modelCount} model{modelCount !== 1 ? "s" : ""} • {hasKey ? "Key set" : "No key"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              hasKey
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {hasKey ? "Active" : "Inactive"}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onConfigure()
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-4)]"
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

export default function RemoteTab() {
  const {
    providers,
    selectedProvider,
    selectedModel,
    setProviders,
    selectModelProvider,
    updateProvider,
  } = useModelProvider()

  const [showAddProvider, setShowAddProvider] = useState(false)
  const [configuringProvider, setConfiguringProvider] = useState<string | null>(null)
  const [newProvider, setNewProvider] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
    apiType: "openai" as ProviderApiType,
  })

  // Ensure all predefined providers exist in the list
  const allProviders = useMemo(() => {
    const existing = new Set(providers.map((p) => p.provider))
    const missing = predefinedProviders.filter((p) => !existing.has(p.provider))
    return [...providers, ...missing]
  }, [providers])

  const configuring = configuringProvider
    ? allProviders.find((p) => p.provider === configuringProvider)
    : null

  const handleAddProvider = () => {
    if (!newProvider.name.trim()) return
    const exists = providers.some(
      (p) => p.provider.toLowerCase() === newProvider.name.toLowerCase()
    )
    if (exists) return

    const provider: ModelProvider = {
      provider: newProvider.name,
      api_type: newProvider.apiType,
      api_key: newProvider.apiKey,
      base_url: newProvider.baseUrl,
      models: [],
      settings: [],
    }
    setProviders([...providers, provider])
    setNewProvider({ name: "", baseUrl: "", apiKey: "", apiType: "openai" })
    setShowAddProvider(false)
  }

  const handleSettingChange = (
    providerName: string,
    settingKey: string,
    value: unknown
  ) => {
    const provider = allProviders.find((p) => p.provider === providerName)
    if (!provider) return

    const updatedSettings = (provider.settings || []).map((s) =>
      s.key === settingKey
        ? { ...s, controller_props: { ...s.controller_props, value } }
        : s
    )

    // Also update api_key or base_url if the setting maps to those
    const updates: Partial<ModelProvider> = { settings: updatedSettings }
    if (settingKey === "api-key") {
      updates.api_key = value as string
    } else if (settingKey === "base-url") {
      updates.base_url = value as string
    }

    updateProvider(providerName, updates)
  }

  // ═══ Provider Configure View ═══════════════════════════════════════
  if (configuring) {
    return (
      <div className="flex-1 overflow-y-auto relative page-enter">
        <div className="max-w-[700px] mx-auto px-6 py-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setConfiguringProvider(null)}
              className="text-[var(--text-4)] hover:text-[var(--text-1)] text-[13px]"
            >
              ← Back
            </button>
            <div>
              <h1
                style={{ color: "var(--text-1)" }}
                className="text-[24px] font-bold"
              >
                {getProviderTitle(configuring.provider)}
              </h1>
              <p style={{ color: "var(--text-4)" }} className="text-[12px] mt-0.5">
                Configure API keys and settings
              </p>
            </div>
          </div>

          {/* Settings */}
          <div className="glass-card-static p-5 space-y-5">
            <p
              style={{ color: "var(--text-1)" }}
              className="text-[13px] font-medium"
            >
              Settings
            </p>
            {(configuring.settings || []).map((setting) => (
              <DynamicSetting
                key={setting.key}
                setting={setting}
                value={
                  setting.key === "api-key"
                    ? configuring.api_key || ""
                    : setting.key === "base-url"
                      ? configuring.base_url || ""
                      : setting.controller_props?.value
                }
                onChange={(value) =>
                  handleSettingChange(configuring.provider, setting.key, value)
                }
              />
            ))}
          </div>

          {/* Models */}
          <div className="glass-card-static p-5">
            <div className="flex items-center justify-between mb-4">
              <p
                style={{ color: "var(--text-1)" }}
                className="text-[13px] font-medium"
              >
                Models ({configuring.models?.length || 0})
              </p>
              {configuring.explore_models_url && (
                <a
                  href={configuring.explore_models_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                >
                  Browse models <ExternalLink size={10} />
                </a>
              )}
            </div>
            {(!configuring.models || configuring.models.length === 0) ? (
              <p style={{ color: "var(--text-4)" }} className="text-[12px]">
                No models configured. Add models manually or fetch from provider.
              </p>
            ) : (
              <div className="space-y-2">
                {configuring.models.map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[12px] text-[var(--text-1)]"
                      >
                        {model.name || model.id}
                      </span>
                      {model.capabilities && model.capabilities.length > 0 && (
                        <div className="flex gap-1">
                          {model.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="text-[9px] px-1 py-0 rounded bg-white/5 text-[var(--text-4)]"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          selectModelProvider(configuring.provider, model.id)
                        }
                        className={`text-[10px] px-2 py-0.5 rounded ${
                          selectedProvider === configuring.provider &&
                          selectedModel?.id === model.id
                            ? "bg-green-500/20 text-green-400"
                            : "bg-white/5 text-[var(--text-3)] hover:bg-white/10"
                        }`}
                      >
                        {selectedProvider === configuring.provider &&
                        selectedModel?.id === model.id
                          ? "Selected"
                          : "Select"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ═══ Main Provider List View ═══════════════════════════════════════
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
                  "linear-gradient(135deg, rgba(91,168,245,0.25), rgba(139,92,246,0.15))",
                border: "1px solid rgba(91,168,245,0.2)",
              }}
            >
              <Bot size={20} style={{ color: "#5BA8F5" }} />
            </div>
            <div>
              <h1
                style={{ color: "var(--text-1)" }}
                className="text-[28px] font-bold leading-none tracking-tight"
              >
                Agent Settings
              </h1>
              <p
                style={{ color: "var(--text-3)" }}
                className="text-[13px] mt-1"
              >
                Configure API providers, models, and agent capabilities
              </p>
            </div>
          </div>
        </div>

        {/* Current Model */}
        <div className="glass-card-static p-5">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))",
                color: "#22c55e",
              }}
            >
              <BrainCircuit size={16} />
            </div>
            <div>
              <p style={{ color: "var(--text-1)" }} className="text-[13px] font-medium">
                Active Model
              </p>
              <p style={{ color: "var(--text-4)" }} className="text-[12px] mt-0.5">
                Currently selected model for chat
              </p>
            </div>
          </div>
          <div
            className="p-3 rounded-lg"
            style={{
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            {selectedModel ? (
              <div>
                <p style={{ color: "#22c55e" }} className="text-[14px] font-medium">
                  {selectedModel.name || selectedModel.id}
                </p>
                <p style={{ color: "var(--text-4)" }} className="text-[12px]">
                  Provider: {selectedProvider}
                </p>
              </div>
            ) : (
              <p style={{ color: "var(--text-4)" }} className="text-[13px]">
                No model selected. Add a provider below.
              </p>
            )}
          </div>
        </div>

        {/* API Providers */}
        <div className="glass-card-static p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(91,168,245,0.2), rgba(91,168,245,0.05))",
                  color: "#5BA8F5",
                }}
              >
                <Cloud size={16} />
              </div>
              <div>
                <p style={{ color: "var(--text-1)" }} className="text-[13px] font-medium">
                  API Providers
                </p>
                <p style={{ color: "var(--text-4)" }} className="text-[12px] mt-0.5">
                  Manage your API providers and models
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddProvider(!showAddProvider)}
              className="btn-glass text-[12px] py-1.5 px-3 flex items-center gap-1"
            >
              <Plus size={14} /> Add Provider
            </button>
          </div>

          {/* Add Provider Form */}
          {showAddProvider && (
            <div
              className="p-4 rounded-lg mb-4"
              style={{
                background: "rgba(91,168,245,0.1)",
                border: "1px solid rgba(91,168,245,0.2)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <p style={{ color: "var(--text-1)" }} className="text-[13px] font-medium">
                  Add New Provider
                </p>
                <button
                  onClick={() => setShowAddProvider(false)}
                  className="text-[var(--text-4)] hover:text-[var(--text-1)]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label style={{ color: "var(--text-3)" }} className="text-[11px] font-medium block mb-1">
                    Provider Name
                  </label>
                  <input
                    type="text"
                    value={newProvider.name}
                    onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                    className="glass-input w-full text-[13px]"
                    placeholder="openai, anthropic, custom..."
                  />
                </div>
                <div>
                  <label style={{ color: "var(--text-3)" }} className="text-[11px] font-medium block mb-1">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={newProvider.baseUrl}
                    onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
                    className="glass-input w-full text-[13px]"
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div>
                  <label style={{ color: "var(--text-3)" }} className="text-[11px] font-medium block mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={newProvider.apiKey}
                    onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                    className="glass-input w-full text-[13px]"
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label style={{ color: "var(--text-3)" }} className="text-[11px] font-medium block mb-1">
                    API Type
                  </label>
                  <select
                    value={newProvider.apiType}
                    onChange={(e) =>
                      setNewProvider({ ...newProvider, apiType: e.target.value as ProviderApiType })
                    }
                    className="glass-input w-full text-[13px]"
                  >
                    {apiTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={handleAddProvider} className="btn-accent text-[12px] py-2 px-4">
                  Add Provider
                </button>
              </div>
            </div>
          )}

          {/* Providers List */}
          <div className="space-y-3">
            {allProviders.length === 0 ? (
              <p style={{ color: "var(--text-4)" }} className="text-[13px] text-center py-4">
                No providers configured. Click "Add Provider" to get started.
              </p>
            ) : (
              allProviders.map((provider) => (
                <ProviderCard
                  key={provider.provider}
                  provider={provider}
                  isActive={
                    selectedProvider === provider.provider &&
                    selectedModel !== null
                  }
                  onSelect={() => {
                    if (provider.models?.length > 0) {
                      selectModelProvider(provider.provider, provider.models[0].id)
                    }
                  }}
                  onConfigure={() => setConfiguringProvider(provider.provider)}
                />
              ))
            )}
          </div>
        </div>

        {/* Quick Presets */}
        <div className="glass-card-static p-5">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))",
                color: "#8b5cf6",
              }}
            >
              <Zap size={16} />
            </div>
            <div>
              <p style={{ color: "var(--text-1)" }} className="text-[13px] font-medium">
                Quick Setup
              </p>
              <p style={{ color: "var(--text-4)" }} className="text-[12px] mt-0.5">
                Popular providers with default settings
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {apiTypes.map((preset) => {
              const exists = providers.some(
                (p) => p.provider === preset.label.toLowerCase()
              )
              return (
                <button
                  key={preset.value}
                  onClick={() => {
                    if (exists) return
                    const provider: ModelProvider = {
                      provider: preset.label.toLowerCase(),
                      api_type: preset.value,
                      base_url:
                        preset.value === "ollama"
                          ? "http://localhost:11434/v1"
                          : undefined,
                      models: [],
                      settings: [],
                    }
                    setProviders([...providers, provider])
                  }}
                  disabled={exists}
                  className="p-3 rounded-lg text-left transition-all"
                  style={{
                    background: exists ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${exists ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)"}`,
                    opacity: exists ? 0.5 : 1,
                    cursor: exists ? "default" : "pointer",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: preset.color }} />
                    <span style={{ color: "var(--text-1)" }} className="text-[12px] font-medium">
                      {preset.label}
                    </span>
                  </div>
                  <p style={{ color: "var(--text-4)" }} className="text-[10px]">
                    {exists ? "Already added" : "Click to add"}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

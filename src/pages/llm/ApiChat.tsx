import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Plus,
  Trash2,
  Send,
  MessageSquare,
  Bot,
  User,
  X,
  Check,
  Loader2,
  ArrowRight,
  Globe,
} from "lucide-react";
import type {
  ApiProviderPreset,
  ApiProviderConfig,
  ApiProvidersConfig,
  ApiChatMessage,
  ApiChatSession,
  ApiChatRequest,
} from "./types";

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

type View = "select" | "chat";

export default function ApiChat() {
  const [presets, setPresets] = useState<ApiProviderPreset[]>([]);
  const [config, setConfig] = useState<ApiProvidersConfig>({ providers: [] });
  const [view, setView] = useState<View>("select");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ApiChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find((s) => s.id === activeSession);
  const selectedProvider = config.providers.find((p) => p.id === selectedProviderId);

  useEffect(() => {
    invoke<ApiProviderPreset[]>("llm_get_provider_presets").then(setPresets).catch(() => {});
    invoke<ApiProvidersConfig>("llm_get_api_providers").then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages]);

  const handleStartChat = (providerId: string) => {
    setSelectedProviderId(providerId);
    setView("chat");
  };

  const handleBackToSelect = () => {
    setView("select");
    setSelectedProviderId(null);
    setActiveSession(null);
  };

  const createSession = () => {
    if (!selectedProvider) return;
    const session: ApiChatSession = {
      id: uid(),
      title: "New Chat",
      provider_id: selectedProvider.id,
      model: selectedProvider.selected_model,
      messages: [],
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session.id);
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession === id) setActiveSession(sessions[1]?.id ?? null);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending || !activeSession || !selectedProvider) return;
    const userMsg: ApiChatMessage = { role: "user", content: input.trim(), timestamp: Date.now() };
    setInput("");

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession
          ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length === 0 ? userMsg.content.slice(0, 40) : s.title, updated_at: Date.now() }
          : s
      )
    );

    setSending(true);
    try {
      const session = sessions.find((s) => s.id === activeSession);
      const allMessages = session ? [...session.messages, userMsg] : [userMsg];
      const req: ApiChatRequest = {
        provider_id: selectedProvider.id,
        model: selectedProvider.selected_model,
        messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 4096,
      };
      const res = await invoke<{ content: string; model: string; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }; finish_reason: string }>("llm_send_api_chat", { req });
      const assistantMsg: ApiChatMessage = { role: "assistant", content: res.content, timestamp: Date.now() };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession
            ? { ...s, messages: [...s.messages, assistantMsg], updated_at: Date.now() }
            : s
        )
      );
    } catch (e) {
      const errMsg: ApiChatMessage = { role: "assistant", content: `Error: ${String(e)}`, timestamp: Date.now() };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession ? { ...s, messages: [...s.messages, errMsg] } : s
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const saveProvider = async (provider: ApiProviderConfig) => {
    await invoke("llm_save_api_provider", { provider });
    const updated = await invoke<ApiProvidersConfig>("llm_get_api_providers");
    setConfig(updated);
  };

  // ═══ VIEW: SELECT PROVIDER ═══════════════════════════════════════════════
  if (view === "select") {
    return (
      <div className="flex-1 flex flex-col min-h-0 h-full relative page-enter">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: "var(--bg-2)" }}>
                <Globe size={32} className="text-primary opacity-60" />
              </div>
              <h2 className="text-lg font-semibold text-hero">API Chat</h2>
              <p className="text-sm text-hint max-w-md mx-auto">
                Select a registered API provider to start chatting, or register a new one.
              </p>
            </div>

            {/* Provider List */}
            {config.providers.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-hint uppercase tracking-wider">Registered Providers</p>
                {config.providers.map((p) => {
                  const preset = presets.find((pr) => pr.id === p.provider_id);
                  return (
                    <div
                      key={p.id}
                      className="group flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all hover:bg-white/5 cursor-pointer"
                      style={{ background: "var(--bg-2)", border: "1px solid var(--border-1)" }}
                      onClick={() => handleStartChat(p.id)}
                    >
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ background: preset?.icon_color || "#888" }}
                      >
                        {p.name[0]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-hero">{p.name}</p>
                        <p className="text-[11px] text-hint truncate">{p.selected_model}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.api_key ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                          {p.api_key ? "Key set" : "No key"}
                        </span>
                        <ArrowRight size={14} className="text-hint opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center" style={{ background: "var(--bg-2)", border: "1px dashed var(--border-1)" }}>
                  <Plus size={20} className="text-hint" />
                </div>
                <div>
                  <p className="text-sm text-hero">No API providers registered</p>
                  <p className="text-xs text-hint mt-1">Register a provider to start chatting with cloud AI</p>
                </div>
              </div>
            )}

            {/* Register New Button */}
            <div className="flex justify-center">
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: "var(--primary)", color: "white" }}
                onClick={() => setShowSettings(true)}
              >
                <Plus size={15} /> Register New API
              </button>
            </div>
          </div>
        </div>

        {/* Registration Modal */}
        {showSettings && (
          <ProviderRegisterModal
            presets={presets}
            existingIds={config.providers.map((p) => p.provider_id)}
            onSave={async (provider) => {
              await saveProvider(provider);
              setShowSettings(false);
            }}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    );
  }

  // ═══ VIEW: CHAT ═══════════════════════════════════════════════════════════
  if (!selectedProvider) {
    setView("select");
    return null;
  }

  const preset = presets.find((p) => p.id === selectedProvider.provider_id);

  return (
    <div className="flex-1 flex min-h-0 h-full relative">
      {/* Sidebar */}
      {sidebarOpen && (
        <div
          className="relative z-10 flex flex-col shrink-0"
          style={{ width: 260, borderRight: "1px solid var(--border-1)", background: "var(--bg-0)" }}
        >
          <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid var(--border-1)" }}>
            <span className="text-xs font-semibold uppercase tracking-wider text-hint">Sessions</span>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" onClick={createSession} title="New chat">
                <Plus size={14} className="text-hint" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" onClick={handleBackToSelect} title="Back">
                <X size={14} className="text-hint" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {sessions.length === 0 ? (
              <p className="px-3 py-4 text-xs text-hint text-center">No conversations yet</p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-2 px-3 py-2 mx-1.5 rounded-lg cursor-pointer transition-colors ${
                    activeSession === s.id ? "bg-primary/10" : "hover:bg-white/5"
                  }`}
                  onClick={() => setActiveSession(s.id)}
                >
                  <MessageSquare size={13} className="text-hint shrink-0" />
                  <span className="flex-1 truncate text-xs">{s.title}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  >
                    <Trash2 size={11} className="text-hint" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div
          className="relative z-10 flex items-center justify-between px-4 py-2 shrink-0"
          style={{ borderBottom: "1px solid var(--border-1)" }}
        >
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" onClick={() => setSidebarOpen(true)}>
                <MessageSquare size={14} className="text-hint" />
              </button>
            )}
            <button className="flex items-center gap-1 text-hint hover:text-hero transition-colors" onClick={handleBackToSelect}>
              <X size={12} />
              <span className="text-[10px]">Back</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: preset?.icon_color || "#888" }} />
              <span className="text-xs font-medium text-hero">{selectedProvider.name}</span>
              <span className="text-hint">/</span>
              <span className="text-xs text-hint">{selectedProvider.selected_model}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!currentSession || currentSession.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-2)" }}>
                <Bot size={28} className="text-hint opacity-50" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-hero">Hello there</p>
                <p className="text-sm text-hint mt-1">Type a message to start chatting with {selectedProvider.name}</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {currentSession.messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "var(--bg-2)" }}>
                      <Bot size={14} className="text-hint" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user" ? "bg-primary/15 text-hero" : "text-hero"
                    }`}
                    style={msg.role === "assistant" ? { background: "var(--bg-2)" } : undefined}
                  >
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "var(--primary)", opacity: 0.15 }}>
                      <User size={14} className="text-primary" />
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--bg-2)" }}>
                    <Loader2 size={14} className="text-hint animate-spin" />
                  </div>
                  <div className="rounded-2xl px-4 py-2.5 text-sm" style={{ background: "var(--bg-2)" }}>
                    <span className="text-hint animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="relative z-10 px-4 py-3 shrink-0">
          <div
            className="max-w-3xl mx-auto flex items-end gap-2 rounded-2xl px-4 py-2"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border-1)" }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-hero placeholder:text-hint resize-none outline-none max-h-32 py-1"
              style={{ minHeight: 24 }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="p-2 rounded-xl transition-all disabled:opacity-30"
              style={{ background: input.trim() ? "var(--primary)" : "transparent" }}
            >
              <Send size={14} className={input.trim() ? "text-white" : "text-hint"} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ Provider Register Modal ═════════════════════════════════════════════════
function ProviderRegisterModal({
  presets,
  existingIds,
  onSave,
  onClose,
}: {
  presets: ApiProviderPreset[];
  existingIds: string[];
  onSave: (p: ApiProviderConfig) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"select" | "configure">("select");
  const [selectedPreset, setSelectedPreset] = useState<ApiProviderPreset | null>(null);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [customModels, setCustomModels] = useState("");

  const handleSelectPreset = (preset: ApiProviderPreset) => {
    setSelectedPreset(preset);
    setName(preset.name);
    setBaseUrl(preset.base_url);
    setModel(preset.default_models[0] || "");
    setStep("configure");
  };

  const handleSave = () => {
    if (!selectedPreset || !apiKey.trim()) return;
    const modelList = selectedPreset.id === "custom"
      ? customModels.split(",").map((m) => m.trim()).filter(Boolean)
      : selectedPreset.default_models;
    const finalModel = model || modelList[0] || "";

    const provider: ApiProviderConfig = {
      id: uid(),
      provider_id: selectedPreset.id,
      name,
      base_url: baseUrl,
      api_key: apiKey.trim(),
      selected_model: finalModel,
      created_at: Date.now(),
      is_active: true,
    };
    onSave(provider);
  };

  if (step === "configure" && selectedPreset) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div
          className="w-full max-w-lg rounded-2xl overflow-hidden"
          style={{ background: "var(--bg-1)", border: "1px solid var(--border-1)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--border-1)" }}>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: selectedPreset.icon_color }}>
                {name[0]}
              </span>
              <p className="text-sm font-semibold text-hero">Register {selectedPreset.name}</p>
            </div>
            <button className="p-1 rounded-lg hover:bg-white/5" onClick={onClose}>
              <X size={14} className="text-hint" />
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="text-[10px] font-medium text-hint uppercase tracking-wider mb-1 block">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs bg-transparent text-hero outline-none" style={{ border: "1px solid var(--border-1)" }} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-hint uppercase tracking-wider mb-1 block">Base URL</label>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs bg-transparent text-hero outline-none font-mono" style={{ border: "1px solid var(--border-1)" }} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-hint uppercase tracking-wider mb-1 block">API Key *</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={selectedPreset.key_placeholder} className="w-full px-3 py-2 rounded-lg text-xs bg-transparent text-hero outline-none font-mono" style={{ border: "1px solid var(--border-1)" }} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-hint uppercase tracking-wider mb-1 block">Model</label>
              {selectedPreset.default_models.length > 0 && selectedPreset.id !== "custom" ? (
                <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs bg-transparent text-hero outline-none" style={{ border: "1px solid var(--border-1)" }}>
                  {selectedPreset.default_models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input value={customModels} onChange={(e) => setCustomModels(e.target.value)} placeholder="model1, model2, ..." className="w-full px-3 py-2 rounded-lg text-xs bg-transparent text-hero outline-none" style={{ border: "1px solid var(--border-1)" }} />
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--border-1)" }}>
            <button className="btn-glass !px-3 !py-1.5 !text-[11px]" onClick={() => setStep("select")}>Back</button>
            <button
              className="btn-accent !px-3 !py-1.5 !text-[11px]"
              onClick={handleSave}
              disabled={!apiKey.trim()}
            >
              <Check size={12} /> Register
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-1)", border: "1px solid var(--border-1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--border-1)" }}>
          <p className="text-sm font-semibold text-hero">Select API Provider</p>
          <button className="p-1 rounded-lg hover:bg-white/5" onClick={onClose}><X size={14} className="text-hint" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {presets.filter((p) => p.id !== "custom").map((preset) => (
            <button
              key={preset.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
              onClick={() => handleSelectPreset(preset)}
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: preset.icon_color }}>
                {preset.name[0]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-hero">{preset.name}</p>
                <p className="text-[10px] text-hint truncate">{preset.base_url}</p>
              </div>
              {existingIds.includes(preset.id) && <Check size={14} className="text-green-400 shrink-0" />}
            </button>
          ))}
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
            onClick={() => handleSelectPreset(presets.find((p) => p.id === "custom")!)}
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#888" }}>+</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-hero">Custom Provider</p>
              <p className="text-[10px] text-hint">Any OpenAI-compatible API</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
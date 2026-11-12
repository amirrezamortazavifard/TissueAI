import { useEffect, useState, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useNavigate } from "react-router-dom";
import {
  Cpu,
  MemoryStick,
  Monitor,
  Zap,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Play,
  Square,
  Trash2,
  CheckCircle,
  Eye,
  Download,
  RefreshCw,
  FolderOpen,
  Package,
  Archive,
  Terminal,
  ExternalLink,
  Save,
} from "lucide-react";
import type {
  SystemInfo,
  RuntimeInfo,
  ModelInfo,
  ServerStatus,
  ServerConfig,
  AppConfig,
  ReleaseInfo,
  BackendInfo,
  CustomBuild,
  ScanResult,
  DownloadProgress,
  ApiProviderPreset,
  ApiProviderConfig,
  ApiProvidersConfig,
} from "../types";
import {
  mbToGb,
  shortCpuName,
  shortGpuName,
} from "../format";


function Slider({ label, hint, value, min, max, step, onChange, format }: {
  label: string; hint?: string; value: number;
  min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <label className="text-xs font-medium" style={{ color: "var(--text-3)" }}>{label}</label>
        <span className="text-xs font-mono" style={{ color: "rgba(91,168,245,0.9)" }}>{format ? format(value) : value}</span>
      </div>
      {hint && <p className="text-xs mb-2 text-hint">{hint}</p>}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </div>
  );
}

function NumberInput({ label, hint, value, min, max, step = 1, onChange }: {
  label: string; hint?: string; value: number | null;
  min?: number; max?: number; step?: number;
  onChange: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) {
      setDraft(value != null ? String(value) : "");
    }
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDraft(raw);
    if (raw === "") {
      onChange(null);
    } else {
      const n = parseFloat(raw);
      if (!isNaN(n)) onChange(n);
    }
  }, [onChange]);

  const handleBlur = useCallback(() => {
    editing.current = false;
    if (draft === "" || isNaN(parseFloat(draft))) {
      setDraft(value != null ? String(value) : "");
    }
  }, [draft, value]);

  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-3)" }}>{label}</label>
      {hint && <p className="text-xs mb-1 text-hint">{hint}</p>}
      <input type="number" className="glass-input" value={draft} min={min} max={max} step={step}
        onFocus={() => { editing.current = true; }}
        onChange={handleChange}
        onBlur={handleBlur} />
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className="toggle-track mt-0.5"
        data-state={checked ? "on" : "off"}>
        <span className="toggle-thumb" />
      </button>
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--text-2)" }}>{label}</p>
        {hint && <p className="text-xs text-hint">{hint}</p>}
      </div>
    </div>
  );
}

function TextInput({ label, hint, value, placeholder, onChange }: {
  label: string; hint?: string; value: string; placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-3)" }}>{label}</label>
      {hint && <p className="text-xs mb-1 text-hint">{hint}</p>}
      <input type="text" className="glass-input" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectInput({ label, hint, value, options, onChange }: {
  label: string; hint?: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-3)" }}>{label}</label>
      {hint && <p className="text-xs mb-1 text-hint">{hint}</p>}
      <select className="glass-input cursor-pointer" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value} style={{ background: "var(--surface)" }}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <p className="section-label mt-5 first:mt-0">{title}</p>
  );
}

const KV_TYPES = ["f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "iq4_nl", "q5_0", "q5_1"] as const;

type StepStatus = "pending" | "active" | "success" | "failed";

interface FallbackStep {
  level: number;
  total: number;
  desc: string;
  status: StepStatus;
}

function FallbackProgress({ steps, total }: { steps: FallbackStep[]; total: number }) {
  if (total <= 1 || steps.length === 0) return null;

  return (
    <div className="glass-card-static p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="section-label !mb-0">Startup Progress</span>
        <span className="text-[10px] text-hint">
          {steps.filter((s) => s.status === "success").length}/{total} succeeded
        </span>
      </div>

      <div className="relative flex items-center justify-between px-2">
        <div className="absolute top-1/2 left-4 right-4 h-0.5 -translate-y-1/2" style={{ background: "var(--border-2)" }} />
        {steps.length > 1 && (
          <div
            className="absolute top-1/2 left-4 h-0.5 -translate-y-1/2 transition-all duration-500"
            style={{
              width: `${((Math.min(steps.length, total) - 1) / (total - 1)) * 100}%`,
              maxWidth: "calc(100% - 2rem)",
              background:
                steps.some((s) => s.status === "success")
                  ? "linear-gradient(90deg, #22c55e, #22c55e)"
                  : steps.some((s) => s.status === "failed")
                    ? "linear-gradient(90deg, #ef4444, #f59e0b)"
                    : "linear-gradient(90deg, #3b82f6, #3b82f6)",
            }}
          />
        )}

        {Array.from({ length: total }, (_, i) => {
          const step = steps.find((s) => s.level === i + 1);
          const status: StepStatus = step?.status ?? (i + 1 <= steps.length ? "failed" : "pending");

          return (
            <div key={i} className="relative z-10 flex flex-col items-center gap-1.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300 ${
                  status === "success"
                    ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                    : status === "failed"
                      ? "bg-red-500 border-red-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                      : status === "active"
                        ? "bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse"
                        : ""
                }`}
                style={status === "pending" ? { background: "var(--bg-1)", borderColor: "var(--border-3)", color: "var(--text-5)" } : undefined}
              >
                {status === "success" ? "\u2713" : status === "failed" ? "\u2717" : i + 1}
              </div>
              <span
                className={`text-[9px] font-medium whitespace-nowrap ${
                  status === "success"
                    ? "text-emerald-400"
                    : status === "failed"
                      ? "text-red-400"
                      : status === "active"
                        ? "text-blue-400"
                        : ""
                }`}
                style={status === "pending" ? { color: "var(--text-4)" } : undefined}
              >
                {status === "active" ? step?.desc ?? `Level ${i + 1}` : status === "success" ? "OK" : status === "failed" ? "Failed" : `Level ${i + 1}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProviderEditModal({
  provider,
  presets,
  onSave,
  onTest,
  testResult,
  testing,
  onClose,
}: {
  provider: ApiProviderConfig;
  presets: ApiProviderPreset[];
  onSave: (p: ApiProviderConfig) => void;
  onTest: (p: ApiProviderConfig) => void;
  testResult: string | null;
  testing: boolean;
  onClose: () => void;
}) {
  const preset = presets.find((p) => p.id === provider.provider_id);
  const isCustom = provider.provider_id === "custom";
  const [name, setName] = useState(provider.name);
  const [baseUrl, setBaseUrl] = useState(provider.base_url);
  const [apiKey, setApiKey] = useState(provider.api_key);
  const [model, setModel] = useState(provider.selected_model);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-1)", border: "1px solid var(--border-1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--border-1)" }}>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: preset?.icon_color || "#888" }}>
              {name[0] || "?"}
            </span>
            <p className="text-sm font-semibold text-hero">{isCustom ? "Custom Provider" : preset?.name || "Provider"}</p>
          </div>
          <button className="p-1 rounded-lg hover:bg-white/5" onClick={onClose}>
            <span className="text-hint text-lg">&times;</span>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-hint uppercase tracking-wider mb-1 block">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs bg-transparent text-hero outline-none" style={{ border: "1px solid var(--border-1)" }} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-hint uppercase tracking-wider mb-1 block">Model</label>
              {preset && preset.default_models.length > 0 && !isCustom ? (
                <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs bg-transparent text-hero outline-none" style={{ border: "1px solid var(--border-1)" }}>
                  {preset.default_models.map((m) => <option key={m} value={m}>{m}</option>)}
                  {!preset.default_models.includes(model) && <option value={model}>{model}</option>}
                </select>
              ) : (
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o" className="w-full px-3 py-2 rounded-lg text-xs bg-transparent text-hero outline-none" style={{ border: "1px solid var(--border-1)" }} />
              )}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-hint uppercase tracking-wider mb-1 block">Base URL</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="w-full px-3 py-2 rounded-lg text-xs bg-transparent text-hero outline-none font-mono" style={{ border: "1px solid var(--border-1)" }} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-hint uppercase tracking-wider mb-1 block">API Key</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={preset?.key_placeholder || "your-api-key"} className="w-full px-3 py-2 rounded-lg text-xs bg-transparent text-hero outline-none font-mono" style={{ border: "1px solid var(--border-1)" }} />
          </div>
          {testResult && (
            <p className={`text-[11px] ${testResult.startsWith("OK") ? "text-green-400" : "text-red-400"}`}>{testResult}</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--border-1)" }}>
          <button className="btn-glass !px-3 !py-1.5 !text-[11px]" onClick={() => onTest({ ...provider, name, base_url: baseUrl, api_key: apiKey, selected_model: model })} disabled={testing || !apiKey}>
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button className="btn-accent !px-3 !py-1.5 !text-[11px]" onClick={() => onSave({ ...provider, name, base_url: baseUrl, api_key: apiKey, selected_model: model })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}


const DEFAULT_CONFIG: ServerConfig = {
  model_path: "",
  mmproj_path: null,
  host: "127.0.0.1",
  port: 8080,
  n_ctx: 0,
  n_gpu_layers: -1,
  n_threads: null,
  flash_attn: "auto",
  cache_type_k: "f16",
  cache_type_v: "f16",
  temperature: 0.8,
  top_k: 40,
  min_p: 0.05,
  top_p: 0.95,
  n_predict: -1,
  n_batch: 2048,
  n_ubatch: 512,
  cont_batching: true,
  mlock: false,
  no_mmap: false,
  seed: null,
  rope_freq_scale: null,
  rope_freq_base: null,
  grp_attn_n: null,
  grp_attn_w: null,
  parallel: 1,
  no_mmproj_offload: false,
  extra_params: {},
};

const SESSION_CONFIG_KEY = "llm_server_config";
const SESSION_PRESET_KEY = "llm_server_preset";
const SESSION_TAB_KEY = "llm_server_tab";
const SESSION_STATUS_KEY = "llm_server_status";

const REMOVED_EP_KEYS = ["spec-ngram-size-n", "spec-ngram-size-m", "spec-ngram-min-hits"] as const;
const RENAMED_EP_KEYS: Record<string, string> = {
  "draft": "spec-draft-n-max",
  "draft-max": "spec-draft-n-max",
  "draft-n-max": "spec-draft-n-max",
  "draft-min": "spec-draft-n-min",
  "draft-n-min": "spec-draft-n-min",
  "model-draft": "spec-draft-model",
  "ctx-size-draft": "spec-draft-ctx-size",
  "n-gpu-layers-draft": "spec-draft-ngl",
  "gpu-layers-draft": "spec-draft-ngl",
  "device-draft": "spec-draft-device",
  "threads-draft": "spec-draft-threads",
  "threads-batch-draft": "spec-draft-threads-batch",
  "cpu-moe-draft": "spec-draft-cpu-moe",
  "draft-cpu-moe": "spec-draft-cpu-moe",
  "n-cpu-moe-draft": "spec-draft-n-cpu-moe",
  "override-tensor-draft": "spec-draft-override-tensor",
  "draft-p-min": "spec-draft-p-min",
  "draft-p-split": "spec-draft-p-split",
  "hf-repo-draft": "spec-draft-hf",
  "cache-type-k-draft": "spec-draft-type-k",
  "cache-type-v-draft": "spec-draft-type-v",
};

export function migrateExtraParams(extra: Record<string, string>): Record<string, string> {
  const out = { ...extra };
  for (const k of REMOVED_EP_KEYS) delete out[k];
  for (const [oldKey, newKey] of Object.entries(RENAMED_EP_KEYS)) {
    if (oldKey in out && !(newKey in out)) {
      out[newKey] = out[oldKey];
    }
    delete out[oldKey];
  }
  return out;
}

function loadSessionConfig(): ServerConfig | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CONFIG_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as ServerConfig;
    if (cfg.extra_params) cfg.extra_params = migrateExtraParams(cfg.extra_params);
    return cfg;
  } catch { return null; }
}

function loadSessionStatus(): ServerStatus {
  try {
    const raw = sessionStorage.getItem(SESSION_STATUS_KEY);
    return raw ? JSON.parse(raw) : { type: "stopped" };
  } catch { return { type: "stopped" }; }
}

const TABS = ["Context", "Hardware", "Sampling", "Server", "Chat", "Advanced"] as const;
type Tab = (typeof TABS)[number];

interface LocalTabProps {}

export default function LocalTab(_props: LocalTabProps) {
  const navigate = useNavigate();

  // Shared State
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus>({ type: "stopped" });
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lanIp, setLanIp] = useState<string | null>(null);

  // Dashboard State
  const [launching, setLaunching] = useState(false);
  const [stopping, setStopping] = useState(false);

  // Runtime State
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [backends, setBackends] = useState<BackendInfo[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [customBuilds, setCustomBuilds] = useState<CustomBuild[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<DownloadProgress | null>(null);

  // Server State
  const [config, setConfigRaw] = useState<ServerConfig>(() => loadSessionConfig() ?? DEFAULT_CONFIG);
  const [status, setStatusRaw] = useState<ServerStatus>(loadSessionStatus);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTabRaw] = useState<Tab>(() => {
    const saved = sessionStorage.getItem(SESSION_TAB_KEY);
    return saved && TABS.includes(saved as Tab) ? (saved as Tab) : "Context";
  });
  const [showLogs, setShowLogs] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [showModelList, setShowModelList] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);
  const pendingLogs = useRef<string[]>([]);
  const logRaf = useRef<number | null>(null);
  const [presets, setPresets] = useState<string[]>([]);
  const [activePreset, setActivePresetRaw] = useState<string | null>(() => {
    return sessionStorage.getItem(SESSION_PRESET_KEY) || null;
  });
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [fallbackSteps, setFallbackSteps] = useState<FallbackStep[]>([]);
  const fallbackTotal = useRef(0);
  const [webRunning, setWebRunning] = useState(false);
  const [webPort, setWebPort] = useState(8080);
  const [apiProviders, setApiProviders] = useState<ApiProvidersConfig>({ providers: [] });
  const [apiPresets, setApiPresets] = useState<ApiProviderPreset[]>([]);
  const [editingProvider, setEditingProvider] = useState<ApiProviderConfig | null>(null);
  const [providerTestResult, setProviderTestResult] = useState<string | null>(null);
  const [providerTesting, setProviderTesting] = useState(false);

  // Derived (Dashboard)
  const selectedModel = models.find((m) => m.path === appConfig?.selected_model);
  const launchModel = selectedModel ?? models[0];
  const isDashboardRunning = serverStatus.type === "running" || serverStatus.type === "starting";
  const totalVram = system?.gpus.reduce((s, g) => s + g.vram_mb, 0) ?? 0;
  const totalUsable = totalVram > 0 ? totalVram + (system?.available_ram_mb ?? 0) : system?.available_ram_mb ?? 0;
  const sizeAdvice = (() => {
    const gb = totalUsable / 1024;
    if (gb >= 40) return "70B+ models";
    if (gb >= 16) return "13B\u201330B models";
    if (gb >= 8) return "7B\u201313B models";
    if (gb >= 4) return "3B\u20137B models";
    return "1B\u20133B models";
  })();

  // Derived (Runtime)
  const managed = appConfig?.managed_runtimes ?? [];
  const custom = appConfig?.custom_runtimes ?? [];
  const activeType = appConfig?.active_runtime?.type ?? "none";
  const activeBuild = activeType === "managed" ? (appConfig?.active_runtime as { build: number; backend_id: string }).build : null;
  const activeBackendId = activeType === "managed" ? (appConfig?.active_runtime as { build: number; backend_id: string }).backend_id : null;
  const activeCustomIdx = activeType === "custom" ? (appConfig?.active_runtime as { index: number }).index : null;
  const latestBuild = release?.build;
  const updateAvailable = activeBuild != null && latestBuild != null && latestBuild > activeBuild;
  const archivedMr = latestBuild != null ? managed.filter((r) => r.build < latestBuild) : [];
  const currentMr = managed.filter((r) => !archivedMr.includes(r));

  // Derived (Server)
  const isServerRunning = status.type === "running" || status.type === "starting";

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════

  const loadData = async () => {
    const [sys, rt, mdls, srv, cfg, ip] = await Promise.all([
      invoke<SystemInfo>("llm_get_system_info").catch(() => null),
      invoke<RuntimeInfo>("llm_get_runtime_info").catch(() => null),
      invoke<ModelInfo[]>("llm_list_installed_models").catch(() => []),
      invoke<ServerStatus>("llm_get_server_status").catch(() => ({ type: "stopped" as const })),
      invoke<AppConfig>("llm_get_config").catch(() => null),
      invoke<string>("llm_get_lan_ip").catch(() => null),
    ]);
    setSystem(sys);
    setRuntime(rt);
    setModels(mdls);
    setServerStatus(srv);
    setAppConfig(cfg);
    setLanIp(ip);
    if (cfg) setFavorites(cfg.favorite_models);
    setLoading(false);
  };

  const loadRuntimeData = async () => {
    try {
      const [bk, cfg] = await Promise.all([
        invoke<BackendInfo[]>("llm_get_available_backends"),
        invoke<AppConfig>("llm_get_config"),
      ]);
      setBackends(bk);
      if (cfg) { setAppConfig(cfg); setFavorites(cfg.favorite_models); }
    } catch (e) { setError(String(e)); }
  };

  const loadServerData = async () => {
    const [mdls, srv, cfg] = await Promise.all([
      invoke<ModelInfo[]>("llm_list_installed_models").catch(() => []),
      invoke<ServerStatus>("llm_get_server_status").catch(() => ({ type: "stopped" as const })),
      invoke<{ favorite_models: string[]; selected_model: string | null; model_presets: Record<string, string> }>(
        "get_config"
      ).catch(() => ({ favorite_models: [] as string[], selected_model: null, model_presets: {} as Record<string, string> })),
    ]);
    setFavorites(cfg.favorite_models);
    setModels(mdls);
    setStatus(srv);
    if (mdls.length > 0 && !config.model_path) {
      const selected = cfg.selected_model ? mdls.find((m) => m.path === cfg.selected_model) : null;
      const pick = selected ?? mdls[0];
      setConfigRaw((c) => ({
        ...c,
        model_path: pick.path,
        mmproj_path: pick.is_vision && pick.mmproj_path ? pick.mmproj_path : null,
      }));
      if (!loadSessionConfig()) {
        const savedPreset = cfg.model_presets[pick.path];
        if (savedPreset) await loadPreset(savedPreset, pick.path);
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    loadData().then(() => { loadRuntimeData().then(() => checkUpdate()); });
    loadServerData();
    refreshPresets();
    if (!loadSessionConfig()) loadDefaults();
    invoke<string[]>("llm_get_server_logs").then((existing) => {
      if (existing.length > 0) { setLogs(existing); setShowLogs(true); }
    }).catch(() => {});
    invoke<string>("llm_get_lan_ip").then(setLanIp).catch(() => {});
    invoke<{ running: boolean; port: number | null }>("llm_get_web_server_status").then((ws) => {
      setWebRunning(ws.running);
      if (ws.port) setWebPort(ws.port);
    }).catch(() => {});
    invoke<ApiProvidersConfig>("llm_get_api_providers").then(setApiProviders).catch(() => {});
    invoke<ApiProviderPreset[]>("llm_get_provider_presets").then(setApiPresets).catch(() => {});
    const unlistenLog = listen<string>("server_log", (e) => { addLog(e.payload); });
    const interval = setInterval(async () => {
      try {
        const s = await invoke<ServerStatus>("llm_get_server_status");
        setServerStatus(s);
        setStatusRaw(s);
      } catch {}
    }, 2000);
    return () => {
      unlistenLog.then((f) => f());
      clearInterval(interval);
      if (logRaf.current !== null) cancelAnimationFrame(logRaf.current);
    };
  }, []);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS \u2014 Dashboard
  // ═══════════════════════════════════════════════════════════════

  const quickLaunch = async () => {
    if (!launchModel || !runtime?.installed) return;
    setLaunching(true);
    setError(null);
    try {
      const suggested = await invoke<ServerConfig>("llm_suggest_server_config", {
        modelPath: launchModel.path,
        modelSizeMb: Math.round(launchModel.size_bytes / (1024 * 1024)),
      });
      let cfg = suggested;
      try {
        const defaults = await invoke<ServerConfig>("llm_load_server_preset", { name: "__default__" });
        cfg = { ...suggested, ...defaults, model_path: suggested.model_path, mmproj_path: suggested.mmproj_path };
      } catch {}
      await invoke("llm_start_server", { config: cfg });
    } catch (e) { setError(String(e)); } finally { setLaunching(false); }
  };

  const quickStop = async () => {
    setStopping(true);
    try {
      await invoke("llm_stop_server");
      setServerStatus({ type: "stopped" });
    } catch (e) { setError(String(e)); } finally { setStopping(false); }
  };

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS — Runtime
  // ═══════════════════════════════════════════════════════════════
  // HANDLERS \u2014 Runtime
  // ═══════════════════════════════════════════════════════════════

  const checkUpdate = async () => {
    setError(null);
    try {
      const rel = await invoke<ReleaseInfo>("llm_check_latest_release");
      setRelease(rel);
    } catch (e) { setError(String(e)); }
  };

  const startUpdate = async () => {
    let rel = release;
    if (!rel) { try { rel = await invoke<ReleaseInfo>("llm_check_latest_release"); setRelease(rel); } catch (e) { setError(String(e)); return; } }
    const asset = rel.available_assets[0]?.name;
    if (!asset) { setError("No compatible assets found for this platform"); return; }
    setUpdating(true); setError(null);
    setUpdateProgress({ id: "runtime", bytes_downloaded: 0, total_bytes: 0, percent: 0, status: "downloading" });
    const unlisten = await listen<DownloadProgress>("download_progress", (e) => { setUpdateProgress(e.payload); });
    try {
      await invoke("llm_download_runtime", { assetName: asset });
      await loadData(); setUpdateProgress(null);
    } catch (e) { setError(String(e)); } finally { unlisten(); setUpdating(false); }
  };

  const browseCustom = async () => {
    const selected = await open({ directory: true, title: "Select llama.cpp directory" });
    if (!selected) return;
    flushSync(() => { setScanning(true); setError(null); });
    try {
      const result = await invoke<ScanResult>("llm_scan_custom_runtime", { path: selected });
      if (result.builds.length === 0) { setCustomBuilds(null); setError("No llama-server binary found in the selected directory."); }
      else if (result.is_source_distribution) { await invoke("llm_add_all_custom_runtime_binaries", { builds: result.builds }); setCustomBuilds(null); await loadData(); }
      else if (result.builds.length === 1) { await invoke("llm_set_custom_runtime_binary", { binaryPath: result.builds[0].binary_path }); setCustomBuilds(null); await loadData(); }
      else { setCustomBuilds(result.builds); }
    } catch (e) { setError(String(e)); } finally { setScanning(false); }
  };

  const selectBuild = async (build: CustomBuild) => {
    try { await invoke("llm_set_custom_runtime_binary", { binaryPath: build.binary_path }); await loadData(); } catch (e) { setError(String(e)); }
  };

  const activateManaged = async (build: number, backendId: string) => {
    try { await invoke("llm_set_active_runtime", { runtimeType: "managed", id: build, backendId }); await loadData(); } catch (e) { setError(String(e)); }
  };

  const activateCustom = async (index: number) => {
    try { await invoke("llm_set_active_runtime", { runtimeType: "custom", id: index }); await loadData(); } catch (e) { setError(String(e)); }
  };

  const deleteManaged = async (build: number, backendId: string) => {
    try { await invoke("llm_delete_managed_runtime", { build, backendId }); await loadData(); } catch (e) { setError(String(e)); }
  };

  const removeCustom = async (index: number) => {
    try { await invoke("llm_remove_custom_runtime", { index }); await loadData(); } catch (e) { setError(String(e)); }
  };

  const toggleAutoDelete = async (enabled: boolean) => {
    try { await invoke("llm_set_auto_delete_runtimes", { enabled }); await loadData(); } catch (e) { setError(String(e)); }
  };

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS \u2014 Server
  // ═══════════════════════════════════════════════════════════════

  const setConfig: typeof setConfigRaw = useCallback((v) => {
    setConfigRaw((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      sessionStorage.setItem(SESSION_CONFIG_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setActivePreset = useCallback((v: string | null) => {
    setActivePresetRaw(v);
    if (v) sessionStorage.setItem(SESSION_PRESET_KEY, v);
    else sessionStorage.removeItem(SESSION_PRESET_KEY);
  }, []);

  const setActiveTab = useCallback((v: Tab) => {
    setActiveTabRaw(v);
    sessionStorage.setItem(SESSION_TAB_KEY, v);
  }, []);

  const setStatus = useCallback((v: ServerStatus | ((prev: ServerStatus) => ServerStatus)) => {
    setStatusRaw((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      sessionStorage.setItem(SESSION_STATUS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const flushLogs = useCallback(() => {
    logRaf.current = null;
    const batch = pendingLogs.current;
    if (batch.length === 0) return;
    pendingLogs.current = [];
    setLogs((prev) => [...prev, ...batch].slice(-500));
  }, []);

  const addLog = useCallback((line: string) => {
    if (line.startsWith("[progress]")) {
      const parts = line.slice("[progress] ".length).split("|");
      if (parts.length >= 3) {
        const level = parseInt(parts[0], 10);
        const total = parseInt(parts[1], 10);
        const desc = parts[2];
        const rawResult = parts[3];
        const result = rawResult as StepStatus | undefined;
        fallbackTotal.current = total;
        if (rawResult === "exhausted") {
          setFallbackSteps((prev) => prev.map((s) => (s.status === "active" || s.status === "pending" ? { ...s, status: "failed" as const } : s)));
        } else if (level >= 1 && level <= total) {
          setFallbackSteps((prev) => {
            const next = [...prev];
            while (next.length < level) next.push({ level: next.length + 1, total, desc: "", status: "pending" });
            next[level - 1] = { level, total, desc, status: result ?? "active" };
            return next;
          });
        }
      }
      return;
    }
    pendingLogs.current.push(line);
    if (logRaf.current === null) logRaf.current = requestAnimationFrame(flushLogs);
  }, [flushLogs]);

  const getEp = (key: string): string => config.extra_params?.[key] ?? "";
  const getEpNum = (key: string): number | null => {
    const v = config.extra_params?.[key];
    if (v === undefined || v === "") return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };
  const setEp = (key: string, value: string) => {
    setConfig((c) => {
      const ep = { ...c.extra_params };
      if (value === "") delete ep[key]; else ep[key] = value;
      return { ...c, extra_params: ep };
    });
  };
  const setEpNum = (key: string, value: number | null) => { setEp(key, value !== null ? String(value) : ""); };
  const hasFlag = (key: string): boolean => key in (config.extra_params ?? {});
  const setFlag = (key: string, on: boolean) => {
    setConfig((c) => {
      const ep = { ...c.extra_params };
      if (on) ep[key] = ""; else delete ep[key];
      return { ...c, extra_params: ep };
    });
  };

  const refreshPresets = async () => { try { setPresets(await invoke<string[]>("llm_list_server_presets")); } catch {} };

  const savePreset = async (name: string) => {
    if (!name.trim()) return;
    try {
      const presetConfig = { ...config, model_path: "", mmproj_path: null };
      await invoke("llm_save_server_preset", { name: name.trim(), config: presetConfig });
      setActivePreset(name.trim()); setSaveName(""); await refreshPresets();
    } catch (e) { setError(String(e)); }
  };

  const loadPreset = async (name: string, modelPath?: string) => {
    try {
      const loaded = await invoke<ServerConfig>("llm_load_server_preset", { name });
      if (loaded.extra_params) loaded.extra_params = migrateExtraParams(loaded.extra_params);
      setConfig((prev) => ({ ...loaded, model_path: prev.model_path, mmproj_path: prev.mmproj_path }));
      setActivePreset(name); setShowPresetMenu(false);
      const pathToSave = modelPath ?? config.model_path;
      if (pathToSave) await invoke("llm_set_model_preset", { modelPath: pathToSave, presetName: name }).catch(() => {});
    } catch (e) { setError(String(e)); }
  };

  const deletePreset = async (name: string) => {
    try { await invoke("llm_delete_server_preset", { name }); if (activePreset === name) setActivePreset(null); await refreshPresets(); } catch (e) { setError(String(e)); }
  };

  const saveAsDefaults = async () => {
    try {
      const presetConfig = { ...config, model_path: "", mmproj_path: null };
      await invoke("llm_save_server_preset", { name: "__default__", config: presetConfig });
      setActivePreset(null); setShowPresetMenu(false);
    } catch (e) { setError(String(e)); }
  };

  const resetDefaults = async () => {
    try { await invoke("llm_delete_server_preset", { name: "__default__" }); } catch {}
    const modelPath = config.model_path; const mmproj = config.mmproj_path;
    setConfig({ ...DEFAULT_CONFIG, model_path: modelPath, mmproj_path: mmproj });
    setActivePreset(null); setShowPresetMenu(false);
  };

  const loadDefaults = async () => {
    try {
      const loaded = await invoke<ServerConfig>("llm_load_server_preset", { name: "__default__" });
      if (loaded.extra_params) loaded.extra_params = migrateExtraParams(loaded.extra_params);
      setConfig((prev) => ({ ...loaded, model_path: prev.model_path, mmproj_path: prev.mmproj_path }));
    } catch {}
  };

  const resetToDefault = () => { loadDefaults().then(() => { setActivePreset(null); setShowPresetMenu(false); }); };

  const openChat = async () => {
    if (status.type !== "running") return;
    setOpeningChat(true);
    try { await invoke("llm_open_chat_window", { port: status.port }); } catch (e) { setError(String(e)); } finally { setOpeningChat(false); }
  };

  const toggleWebServer = useCallback(async () => {
    try {
      if (webRunning) { await invoke("llm_stop_web_server"); setWebRunning(false); }
      else { const port = await invoke<number>("llm_start_web_server", { port: webPort }); setWebPort(port); setWebRunning(true); }
    } catch (e) { setError(String(e)); }
  }, [webRunning, webPort]);

  const applyModelConfig = async (modelPath: string) => {
    const model = models.find((m) => m.path === modelPath);
    if (!model) return;
    try {
      const suggested = await invoke<ServerConfig>("llm_suggest_server_config", {
        modelPath, modelSizeMb: Math.round(model.size_bytes / (1024 * 1024)),
      });
      setConfig((prev) => ({ ...prev, n_ctx: suggested.n_ctx, n_gpu_layers: suggested.n_gpu_layers }));
    } catch {}
  };

  const handleModelChange = async (m: ModelInfo) => {
    setConfig((c) => ({ ...c, model_path: m.path, mmproj_path: m.is_vision && m.mmproj_path ? m.mmproj_path : null }));
    try {
      const savedPreset = await invoke<string | null>("llm_get_model_preset", { modelPath: m.path });
      if (savedPreset) { await loadPreset(savedPreset, m.path); return; }
    } catch {}
    await applyModelConfig(m.path);
  };

  const startServer = async () => {
    if (!config.model_path) { setError("Please select a model."); return; }
    setError(null); setLogs([]); setShowLogs(true); setFallbackSteps([]);
    try {
      await invoke("llm_start_server", { config });
      if (activePreset && config.model_path) await invoke("llm_set_model_preset", { modelPath: config.model_path, presetName: activePreset }).catch(() => {});
    } catch (e) { setError(String(e)); }
  };

  const stopServer = async () => {
    try { await invoke("llm_stop_server"); setFallbackSteps([]); } catch (e) { setError(String(e)); }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-wrapper">
          <div className="loading-glow-ambient" />
          <div className="loading-ring">
            <svg viewBox="0 0 160 160">
              <defs>
                <filter id="loadingGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <circle className="loading-ring-track" cx="80" cy="80" r="70" />
              <circle className="loading-ring-glow loading-ring-glow-left" cx="80" cy="80" r="70" />
              <circle className="loading-ring-glow loading-ring-glow-right" cx="80" cy="80" r="70" />
            </svg>
            <div className="loading-center"><span className="loading-text">MyLLM</span></div>
          </div>
          <div className="loading-tail"><div className="loading-tail-left" /><div className="loading-tail-right" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto relative page-enter">
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8 space-y-6">

        {error && (
          <div className="glass-card-static p-4" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <p className="text-sm" style={{ color: "rgba(239,68,68,0.9)" }}>{error}</p>
          </div>
        )}

        {scanning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-lg">
            <div className="flex items-center gap-4 px-8 py-5 glass-panel">
              <RefreshCw size={18} className="text-primary animate-spin" />
              <span className="text-sm">Searching for server runtimes\u2026</span>
            </div>
          </div>
        )}

        {/* SECTION 1: Quick Launch Bar */}
        <div className="glass-card-static p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5 min-w-0">
              <div className="relative">
                <div className={`w-3 h-3 rounded-full transition-all duration-500 ${isDashboardRunning ? "shadow-glow" : ""}`}
                  style={{ background: isDashboardRunning ? "#22c55e" : serverStatus.type === "error" ? "#ef4444" : "var(--text-5)" }} />
                {isDashboardRunning && <div className="absolute inset-0 rounded-full bg-accent-green/30 animate-ping" />}
              </div>
              <div className="min-w-0">
                {isDashboardRunning ? (
                  <div>
                    <p className="text-sm font-medium text-hero">Server {" "}{serverStatus.type === "starting" ? "Starting" : "Running"}</p>
                    {serverStatus.type === "running" && (
                      <p className="text-xs font-mono mt-0.5 text-hint">
                        {serverStatus.host === "0.0.0.0" && lanIp ? `http://${lanIp}:${serverStatus.port}` : `http://127.0.0.1:${serverStatus.port}`}
                      </p>
                    )}
                  </div>
                ) : launchModel ? (
                  <div>
                    <p className="text-sm font-medium truncate text-hero">
                      {launchModel.name}{launchModel.quant && <span className="ml-2 text-xs text-hint">{launchModel.quant}</span>}
                    </p>
                    <p className="text-xs mt-0.5 text-hint">{selectedModel ? "Selected model" : "First available model"}</p>
                  </div>
                ) : (
                  <p className="text-sm text-hint">No models installed</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isDashboardRunning ? (
                <>
                  {serverStatus.type === "running" && <button className="btn-glass" onClick={() => navigate("/llm/chat")}>Chat</button>}
                  <button className="btn-danger" onClick={quickStop} disabled={stopping}><Square size={13} /> Stop</button>
                </>
              ) : (
                <button className="btn-accent" onClick={quickLaunch} disabled={!launchModel || !runtime?.installed || launching}>
                  <Play size={13} /> {launching ? "Starting\u2026" : "Launch"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: System Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Cpu, label: "CPU", value: shortCpuName(system?.cpu_name ?? "Unknown"), sub: `${system?.cpu_cores}c / ${system?.cpu_threads}t`, accent: "#5BA8F5" },
            { icon: MemoryStick, label: "RAM", value: mbToGb(system?.total_ram_mb ?? 0), sub: `${mbToGb(system?.available_ram_mb ?? 0)} free`, accent: "#06b6d4" },
            { icon: Monitor, label: "GPU", value: system?.gpus && system.gpus.length > 0 ? shortGpuName(system.gpus[0].name) : "None", sub: totalVram > 0 ? mbToGb(totalVram) + " VRAM" : "Shared memory", accent: "#5BA8F5" },
            { icon: Zap, label: "Backend", value: (system?.recommended_backend ?? "CPU").toUpperCase(), sub: sizeAdvice, accent: "#22c55e" },
          ].map(({ icon: Icon, label, value, sub, accent }) => (
            <div key={label} className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
                  <Icon size={16} style={{ color: accent, opacity: 0.8 }} />
                </div>
                <span className="text-primary-label">{label}</span>
              </div>
              <p className="hero-number-sm mb-1">{value}</p>
              <p className="text-xs text-hint">{sub}</p>
            </div>
          ))}
        </div>

        {/* SECTION 3: Active Runtime Panel */}
        <div className="rounded-2xl p-6" style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)", backdropFilter: "blur(20px)" }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <CheckCircle size={16} className="text-green-400" />
            </div>
            <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-hint">Active Runtime</span>
          </div>
          {runtime?.installed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold text-hero">
                  {runtime.runtime_type === "managed" ? <>Build <span className="font-mono">b{runtime.build}</span></> : "Custom"}
                </span>
                {runtime.backend && <span className="badge-blue text-[10px] font-medium uppercase tracking-wider px-2 py-0.5">{runtime.backend}</span>}
                <span className={`${runtime.runtime_type === "managed" ? "badge-blue" : "badge-gray"} text-[10px] font-medium uppercase tracking-wider px-2 py-0.5`}>{runtime.runtime_type}</span>
              </div>
              {runtime.path && <p className="text-xs font-mono text-hint">{runtime.path}</p>}
              {updateAvailable && !updating && (
                <div className="flex items-center gap-3 px-4 py-3 glass-card-static mt-2">
                  <Package size={14} className="text-yellow-400" />
                  <span className="text-xs text-yellow-400">Update available: <span className="font-mono">b{latestBuild}</span></span>
                  <button className="ml-auto btn-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px]" onClick={startUpdate}><Download size={11} /> Update</button>
                </div>
              )}
              {updating && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs">{updateProgress?.status === "extracting" ? "Extracting\u2026" : "Updating\u2026"}</span>
                    <span className="text-xs font-mono">{(updateProgress?.percent ?? 0).toFixed(1)}%</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden bg-glass-border">
                    <div className="h-full rounded-full transition-all duration-300 progress-fill" style={{ width: `${updateProgress?.percent ?? 0}%` }} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-hint">No runtime configured</p>
              <div className="flex gap-2">
                <button className="btn-accent flex items-center gap-1.5 px-4 py-2 text-[11px]"><Download size={12} /> Download</button>
                <button className="btn-glass flex items-center gap-1.5 px-3 py-2 text-[11px]" onClick={browseCustom}><FolderOpen size={12} /> Custom</button>
              </div>
            </div>
          )}
        </div>

        {/* Custom build picker */}
        {customBuilds && customBuilds.length > 1 && (
          <div className="glass-panel p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.15)" }}>
                    <Zap size={16} className="text-yellow-400" />
                  </div>
                  <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-hint">Multiple Builds Found</span>
                </div>
                <p className="text-xs">Select which llama-server build to use</p>
              </div>
              <button className="btn-glass text-[11px] font-medium px-3 py-1.5" onClick={() => setCustomBuilds(null)}>Dismiss</button>
            </div>
            <div className="space-y-2">
              {customBuilds.map((b) => (
                <button key={b.binary_path} className="w-full flex items-center gap-3 px-4 py-3 glass-card-static text-left transition-all duration-200 hover:scale-[1.01]" onClick={() => selectBuild(b)}>
                  <Zap size={14} className="text-primary/70 shrink-0" />
                  <span className="text-sm font-mono truncate">{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 4: Managed Runtimes */}
        <div className="rounded-2xl p-6" style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)", backdropFilter: "blur(20px)" }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <Package size={16} className="text-primary" />
              </div>
              <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-hint">Managed Runtimes</span>
            </div>
            <div className="flex items-center gap-2">
              {managed.length > 0 && (
                <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                  <input type="checkbox" checked={appConfig?.auto_delete_old_runtimes ?? false} onChange={(e) => toggleAutoDelete(e.target.checked)} className="accent-primary" />
                  Auto-delete old
                </label>
              )}
              <button className="btn-glass flex items-center gap-1.5 px-3 py-1.5 text-[11px]">
                <Download size={12} /> {managed.length > 0 ? "New version" : "Download"}
              </button>
            </div>
          </div>
          {managed.length === 0 ? (
            <p className="text-sm text-hint">No managed runtimes installed. Download one from GitHub releases.</p>
          ) : (
            <>
              <div className="space-y-2">
                {currentMr.map((r) => {
                  const isActive = r.build === activeBuild && r.backend_id === activeBackendId;
                  return (
                    <div key={`${r.build}-${r.backend_id}`} className={`flex items-center gap-3 px-4 py-3 glass-card-static transition-all duration-200 ${isActive ? "ring-1 ring-primary/30" : ""}`}>
                      {isActive && <CheckCircle size={14} style={{ color: "rgba(59,130,246,0.9)" }} className="shrink-0" />}
                      <span className="text-sm font-mono" style={{ color: isActive ? "var(--text-1)" : "var(--text-3)" }}>b{r.build}</span>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: isActive ? "rgba(96,165,250,0.9)" : "var(--text-4)" }}>{r.backend_label}</span>
                      {isActive ? (
                        <span className="badge-blue text-[10px] font-medium px-2 py-0.5 ml-auto">Active</span>
                      ) : (
                        <>
                          <span className="text-[11px] ml-auto text-hint">{new Date(r.installed_at * 1000).toLocaleDateString()}</span>
                          <button className="btn-glass p-1.5 hover:scale-110" onClick={() => activateManaged(r.build, r.backend_id)} title="Activate"><Play size={11} /></button>
                          <button className="p-1.5 transition-all duration-200 hover:scale-110 text-hint" onClick={() => deleteManaged(r.build, r.backend_id)} title="Delete"><Trash2 size={12} className="hover:!text-accent-red" /></button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {archivedMr.length > 0 && (
                <>
                  <button className="flex items-center gap-1.5 text-[11px] mt-3 transition-all duration-200 hover:scale-105" onClick={() => setShowArchived(!showArchived)}>
                    <Archive size={12} /> {showArchived ? "Hide" : "Show"} {archivedMr.length} archived
                    {showArchived ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                  {showArchived && (
                    <div className="space-y-2 mt-2">
                      {archivedMr.map((r) => (
                        <div key={`${r.build}-${r.backend_id}`} className="flex items-center gap-3 px-4 py-2.5 glass-card-static opacity-60">
                          <span className="text-sm font-mono">b{r.build}</span>
                          <span className="text-[10px] uppercase">{r.backend_label}</span>
                          <span className="text-[11px] ml-auto text-hint">{new Date(r.installed_at * 1000).toLocaleDateString()}</span>
                          <button className="p-1.5 transition-all duration-200 hover:scale-110 text-hint" style={{ background: "var(--bg-2)", color: "var(--text-4)" }} onClick={() => activateManaged(r.build, r.backend_id)} title="Activate"><Play size={11} /></button>
                          <button className="p-1.5 transition-all duration-200 hover:scale-110 text-hint" onClick={() => deleteManaged(r.build, r.backend_id)} title="Delete"><Trash2 size={12} className="hover:!text-accent-red" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* SECTION 5: Custom Runtimes */}
        <div className="rounded-2xl p-6" style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)", backdropFilter: "blur(20px)" }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <FolderOpen size={16} className="text-primary" />
              </div>
              <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-hint">Custom Runtimes</span>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 hover:scale-105" style={{ background: "var(--bg-2)", border: "1px solid var(--border-3)", color: "var(--text-2)" }} onClick={browseCustom}>
              <FolderOpen size={12} /> Add
            </button>
          </div>
          {custom.length === 0 ? (
            <p className="text-sm text-hint">No custom runtimes. Point to a local llama.cpp installation.</p>
          ) : (
            <div className="space-y-2">
              {custom.map((c, i) => {
                const isActive = activeCustomIdx === i;
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 glass-card-static transition-all duration-200 ${isActive ? "ring-1 ring-primary/30" : ""}`}>
                    <span className="text-sm" style={{ color: isActive ? "var(--text-1)" : "var(--text-2)" }}>{c.label}</span>
                    <span className="text-[11px] font-mono truncate flex-1">{c.binary_path}</span>
                    {isActive ? (
                      <span className="badge-blue text-[10px] font-medium px-2 py-0.5">Active</span>
                    ) : (
                      <>
                        <button className="p-1.5 transition-all duration-200 hover:scale-110 text-hint" style={{ background: "var(--bg-2)", color: "var(--text-4)" }} onClick={() => activateCustom(i)}><Play size={11} /></button>
                        <button className="p-1.5 transition-all duration-200 hover:scale-110 text-hint" onClick={() => removeCustom(i)}><Trash2 size={12} className="hover:!text-accent-red" /></button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 6: Available Backends */}
        <div className="rounded-2xl p-6" style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)", backdropFilter: "blur(20px)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.15)" }}>
              <Zap size={16} className="text-cyan-400" />
            </div>
            <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-hint">Available Backends</span>
          </div>
          <p className="text-xs mb-5 text-hint">Backends detected on this system</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {backends.map((b) => (
              <div key={b.id} className={`flex items-start gap-3 p-4 glass-card-static transition-all duration-200 ${b.available ? "" : "opacity-50"}`}>
                <Zap size={13} style={{ color: b.available ? "rgba(34,197,94,0.8)" : "var(--text-5)" }} className="mt-0.5 shrink-0" />
                <div><p className="text-xs font-medium">{b.name}</p><p className="text-[11px] mt-0.5">{b.description}</p></div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 7: Server Configuration */}
        {/* Server Header with Presets */}
        <div className="glass-card-static p-5">
          <div className="flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-1)", paddingBottom: "12px" }}>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-hero">Run Server</h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="relative">
                  <button
                    className="btn-glass !px-2 !py-1 !text-[11px]"
                    onClick={() => setShowPresetMenu(!showPresetMenu)}
                  >
                    <FolderOpen size={12} />
                    {activePreset ?? "Default"}
                    <ChevronDown size={11} />
                  </button>
                  {showPresetMenu && (
                    <div
                      className="absolute left-0 top-full mt-1 z-50 min-w-[250px] rounded-2xl p-1"
                      style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-2)", backdropFilter: "blur(40px)" }}
                    >
                      <button
                        className="w-full text-left px-3 py-2 text-xs rounded-lg flex items-center gap-2 transition-all duration-150"
                        style={{ color: "var(--text-2)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-1)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        onClick={resetToDefault}
                      >
                        Default
                        {!activePreset && <span className="ml-auto text-[10px]" style={{ color: "rgba(96,165,250,0.9)" }}>active</span>}
                      </button>
                      {presets.filter((n) => n !== "__default__").map((name) => (
                        <div
                          key={name}
                          className="flex items-center rounded-lg group"
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <button
                            className="flex-1 text-left px-3 py-2 text-xs flex items-center gap-2"
                            style={{ color: "var(--text-2)" }}
                            onClick={() => loadPreset(name)}
                          >
                            {name}
                            {activePreset === name && <span className="ml-auto text-[10px]" style={{ color: "rgba(96,165,250,0.9)" }}>active</span>}
                          </button>
                          <button
                            className="px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: "var(--text-5)" }}
                            onClick={(e) => { e.stopPropagation(); deletePreset(name); }}
                          >
                            <Trash2 size={11} className="hover:!text-accent-red" />
                          </button>
                        </div>
                      ))}
                      <div className="mt-1 pt-1" style={{ borderTop: "1px solid var(--border-2)" }}>
                        <button
                          className="w-full text-left px-3 py-2 text-xs rounded-lg transition-all duration-150"
                          style={{ color: "var(--text-3)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          onClick={saveAsDefaults}
                        >
                          Save current settings as defaults
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-xs rounded-lg transition-all duration-150"
                          style={{ color: "var(--text-3)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          onClick={resetDefaults}
                        >
                          Reset defaults to built-in
                        </button>
                      </div>
                      <div className="mt-1 pt-1 flex gap-1" style={{ borderTop: "1px solid var(--border-2)" }}>
                        <input
                          className={`glass-input text-xs py-1 flex-1`}
                          placeholder="Preset name..."
                          value={saveName}
                          onChange={(e) => setSaveName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") savePreset(saveName); }}
                        />
                        <button
                          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-all duration-200 hover:scale-105"
                          style={{ background: "rgba(91,168,245,0.15)", color: "rgba(91,168,245,0.9)" }}
                          onClick={() => savePreset(saveName)}
                          disabled={!saveName.trim()}
                        >
                          <Save size={11} /> Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {activePreset && (
                  <button
                    className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110"
                    style={{ background: "var(--bg-1)", color: "var(--text-4)" }}
                    onClick={() => savePreset(activePreset)}
                    title="Overwrite current preset"
                  >
                    <Save size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {status.type === "running" && (
                <>
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(34,197,94,0.9)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                    Running on port {status.port}
                  </span>
                  <span
                    className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md"
                    style={{
                      background: config.n_gpu_layers === 0 ? "rgba(91,168,245,0.12)" : "rgba(34,197,94,0.12)",
                      color: config.n_gpu_layers === 0 ? "rgba(91,168,245,0.9)" : "rgba(74,222,128,0.9)",
                    }}
                    title={config.n_gpu_layers === 0 ? "Model running on CPU only" : config.n_gpu_layers === -1 ? "Full GPU offload" : `${config.n_gpu_layers} layers on GPU`}
                  >
                    {config.n_gpu_layers === 0 ? "CPU" : "GPU"}
                  </span>
                  {config.mmproj_path && !config.no_mmproj_offload && (
                    <span
                      className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md"
                      style={{ background: "rgba(245,158,11,0.12)", color: "rgba(251,191,36,0.9)" }}
                      title="Vision encoder on GPU"
                    >
                      Vision: GPU
                    </span>
                  )}
                  {config.mmproj_path && config.no_mmproj_offload && (
                    <span
                      className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md"
                      style={{ background: "rgba(91,168,245,0.12)", color: "rgba(91,168,245,0.9)" }}
                      title="Vision encoder on CPU"
                    >
                      Vision: CPU
                    </span>
                  )}
                  <button className="btn-glass" onClick={openChat} disabled={openingChat}>
                    <ExternalLink size={13} /> Open Chat
                  </button>
                </>
              )}
              {status.type === "starting" && (
                <span className="text-xs flex items-center gap-1.5" style={{ color: "rgba(245,158,11,0.9)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow animate-pulse" />
                  Starting...
                </span>
              )}
              {status.type === "error" && (
                <span className="text-xs flex items-center gap-1.5" style={{ color: "rgba(239,68,68,0.9)" }} title={status.message}>
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                  {status.message.length > 60 ? status.message.substring(0, 60) + "..." : status.message}
                </span>
              )}
              {isServerRunning ? (
                <button className="btn-danger" onClick={stopServer}>
                  <Square size={14} /> Stop
                </button>
              ) : (
                <button className="btn-accent" onClick={startServer} disabled={!config.model_path}>
                  <Play size={14} /> Launch
                </button>
              )}
            </div>
          </div>
        </div>

{/* Pre-launch summary */}
        {!isServerRunning && config.model_path && (
          <div className="glass-card-static p-5">
            <div className="flex items-center gap-2 mb-3">
              <Play size={13} className="text-hint" />
              <span className="section-label !mb-0">Launch Summary</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: config.n_gpu_layers === 0 ? "rgba(96,165,250,0.8)" : "rgba(74,222,128,0.8)" }} />
                <div>
                    <p className="text-[10px] uppercase text-hint">Model</p>
                  <p className="text-xs font-medium" style={{ color: config.n_gpu_layers === 0 ? "rgba(91,168,245,0.9)" : "rgba(74,222,128,0.9)" }}>
                    {config.n_gpu_layers === 0 ? "CPU Only" : config.n_gpu_layers === -1 ? "Full GPU" : `${config.n_gpu_layers} GPU Layers`}
                  </p>
                </div>
              </div>
              {config.mmproj_path && (
                  <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: config.no_mmproj_offload ? "rgba(91,168,245,0.8)" : "rgba(251,191,36,0.8)" }} />
                  <div>
                    <p className="text-[10px] uppercase text-hint">Vision Encoder</p>
                  <p className="text-xs font-medium" style={{ color: config.no_mmproj_offload ? "rgba(91,168,245,0.9)" : "rgba(251,191,36,0.9)" }}>
                      {config.no_mmproj_offload ? "CPU (Safe)" : "GPU (May Crash)"}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--text-5)" }} />
                <div>
                    <p className="text-[10px] uppercase text-hint">Context</p>
                  <p className="text-xs font-medium" style={{ color: "var(--text-2)" }}>
                    {config.n_ctx === 0 ? "Auto" : config.n_ctx >= 1024 ? `${(config.n_ctx / 1024).toFixed(0)}K` : config.n_ctx}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: config.flash_attn === "off" ? "var(--text-5)" : "rgba(74,222,128,0.8)" }} />
                <div>
                    <p className="text-[10px] uppercase text-hint">Flash Attn</p>
                  <p className="text-xs font-medium" style={{ color: config.flash_attn === "off" ? "var(--text-4)" : "rgba(74,222,128,0.9)" }}>
                    {config.flash_attn === "off" ? "Off" : config.flash_attn === "on" ? "On" : "Auto"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--text-5)" }} />
                <div>
                    <p className="text-[10px] uppercase text-hint">Batch</p>
                  <p className="text-xs font-medium" style={{ color: "var(--text-2)" }}>{config.n_batch} / {config.n_ubatch}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: config.parallel > 1 ? "rgba(74,222,128,0.8)" : "var(--text-5)" }} />
                <div>
                    <p className="text-[10px] uppercase text-hint">Slots</p>
                  <p className="text-xs font-medium" style={{ color: config.parallel > 1 ? "rgba(74,222,128,0.9)" : "var(--text-2)" }}>
                    {config.parallel} {config.parallel > 1 ? "(parallel)" : "(serial)"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--text-5)" }} />
                <div>
                    <p className="text-[10px] uppercase text-hint">KV Cache</p>
                  <p className="text-xs font-medium" style={{ color: "var(--text-2)" }}>{config.cache_type_k} / {config.cache_type_v}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--text-5)" }} />
                <div>
                    <p className="text-[10px] uppercase text-hint">Port</p>
                  <p className="text-xs font-medium" style={{ color: "var(--text-2)" }}>{config.port}</p>
                </div>
              </div>
            </div>
            {config.mmproj_path && !config.no_mmproj_offload && config.n_gpu_layers !== 0 && (
              <div className="mt-3 p-2 rounded-xl" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)" }}>
                <p className="text-xs" style={{ color: "rgba(251,191,36,0.9)" }}>
                  Vision encoder is on GPU. If images crash the server, enable <strong>mmproj Offload = OFF</strong> in Advanced tab.
                </p>
              </div>
            )}
          </div>
        )}

          {/* Model selection */}
          <div className="glass-card-static p-5">
          {models.length === 0 ? (
            <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(91,168,245,0.1)", border: "1px solid rgba(91,168,245,0.15)" }}>
                    <HardDrive size={16} style={{ color: "rgba(91,168,245,0.8)" }} />
                  </div>
                  <span className="text-primary-label">Model</span>
                </div>
                <p className="text-sm text-secondary">
                  No models installed.{" "}
                  <button className="transition-all duration-200 hover:scale-105" style={{ color: "rgba(91,168,245,0.9)" }} onClick={() => navigate("/llm/models")}>
                  Download one first.
                </button>
              </p>
            </>
          ) : (() => {
            const selected = models.find((m) => m.path === config.model_path);
            return (
              <>
                <button className="w-full flex items-center justify-between" onClick={() => setShowModelList(!showModelList)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(91,168,245,0.1)", border: "1px solid rgba(91,168,245,0.15)" }}>
                      <HardDrive size={16} style={{ color: "rgba(91,168,245,0.8)" }} />
                    </div>
                    <span className="text-primary-label shrink-0">Model</span>
                    {selected && !showModelList && (
                      <span className="text-sm truncate" style={{ color: "var(--text-2)" }}>
                        {selected.name}
                        {selected.quant && <span style={{ color: "var(--text-4)" }}> {selected.quant}</span>}
                        {selected.is_vision && selected.mmproj_path && (
                          <Eye size={11} className="inline ml-1.5" style={{ color: "rgba(96,165,250,0.8)" }} />
                        )}
                      </span>
                    )}
                  </div>
                  {showModelList
                    ? <ChevronUp size={14} style={{ color: "var(--text-4)" }} className="shrink-0" />
                    : <ChevronDown size={14} style={{ color: "var(--text-4)" }} className="shrink-0" />}
                </button>
                {showModelList && (
                  <div className="space-y-2 mt-3">
                    {[...models].sort((a, b) => {
                      const aFav = favorites.includes(a.id) ? 0 : 1;
                      const bFav = favorites.includes(b.id) ? 0 : 1;
                      if (aFav !== bFav) return aFav - bFav;
                      return a.name.localeCompare(b.name);
                    }).map((m) => {
                      const isSelected = config.model_path === m.path;
                      const hasVision = m.is_vision && !!m.mmproj_path;
                      return (
                        <button
                          key={m.id}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 hover:scale-[1.005]"
                          style={{
                            background: isSelected ? "rgba(59,130,246,0.06)" : "var(--bg-1)",
                            border: `1px solid ${isSelected ? "rgba(59,130,246,0.2)" : "var(--border-1)"}`,
                          }}
                          onClick={() => { handleModelChange(m); setShowModelList(false); }}
                        >
                          <div
                            className="w-3 h-3 rounded-full border-2 shrink-0"
                            style={{
                              borderColor: isSelected ? "#5BA8F5" : "var(--border-3)",
                              background: isSelected ? "#5BA8F5" : "transparent",
                            }}
                          />
                          <HardDrive size={13} style={{ color: "var(--text-5)" }} className="shrink-0" />
                          <span className="flex-1 text-sm truncate" style={{ color: "var(--text-2)" }}>{m.name}</span>
                          {hasVision && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ background: "rgba(91,168,245,0.12)", color: "rgba(91,168,245,0.9)" }} title={`Vision: ${m.mmproj_path}`}>
                              <Eye size={9} /> Vision
                            </span>
                          )}
                          {m.is_vision && !m.mmproj_path && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ background: "var(--bg-1)", color: "var(--text-4)" }} title="Vision model but no mmproj file found">
                              <Eye size={9} className="opacity-50" /> No mmproj
                            </span>
                          )}
                          {m.quant && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "rgba(91,168,245,0.12)", color: "rgba(91,168,245,0.9)" }}>{m.quant}</span>
                          )}
                          <span className="text-xs" style={{ color: "var(--text-5)" }}>{(m.size_bytes / 1024 ** 3).toFixed(1)} GB</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Tab bar */}
        <div className="tab-bar -mb-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`tab-item ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="glass-card-static space-y-4 p-5">
          {activeTab === "Context" && <>
            <Section title="Context & Prediction" />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Context Size" hint="0 = auto (model default)" value={config.n_ctx} min={0} max={1048576} step={512}
                onChange={(v) => setConfig((c) => ({ ...c, n_ctx: v ?? 0 }))} />
              <NumberInput label="Max Tokens" hint="-1 = unlimited" value={config.n_predict} min={-1}
                onChange={(v) => setConfig((c) => ({ ...c, n_predict: v ?? -1 }))} />
              <NumberInput label="Batch Size" hint="Logical max batch (default: 2048)" value={config.n_batch} min={1} max={16384} step={32}
                onChange={(v) => setConfig((c) => ({ ...c, n_batch: v ?? 2048 }))} />
              <NumberInput label="Micro-batch Size" hint="Physical max batch (default: 512)" value={config.n_ubatch} min={1} max={16384} step={32}
                onChange={(v) => setConfig((c) => ({ ...c, n_ubatch: v ?? 512 }))} />
              <NumberInput label="Keep Tokens" hint="Tokens to keep from initial prompt (0=none, -1=all)" value={getEpNum("keep")}
                onChange={(v) => setEpNum("keep", v)} />
            </div>
            <Section title="Attention & KV Cache" />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput label="Flash Attention" value={config.flash_attn}
                options={[{ value: "auto", label: "Auto" }, { value: "on", label: "On" }, { value: "off", label: "Off" }]}
                onChange={(v) => setConfig((c) => ({ ...c, flash_attn: v }))} />
              <div />
              <SelectInput label="KV Cache Type (K)" value={config.cache_type_k}
                options={KV_TYPES.map((t) => ({ value: t, label: t }))}
                onChange={(v) => setConfig((c) => ({ ...c, cache_type_k: v }))} />
              <SelectInput label="KV Cache Type (V)" value={config.cache_type_v}
                options={KV_TYPES.map((t) => ({ value: t, label: t }))}
                onChange={(v) => setConfig((c) => ({ ...c, cache_type_v: v }))} />
            </div>
            <div className="space-y-3 mt-2">
              <Toggle label="SWA Full" hint="Use full-size sliding window attention cache" checked={hasFlag("swa-full")} onChange={(v) => setFlag("swa-full", v)} />
              <Toggle label="KV Offload" hint="Offload KV cache to GPU (default: on)" checked={!hasFlag("no-kv-offload")} onChange={(v) => setFlag("no-kv-offload", !v)} />
              <Toggle label="KV Unified" hint="Single unified KV buffer shared across sequences" checked={hasFlag("kv-unified") || (!hasFlag("no-kv-unified") && config.parallel <= 1)}
                onChange={(v) => { setFlag("kv-unified", v); setFlag("no-kv-unified", !v); }} />
              <Toggle label="Context Shift" hint="Use context shift on infinite text generation" checked={hasFlag("context-shift")} onChange={(v) => { setFlag("context-shift", v); setFlag("no-context-shift", !v); }} />
              <Toggle label="Cache Prompt" hint="Enable prompt caching (default: on)" checked={!hasFlag("no-cache-prompt")} onChange={(v) => setFlag("no-cache-prompt", !v)} />
              <Toggle label="Cache Idle Slots" hint="Save and clear idle slots on new task (default: on, requires KV unified + cache-ram)"
                checked={!hasFlag("no-cache-idle-slots")} onChange={(v) => setFlag("no-cache-idle-slots", !v)} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <NumberInput label="Cache Reuse" hint="Min chunk for KV shifting reuse (0=disabled)" value={getEpNum("cache-reuse")} min={0}
                onChange={(v) => setEpNum("cache-reuse", v)} />
              <NumberInput label="Cache RAM (MiB)" hint="Max cache size (-1=no limit, 0=disabled, default: 8192)" value={getEpNum("cache-ram")}
                onChange={(v) => setEpNum("cache-ram", v)} />
              <NumberInput label="Context Checkpoints" hint="Max checkpoints per slot (default: 32)" value={getEpNum("ctx-checkpoints")} min={0}
                onChange={(v) => setEpNum("ctx-checkpoints", v)} />
              <NumberInput label="Checkpoint Interval" hint="Checkpoint every N tokens (-1=disable, default: 8192)" value={getEpNum("checkpoint-every-n-tokens")}
                onChange={(v) => setEpNum("checkpoint-every-n-tokens", v)} />
            </div>
          </>}

          {activeTab === "Hardware" && <>
            <Section title="GPU" />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="GPU Layers" hint="-1 = all on GPU, 0 = CPU only" value={config.n_gpu_layers} min={-1}
                onChange={(v) => setConfig((c) => ({ ...c, n_gpu_layers: v ?? -1 }))} />
              <SelectInput label="Split Mode" hint="Multi-GPU split strategy" value={getEp("split-mode") || "layer"}
                options={[{ value: "none", label: "None (single GPU)" }, { value: "layer", label: "Layer (default)" }, { value: "row", label: "Row" }]}
                onChange={(v) => setEp("split-mode", v === "layer" ? "" : v)} />
              <TextInput label="Tensor Split" hint="GPU split ratios, e.g. 3,1" value={getEp("tensor-split")} placeholder="e.g. 3,1"
                onChange={(v) => setEp("tensor-split", v)} />
              <NumberInput label="Main GPU" hint="Primary GPU index (default: 0)" value={getEpNum("main-gpu")} min={0}
                onChange={(v) => setEpNum("main-gpu", v)} />
              <TextInput label="Device" hint="Devices for offloading, comma-separated" value={getEp("device")}
                onChange={(v) => setEp("device", v)} />
              <SelectInput label="Fit" hint="Auto-adjust params to fit device memory" value={getEp("fit") || "on"}
                options={[{ value: "on", label: "On (default)" }, { value: "off", label: "Off" }]}
                onChange={(v) => setEp("fit", v === "on" ? "" : v)} />
              <TextInput label="Fit Target (MiB)" hint="Target margin per device (default: 1024)" value={getEp("fit-target")} placeholder="1024"
                onChange={(v) => setEp("fit-target", v)} />
              <NumberInput label="Fit Min Ctx" hint="Min context size for --fit (default: 4096)" value={getEpNum("fit-ctx")} min={0}
                onChange={(v) => setEpNum("fit-ctx", v)} />
            </div>
            <Section title="CPU" />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Threads" hint="CPU threads for generation (-1=auto)" value={config.n_threads}
                onChange={(v) => setConfig((c) => ({ ...c, n_threads: v }))} />
              <NumberInput label="Threads Batch" hint="Threads for batch processing (default: same as threads)" value={getEpNum("threads-batch")}
                onChange={(v) => setEpNum("threads-batch", v)} />
              <SelectInput label="NUMA" hint="NUMA optimizations" value={getEp("numa") || ""}
                options={[{ value: "", label: "Disabled" }, { value: "distribute", label: "Distribute" }, { value: "isolate", label: "Isolate" }, { value: "numactl", label: "numactl" }]}
                onChange={(v) => setEp("numa", v)} />
            </div>
            <Section title="Memory" />
            <div className="space-y-3">
              <Toggle label="mlock" hint="Lock model in RAM (prevents swapping)" checked={config.mlock}
                onChange={(v) => setConfig((c) => ({ ...c, mlock: v }))} />
              <Toggle label="Memory Map" hint="Memory-map model file (default: on)" checked={!config.no_mmap}
                onChange={(v) => setConfig((c) => ({ ...c, no_mmap: !v }))} />
              <Toggle label="Direct IO" hint="Use DirectIO if available" checked={hasFlag("direct-io")} onChange={(v) => setFlag("direct-io", v)} />
              <Toggle label="CPU MoE" hint="Keep all MoE weights on CPU" checked={hasFlag("cpu-moe")} onChange={(v) => setFlag("cpu-moe", v)} />
              <Toggle label="CPU MoE (Draft)" hint="Keep all MoE weights on CPU for draft model" checked={hasFlag("spec-draft-cpu-moe")} onChange={(v) => setFlag("spec-draft-cpu-moe", v)} />
              <Toggle label="Repack" hint="Enable weight repacking (default: on)" checked={!hasFlag("no-repack")} onChange={(v) => setFlag("no-repack", !v)} />
              <Toggle label="Op Offload" hint="Offload host tensor ops to device (default: on)" checked={!hasFlag("no-op-offload")} onChange={(v) => setFlag("no-op-offload", !v)} />
              <Toggle label="No Host Buffer" hint="Bypass host buffer for extra device buffers" checked={hasFlag("no-host")} onChange={(v) => setFlag("no-host", v)} />
              <Toggle label="Check Tensors" hint="Validate model tensor data on load" checked={hasFlag("check-tensors")} onChange={(v) => setFlag("check-tensors", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <NumberInput label="N CPU MoE Layers" hint="Keep MoE weights of first N layers on CPU" value={getEpNum("n-cpu-moe")} min={0}
                onChange={(v) => setEpNum("n-cpu-moe", v)} />
              <NumberInput label="N CPU MoE Layers (Draft)" hint="Keep MoE weights of first N layers on CPU for draft" value={getEpNum("spec-draft-n-cpu-moe")} min={0}
                onChange={(v) => setEpNum("spec-draft-n-cpu-moe", v)} />
            </div>
            <Section title="Overrides" />
            <div className="grid grid-cols-1 gap-3">
              <TextInput label="Override Tensor" hint="<pattern>=<buffer type>,... e.g. attn_v=cuda0" value={getEp("override-tensor")}
                onChange={(v) => setEp("override-tensor", v)} />
              <TextInput label="Override Tensor (Draft)" hint="Tensor buffer type override for draft model: <pattern>=<type>,..." value={getEp("spec-draft-override-tensor")}
                onChange={(v) => setEp("spec-draft-override-tensor", v)} />
              <TextInput label="Override KV" hint="KEY=TYPE:VALUE,... e.g. tokenizer.ggml.add_bos_token=bool:false" value={getEp("override-kv")}
                onChange={(v) => setEp("override-kv", v)} />
            </div>
          </>}

          {activeTab === "Sampling" && <>
            <Section title="Basic" />
            <Slider label="Temperature" hint="Higher = more creative" value={config.temperature} min={0} max={2} step={0.01}
              onChange={(v) => setConfig((c) => ({ ...c, temperature: v }))} format={(v) => v.toFixed(2)} />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Seed" hint="Empty or -1 = random" value={config.seed !== null ? config.seed : -1}
                onChange={(v) => setConfig((c) => ({ ...c, seed: v !== null && v >= 0 ? v : null }))} />
              <TextInput label="Samplers" hint="Sampler chain, semicolon-separated" value={getEp("samplers")}
                placeholder="penalties;dry;top_n_sigma;top_k;typ_p;top_p;min_p;xtc;temperature"
                onChange={(v) => setEp("samplers", v)} />
            </div>
            <Section title="Nucleus / Top-K / Min-P" />
            <Slider label="Top-K" value={config.top_k} min={0} max={200} step={1}
              onChange={(v) => setConfig((c) => ({ ...c, top_k: v }))} />
            <Slider label="Top-P" value={config.top_p} min={0} max={1} step={0.01}
              onChange={(v) => setConfig((c) => ({ ...c, top_p: v }))} format={(v) => v.toFixed(2)} />
            <Slider label="Min-P" hint="Minimum probability relative to top token" value={config.min_p} min={0} max={1} step={0.001}
              onChange={(v) => setConfig((c) => ({ ...c, min_p: v }))} format={(v) => v.toFixed(3)} />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Top-N-Sigma" hint="-1 = disabled" value={getEpNum("top-n-sigma")}
                onChange={(v) => setEpNum("top-n-sigma", v)} />
              <NumberInput label="Typical P" hint="1.0 = disabled (default)" value={getEpNum("typical")}
                onChange={(v) => setEpNum("typical", v)} />
            </div>
            <Section title="Penalties" />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Repeat Last N" hint="0=disabled, -1=ctx_size (default: 64)" value={getEpNum("repeat-last-n")}
                onChange={(v) => setEpNum("repeat-last-n", v)} />
              <NumberInput label="Repeat Penalty" hint="1.0 = disabled (default)" value={getEpNum("repeat-penalty")} step={0.01}
                onChange={(v) => setEpNum("repeat-penalty", v)} />
              <NumberInput label="Presence Penalty" hint="0.0 = disabled (default)" value={getEpNum("presence-penalty")} step={0.01}
                onChange={(v) => setEpNum("presence-penalty", v)} />
              <NumberInput label="Frequency Penalty" hint="0.0 = disabled (default)" value={getEpNum("frequency-penalty")} step={0.01}
                onChange={(v) => setEpNum("frequency-penalty", v)} />
            </div>
            <Section title="XTC" />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="XTC Probability" hint="0.0 = disabled (default)" value={getEpNum("xtc-probability")} step={0.01}
                onChange={(v) => setEpNum("xtc-probability", v)} />
              <NumberInput label="XTC Threshold" hint="1.0 = disabled (default: 0.10)" value={getEpNum("xtc-threshold")} step={0.01}
                onChange={(v) => setEpNum("xtc-threshold", v)} />
            </div>
            <Section title="DRY Sampling" />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="DRY Multiplier" hint="0.0 = disabled (default)" value={getEpNum("dry-multiplier")} step={0.1}
                onChange={(v) => setEpNum("dry-multiplier", v)} />
              <NumberInput label="DRY Base" hint="Default: 1.75" value={getEpNum("dry-base")} step={0.05}
                onChange={(v) => setEpNum("dry-base", v)} />
              <NumberInput label="DRY Allowed Length" hint="Default: 2" value={getEpNum("dry-allowed-length")} min={0}
                onChange={(v) => setEpNum("dry-allowed-length", v)} />
              <NumberInput label="DRY Penalty Last N" hint="-1=ctx size, 0=disable" value={getEpNum("dry-penalty-last-n")}
                onChange={(v) => setEpNum("dry-penalty-last-n", v)} />
            </div>
            <Section title="Adaptive Sampling" />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Adaptive Target" hint="Target probability (negative=disabled, default: -1)" value={getEpNum("adaptive-target")} step={0.01}
                onChange={(v) => setEpNum("adaptive-target", v)} />
              <NumberInput label="Adaptive Decay" hint="Decay rate (0.0-0.99, default: 0.90)" value={getEpNum("adaptive-decay")} step={0.01}
                onChange={(v) => setEpNum("adaptive-decay", v)} />
            </div>
            <Section title="Dynamic Temperature" />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Range" hint="0.0 = disabled (default)" value={getEpNum("dynatemp-range")} step={0.1}
                onChange={(v) => setEpNum("dynatemp-range", v)} />
              <NumberInput label="Exponent" hint="Default: 1.0" value={getEpNum("dynatemp-exp")} step={0.1}
                onChange={(v) => setEpNum("dynatemp-exp", v)} />
            </div>
            <Section title="Mirostat" />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput label="Mode" value={getEp("mirostat") || "0"}
                options={[{ value: "0", label: "Disabled" }, { value: "1", label: "Mirostat 1" }, { value: "2", label: "Mirostat 2" }]}
                onChange={(v) => setEp("mirostat", v === "0" ? "" : v)} />
              <NumberInput label="Learning Rate" hint="Default: 0.10" value={getEpNum("mirostat-lr")} step={0.01}
                onChange={(v) => setEpNum("mirostat-lr", v)} />
              <NumberInput label="Target Entropy" hint="Default: 5.00" value={getEpNum("mirostat-ent")} step={0.1}
                onChange={(v) => setEpNum("mirostat-ent", v)} />
            </div>
            <Section title="Misc" />
            <div className="space-y-3">
              <Toggle label="Ignore EOS" hint="Continue generating past end-of-stream" checked={hasFlag("ignore-eos")} onChange={(v) => setFlag("ignore-eos", v)} />
              <Toggle label="Backend Sampling" hint="Experimental backend sampling" checked={hasFlag("backend-sampling")} onChange={(v) => setFlag("backend-sampling", v)} />
            </div>
          </>}

          {activeTab === "Server" && <>
            <Section title="Network" />
            <div className="space-y-3">
              <Toggle
                label="LAN Sharing"
                hint="Allow other devices on your network to access the server"
                checked={config.host === "0.0.0.0"}
                onChange={(v) => setConfig((c) => ({ ...c, host: v ? "0.0.0.0" : "127.0.0.1" }))}
              />
              {config.host === "0.0.0.0" && lanIp && (
                <div className="rounded-xl p-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <p className="text-xs font-medium mb-1" style={{ color: "rgba(34,197,94,0.9)" }}>
                    Other devices can connect at:
                  </p>
                  <p className="text-sm font-mono" style={{ color: "rgba(34,197,94,0.8)" }}>
                    http://{lanIp}:{config.port}
                  </p>
                  <p className="text-xs mt-1 text-hint">
                    Anyone on your network can use the LLM while this is enabled
                  </p>
                </div>
              )}
              {config.host === "127.0.0.1" && (
                <div className="rounded-xl p-3 glass-card-static">
                  <p className="text-xs text-hint">
                    Server is only accessible from this device (localhost)
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <NumberInput label="Port" value={config.port} min={1} max={65535}
                onChange={(v) => setConfig((c) => ({ ...c, port: v ?? 8080 }))} />
              <div>
                <NumberInput
                  label="Parallel Slots"
                  hint={config.parallel > 1
                    ? `${config.parallel} users can chat simultaneously (~${(config.parallel - 1) * 768}MB extra RAM)`
                    : "1 = serial (one request at a time)"}
                  value={config.parallel}
                  min={1}
                  max={128}
                  onChange={(v) => setConfig((c) => ({ ...c, parallel: v ?? 1 }))}
                />
                {config.parallel > 1 && (
                  <p className="text-[10px] mt-1" style={{ color: "rgba(74,222,128,0.7)" }}>
                    {config.parallel} concurrent users supported
                  </p>
                )}
              </div>
              <NumberInput label="Timeout (s)" hint="Read/write timeout (default: 600)" value={getEpNum("timeout")} min={0}
                onChange={(v) => setEpNum("timeout", v)} />
              <NumberInput label="HTTP Threads" hint="-1 = auto (default)" value={getEpNum("threads-http")}
                onChange={(v) => setEpNum("threads-http", v)} />
              <NumberInput label="Sleep Idle (s)" hint="Sleep after N seconds idle (-1=disabled)" value={getEpNum("sleep-idle-seconds")}
                onChange={(v) => setEpNum("sleep-idle-seconds", v)} />
            </div>
            <div className="space-y-3 mt-2">
              <Toggle label="Reuse Port" hint="Allow multiple sockets to bind to the same port" checked={hasFlag("reuse-port")} onChange={(v) => setFlag("reuse-port", v)} />
            </div>
            <Section title="Web Chat Server" />
            <div className="space-y-3">
              <Toggle
                label="Chat History Server"
                hint="Custom chat UI with persistent history (survives page refresh)"
                checked={webRunning}
                onChange={toggleWebServer}
              />
              {!webRunning && (
                <NumberInput label="Chat Port" hint="Port for the chat history server" value={webPort} min={1024} max={65535}
                  onChange={(v) => setWebPort(v ?? 8080)} />
              )}
              {webRunning && lanIp && (
                <div className="rounded-xl p-3" style={{ background: "rgba(91,168,245,0.08)", border: "1px solid rgba(91,168,245,0.2)" }}>
                  <p className="text-xs font-medium mb-1" style={{ color: "rgba(91,168,245,0.9)" }}>
                    Open chat at:
                  </p>
                  <a
                    href={`http://${lanIp}:${webPort}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono hover:underline"
                    style={{ color: "rgba(91,168,245,0.8)" }}
                  >
                    http://{lanIp}:{webPort}
                  </a>
                  <p className="text-xs mt-1 text-hint">
                    Chat history is saved on this device
                  </p>
                </div>
              )}
            </div>
            <Section title="API Providers (Cloud AI)" />
            <div className="space-y-3">
              <p className="text-xs text-hint">
                Configure external API providers for cloud-based chat (OpenAI, Gemini, DeepSeek, etc.)
              </p>
              {apiProviders.providers.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-hint mb-2">No API providers configured</p>
                  <button
                    className="btn-accent !px-3 !py-1.5 !text-[11px]"
                    onClick={() => {
                      const preset = apiPresets.find((p) => p.id === "openai");
                      if (preset) {
                        const provider: ApiProviderConfig = {
                          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
                          provider_id: preset.id,
                          name: preset.name,
                          base_url: preset.base_url,
                          api_key: "",
                          selected_model: preset.default_models[0] || "",
                          created_at: Date.now(),
                          is_active: true,
                        };
                        setEditingProvider(provider);
                      }
                    }}
                  >
                    + Add Provider
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiProviders.providers.map((p) => {
                    const preset = apiPresets.find((pr) => pr.id === p.provider_id);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: "var(--bg-2)", border: "1px solid var(--border-1)" }}
                      >
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: preset?.icon_color || "#888" }}
                        >
                          {p.name[0]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-hero truncate">{p.name}</p>
                          <p className="text-[10px] text-hint truncate">{p.selected_model}</p>
                        </div>
                        <span className="text-[10px] text-hint shrink-0">{p.api_key ? "Key set" : "No key"}</span>
                        <button
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                          onClick={() => setEditingProvider(p)}
                        >
                          <Eye size={12} className="text-hint" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                          onClick={async () => {
                            await invoke("llm_delete_api_provider", { providerId: p.id });
                            const updated = await invoke<ApiProvidersConfig>("llm_get_api_providers");
                            setApiProviders(updated);
                          }}
                        >
                          <Trash2 size={12} className="text-hint" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-primary hover:bg-white/5 transition-colors"
                    style={{ border: "1px dashed var(--border-1)" }}
                    onClick={() => {
                      const preset = apiPresets.find((p) => p.id === "openai");
                      if (preset) {
                        setEditingProvider({
                          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
                          provider_id: preset.id,
                          name: preset.name,
                          base_url: preset.base_url,
                          api_key: "",
                          selected_model: preset.default_models[0] || "",
                          created_at: Date.now(),
                          is_active: false,
                        });
                      }
                    }}
                  >
                    + Add Provider
                  </button>
                </div>
              )}
            </div>
            {editingProvider && (
              <ProviderEditModal
                provider={editingProvider}
                presets={apiPresets}
                onSave={async (p) => {
                  await invoke("llm_save_api_provider", { provider: p });
                  const updated = await invoke<ApiProvidersConfig>("llm_get_api_providers");
                  setApiProviders(updated);
                  setEditingProvider(null);
                }}
                onTest={async (p) => {
                  setProviderTesting(true);
                  setProviderTestResult(null);
                  try {
                    const res = await invoke<{ success: boolean; latency_ms: number; error: string | null }>("llm_test_api_provider", { provider: p });
                    setProviderTestResult(res.success ? `OK (${res.latency_ms}ms)` : `Failed: ${res.error}`);
                  } catch (e) {
                    setProviderTestResult(`Error: ${String(e)}`);
                  } finally {
                    setProviderTesting(false);
                  }
                }}
                testResult={providerTestResult}
                testing={providerTesting}
                onClose={() => { setEditingProvider(null); setProviderTestResult(null); }}
              />
            )}
            <Section title="API" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="API Key" hint="Comma-separated keys for auth" value={getEp("api-key")}
                onChange={(v) => setEp("api-key", v)} />
              <TextInput label="API Key File" hint="Path to file with API keys" value={getEp("api-key-file")}
                onChange={(v) => setEp("api-key-file", v)} />
              <TextInput label="Alias" hint="Model name aliases for API" value={getEp("alias")}
                onChange={(v) => setEp("alias", v)} />
              <TextInput label="Tags" hint="Model tags (informational)" value={getEp("tags")}
                onChange={(v) => setEp("tags", v)} />
              <TextInput label="API Prefix" hint="URL prefix without trailing slash" value={getEp("api-prefix")}
                onChange={(v) => setEp("api-prefix", v)} />
              <NumberInput label="Slot Prompt Similarity" hint="Min prompt match for slot reuse (0=disabled, default: 0.10)" value={getEpNum("slot-prompt-similarity")} step={0.01}
                onChange={(v) => setEpNum("slot-prompt-similarity", v)} />
            </div>
            <Section title="Features" />
            <div className="space-y-3">
              <Toggle label="Continuous Batching" hint="Process multiple requests simultaneously (default: on)" checked={config.cont_batching}
                onChange={(v) => setConfig((c) => ({ ...c, cont_batching: v }))} />
              <Toggle label="WebUI" hint="Serve built-in web interface (default: on)" checked={!hasFlag("no-webui")} onChange={(v) => setFlag("no-webui", !v)} />
              <Toggle label="WebUI MCP Proxy" hint="Experimental MCP CORS proxy" checked={hasFlag("webui-mcp-proxy")} onChange={(v) => setFlag("webui-mcp-proxy", v)} />
              <Toggle label="Metrics" hint="Prometheus-compatible metrics endpoint" checked={hasFlag("metrics")} onChange={(v) => setFlag("metrics", v)} />
              <Toggle label="Props" hint="Allow changing global properties via POST /props" checked={hasFlag("props")} onChange={(v) => setFlag("props", v)} />
              <Toggle label="Slots Endpoint" hint="Expose slot monitoring (default: on)" checked={!hasFlag("no-slots")} onChange={(v) => setFlag("no-slots", !v)} />
              <Toggle label="Embedding" hint="Restrict to embedding-only mode" checked={hasFlag("embedding")} onChange={(v) => setFlag("embedding", v)} />
              <Toggle label="Reranking" hint="Enable reranking endpoint" checked={hasFlag("reranking")} onChange={(v) => setFlag("reranking", v)} />
              <Toggle label="Warmup" hint="Perform warmup run on start (default: on)" checked={!hasFlag("no-warmup")} onChange={(v) => setFlag("no-warmup", !v)} />
            </div>
            <div className="grid grid-cols-1 gap-3 mt-2">
              <TextInput label="Tools (EXPERIMENTAL)" hint="Built-in tools to enable: read_file, file_glob_search, grep_search, exec_shell_command, write_file, edit_file, apply_diff, or 'all'"
                value={getEp("tools")} onChange={(v) => setEp("tools", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <TextInput label="Embedding Separator" hint="Separator between embeddings (default: \\n)" value={getEp("embd-separator")}
                onChange={(v) => setEp("embd-separator", v)} />
              <TextInput label="Classification Separator" hint="Separator for classification sequences (default: \\t)" value={getEp("cls-separator")}
                onChange={(v) => setEp("cls-separator", v)} />
            </div>
            <Section title="SSL" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="SSL Key File" value={getEp("ssl-key-file")} onChange={(v) => setEp("ssl-key-file", v)} />
              <TextInput label="SSL Cert File" value={getEp("ssl-cert-file")} onChange={(v) => setEp("ssl-cert-file", v)} />
            </div>
            <Section title="Paths" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Static Files Path" value={getEp("path")} onChange={(v) => setEp("path", v)} />
              <TextInput label="Slot Save Path" hint="Path to save slot KV cache" value={getEp("slot-save-path")}
                onChange={(v) => setEp("slot-save-path", v)} />
              <TextInput label="Media Path" hint="Directory for local media files" value={getEp("media-path")}
                onChange={(v) => setEp("media-path", v)} />
              <TextInput label="WebUI Config (JSON)" hint="JSON string overriding WebUI defaults" value={getEp("webui-config")}
                onChange={(v) => setEp("webui-config", v)} />
              <TextInput label="WebUI Config File" hint="JSON file providing default WebUI settings" value={getEp("webui-config-file")}
                onChange={(v) => setEp("webui-config-file", v)} />
            </div>
          </>}

          {activeTab === "Chat" && <>
            <Section title="Chat Template" />
            <div className="grid grid-cols-1 gap-3">
              <TextInput label="Chat Template" hint="Jinja template name or inline template" value={getEp("chat-template")}
                onChange={(v) => setEp("chat-template", v)} />
              <TextInput label="Chat Template File" hint="Path to Jinja template file" value={getEp("chat-template-file")}
                onChange={(v) => setEp("chat-template-file", v)} />
              <TextInput label="Chat Template Kwargs" hint="JSON object for template params" value={getEp("chat-template-kwargs")}
                placeholder='{"key":"value"}' onChange={(v) => setEp("chat-template-kwargs", v)} />
            </div>
            <div className="space-y-3 mt-2">
              <Toggle label="Jinja" hint="Use Jinja template engine (default: on)" checked={!hasFlag("no-jinja")} onChange={(v) => setFlag("no-jinja", !v)} />
              <Toggle label="Prefill Assistant" hint="Prefill assistant response if last message is assistant (default: on)"
                checked={!hasFlag("no-prefill-assistant")} onChange={(v) => setFlag("no-prefill-assistant", !v)} />
              <Toggle label="Skip Chat Parsing" hint="Force pure content parser, skip tool/reasoning extraction"
                checked={hasFlag("skip-chat-parsing")} onChange={(v) => setFlag("skip-chat-parsing", v)} />
            </div>
            <Section title="Reasoning" />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput label="Reasoning" hint="Enable thinking" value={getEp("reasoning") || "auto"}
                options={[{ value: "auto", label: "Auto (default)" }, { value: "on", label: "On" }, { value: "off", label: "Off" }]}
                onChange={(v) => setEp("reasoning", v === "auto" ? "" : v)} />
              <SelectInput label="Reasoning Format" value={getEp("reasoning-format") || "auto"}
                options={[{ value: "auto", label: "Auto (default)" }, { value: "none", label: "None" }, { value: "deepseek", label: "DeepSeek" }, { value: "deepseek-legacy", label: "DeepSeek Legacy" }]}
                onChange={(v) => setEp("reasoning-format", v === "auto" ? "" : v)} />
              <NumberInput label="Reasoning Budget" hint="-1=unrestricted (default), 0=immediate end" value={getEpNum("reasoning-budget")}
                onChange={(v) => setEpNum("reasoning-budget", v)} />
              <TextInput label="Budget Message" hint="Message injected when budget exhausted" value={getEp("reasoning-budget-message")}
                onChange={(v) => setEp("reasoning-budget-message", v)} />
            </div>
            <Section title="Output" />
            <div className="space-y-3">
              <Toggle label="Escape Sequences" hint="Process \\n, \\t etc (default: on)" checked={!hasFlag("no-escape")} onChange={(v) => setFlag("no-escape", !v)} />
              <Toggle label="Special Tokens" hint="Output special tokens" checked={hasFlag("special")} onChange={(v) => setFlag("special", v)} />
              <Toggle label="Verbose Prompt" hint="Print verbose prompt before generation" checked={hasFlag("verbose-prompt")} onChange={(v) => setFlag("verbose-prompt", v)} />
              <Toggle label="SPM Infill" hint="Use Suffix/Prefix/Middle infill pattern" checked={hasFlag("spm-infill")} onChange={(v) => setFlag("spm-infill", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <SelectInput label="Pooling" hint="Embedding pooling type" value={getEp("pooling") || ""}
                options={[{ value: "", label: "Model default" }, { value: "none", label: "None" }, { value: "mean", label: "Mean" }, { value: "cls", label: "CLS" }, { value: "last", label: "Last" }, { value: "rank", label: "Rank" }]}
                onChange={(v) => setEp("pooling", v)} />
            </div>
          </>}

          {activeTab === "Advanced" && <>
            <Section title="RoPE" />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput label="RoPE Scaling" value={getEp("rope-scaling") || ""}
                options={[{ value: "", label: "Default" }, { value: "none", label: "None" }, { value: "linear", label: "Linear" }, { value: "yarn", label: "YaRN" }]}
                onChange={(v) => setEp("rope-scaling", v)} />
              <NumberInput label="RoPE Scale" hint="Context scaling factor" value={getEpNum("rope-scale")} step={0.1}
                onChange={(v) => setEpNum("rope-scale", v)} />
              <NumberInput label="RoPE Freq Base" value={config.rope_freq_base} step={1000}
                onChange={(v) => setConfig((c) => ({ ...c, rope_freq_base: v }))} />
              <NumberInput label="RoPE Freq Scale" value={config.rope_freq_scale} step={0.001}
                onChange={(v) => setConfig((c) => ({ ...c, rope_freq_scale: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <NumberInput label="YaRN Orig Ctx" value={getEpNum("yarn-orig-ctx")} onChange={(v) => setEpNum("yarn-orig-ctx", v)} />
              <NumberInput label="YaRN Ext Factor" hint="-1 default, 0=full interp" value={getEpNum("yarn-ext-factor")} step={0.1}
                onChange={(v) => setEpNum("yarn-ext-factor", v)} />
              <NumberInput label="YaRN Attn Factor" value={getEpNum("yarn-attn-factor")} step={0.1}
                onChange={(v) => setEpNum("yarn-attn-factor", v)} />
              <NumberInput label="YaRN Beta Slow" value={getEpNum("yarn-beta-slow")} step={0.1}
                onChange={(v) => setEpNum("yarn-beta-slow", v)} />
              <NumberInput label="YaRN Beta Fast" value={getEpNum("yarn-beta-fast")} step={0.1}
                onChange={(v) => setEpNum("yarn-beta-fast", v)} />
            </div>
            <Section title="Speculative Decoding" />
            <div className="space-y-3">
              <Toggle label="Default Speculative Config"
                hint="Enable a sensible default (ngram-mod with n_match=24, n_min=48, n_max=64). Quick way to try spec decoding."
                checked={hasFlag("spec-default")} onChange={(v) => setFlag("spec-default", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <TextInput label="Draft Model" hint="Path to draft model for speculation" value={getEp("spec-draft-model")}
                onChange={(v) => setEp("spec-draft-model", v)} />
              <SelectInput label="Spec Type" hint="draft-* types use the draft model; ngram-* types do not" value={getEp("spec-type") || ""}
                options={[{ value: "", label: "None" },
                  { value: "draft-simple", label: "Draft Simple" }, { value: "draft-eagle3", label: "Draft EAGLE3" }, { value: "draft-mtp", label: "Draft MTP" },
                  { value: "ngram-cache", label: "N-gram Cache" }, { value: "ngram-simple", label: "N-gram Simple" },
                  { value: "ngram-map-k", label: "N-gram Map K" }, { value: "ngram-map-k4v", label: "N-gram Map K4V" }, { value: "ngram-mod", label: "N-gram Mod" }]}
                onChange={(v) => setEp("spec-type", v)} />
              <NumberInput label="Draft Max" hint="Max draft tokens (default: 16)" value={getEpNum("spec-draft-n-max")} min={1}
                onChange={(v) => setEpNum("spec-draft-n-max", v)} />
              <NumberInput label="Draft Min" hint="Min draft tokens (default: 0)" value={getEpNum("spec-draft-n-min")} min={0}
                onChange={(v) => setEpNum("spec-draft-n-min", v)} />
              <NumberInput label="Draft P Min" hint="Min probability for greedy (default: 0.75)" value={getEpNum("spec-draft-p-min")} step={0.01}
                onChange={(v) => setEpNum("spec-draft-p-min", v)} />
              <NumberInput label="Draft P Split" hint="Speculative split probability" value={getEpNum("spec-draft-p-split")} step={0.01}
                onChange={(v) => setEpNum("spec-draft-p-split", v)} />
              <NumberInput label="Draft Ctx Size" hint="0 = from model" value={getEpNum("spec-draft-ctx-size")} min={0}
                onChange={(v) => setEpNum("spec-draft-ctx-size", v)} />
              <NumberInput label="Draft GPU Layers" value={getEpNum("spec-draft-ngl")}
                onChange={(v) => setEpNum("spec-draft-ngl", v)} />
              <NumberInput label="Draft Threads" hint="CPU threads for draft model generation" value={getEpNum("spec-draft-threads")}
                onChange={(v) => setEpNum("spec-draft-threads", v)} />
              <NumberInput label="Draft Batch Threads" hint="Threads for draft model batch/prompt processing" value={getEpNum("spec-draft-threads-batch")}
                onChange={(v) => setEpNum("spec-draft-threads-batch", v)} />
              <TextInput label="Draft Device" hint="Devices for draft model, comma-separated" value={getEp("spec-draft-device")}
                onChange={(v) => setEp("spec-draft-device", v)} />
              <SelectInput label="Draft KV Cache Type (K)" hint="KV cache K data type for draft model" value={getEp("spec-draft-type-k") || "f16"}
                options={KV_TYPES.map((t) => ({ value: t, label: t }))}
                onChange={(v) => setEp("spec-draft-type-k", v === "f16" ? "" : v)} />
              <SelectInput label="Draft KV Cache Type (V)" hint="KV cache V data type for draft model" value={getEp("spec-draft-type-v") || "f16"}
                options={KV_TYPES.map((t) => ({ value: t, label: t }))}
                onChange={(v) => setEp("spec-draft-type-v", v === "f16" ? "" : v)} />
            </div>
            {getEp("spec-type") === "ngram-mod" && (
              <div className="grid grid-cols-3 gap-3 mt-2">
                <NumberInput label="ngram-mod N Min" hint="Default: 48" value={getEpNum("spec-ngram-mod-n-min")} min={0}
                  onChange={(v) => setEpNum("spec-ngram-mod-n-min", v)} />
                <NumberInput label="ngram-mod N Max" hint="Default: 64" value={getEpNum("spec-ngram-mod-n-max")} min={0}
                  onChange={(v) => setEpNum("spec-ngram-mod-n-max", v)} />
                <NumberInput label="ngram-mod Match" hint="Lookup length (default: 24)" value={getEpNum("spec-ngram-mod-n-match")} min={1}
                  onChange={(v) => setEpNum("spec-ngram-mod-n-match", v)} />
              </div>
            )}
            {getEp("spec-type") === "ngram-simple" && (
              <div className="grid grid-cols-3 gap-3 mt-2">
                <NumberInput label="ngram-simple Size N" hint="Lookup n-gram length" value={getEpNum("spec-ngram-simple-size-n")} min={1}
                  onChange={(v) => setEpNum("spec-ngram-simple-size-n", v)} />
                <NumberInput label="ngram-simple Size M" hint="Draft m-gram length" value={getEpNum("spec-ngram-simple-size-m")} min={1}
                  onChange={(v) => setEpNum("spec-ngram-simple-size-m", v)} />
                <NumberInput label="ngram-simple Min Hits" value={getEpNum("spec-ngram-simple-min-hits")} min={1}
                  onChange={(v) => setEpNum("spec-ngram-simple-min-hits", v)} />
              </div>
            )}
            {getEp("spec-type") === "ngram-map-k" && (
              <div className="grid grid-cols-3 gap-3 mt-2">
                <NumberInput label="ngram-map-k Size N" hint="Lookup n-gram length" value={getEpNum("spec-ngram-map-k-size-n")} min={1}
                  onChange={(v) => setEpNum("spec-ngram-map-k-size-n", v)} />
                <NumberInput label="ngram-map-k Size M" hint="Draft m-gram length" value={getEpNum("spec-ngram-map-k-size-m")} min={1}
                  onChange={(v) => setEpNum("spec-ngram-map-k-size-m", v)} />
                <NumberInput label="ngram-map-k Min Hits" value={getEpNum("spec-ngram-map-k-min-hits")} min={1}
                  onChange={(v) => setEpNum("spec-ngram-map-k-min-hits", v)} />
              </div>
            )}
            {getEp("spec-type") === "ngram-map-k4v" && (
              <div className="grid grid-cols-3 gap-3 mt-2">
                <NumberInput label="ngram-map-k4v Size N" hint="Lookup n-gram length" value={getEpNum("spec-ngram-map-k4v-size-n")} min={1}
                  onChange={(v) => setEpNum("spec-ngram-map-k4v-size-n", v)} />
                <NumberInput label="ngram-map-k4v Size M" hint="Draft m-gram length" value={getEpNum("spec-ngram-map-k4v-size-m")} min={1}
                  onChange={(v) => setEpNum("spec-ngram-map-k4v-size-m", v)} />
                <NumberInput label="ngram-map-k4v Min Hits" value={getEpNum("spec-ngram-map-k4v-min-hits")} min={1}
                  onChange={(v) => setEpNum("spec-ngram-map-k4v-min-hits", v)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <TextInput label="Lookup Cache (Static)" hint="Read-only lookup cache file for lookup decoding" value={getEp("lookup-cache-static")}
                onChange={(v) => setEp("lookup-cache-static", v)} />
              <TextInput label="Lookup Cache (Dynamic)" hint="Lookup cache file updated by generation" value={getEp("lookup-cache-dynamic")}
                onChange={(v) => setEp("lookup-cache-dynamic", v)} />
            </div>
            <Section title="LoRA & Control Vectors" />
            <div className="grid grid-cols-1 gap-3">
              <TextInput label="LoRA" hint="Comma-separated adapter paths" value={getEp("lora")}
                onChange={(v) => setEp("lora", v)} />
              <TextInput label="LoRA Scaled" hint="FNAME:SCALE,... format" value={getEp("lora-scaled")}
                onChange={(v) => setEp("lora-scaled", v)} />
              <TextInput label="Control Vector" hint="Comma-separated paths" value={getEp("control-vector")}
                onChange={(v) => setEp("control-vector", v)} />
              <TextInput label="Control Vector Scaled" hint="FNAME:SCALE,... format" value={getEp("control-vector-scaled")}
                onChange={(v) => setEp("control-vector-scaled", v)} />
            </div>
            <Toggle label="LoRA Init Without Apply" hint="Load adapters without applying (use POST /lora-adapters later)"
              checked={hasFlag("lora-init-without-apply")} onChange={(v) => setFlag("lora-init-without-apply", v)} />
            <Section title="Multimodal" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="mmproj URL" value={getEp("mmproj-url")}
                onChange={(v) => setEp("mmproj-url", v)} />
              <NumberInput label="Image Min Tokens" value={getEpNum("image-min-tokens")} min={0}
                onChange={(v) => setEpNum("image-min-tokens", v)} />
              <NumberInput label="Image Max Tokens" value={getEpNum("image-max-tokens")} min={0}
                onChange={(v) => setEpNum("image-max-tokens", v)} />
            </div>
            <div className="space-y-3 mt-2">
              <Toggle label="mmproj Offload" hint="GPU offload for multimodal projector (default: on)"
                checked={!hasFlag("no-mmproj-offload")} onChange={(v) => setFlag("no-mmproj-offload", !v)} />
              <Toggle label="mmproj Auto" hint="Auto-use multimodal projector if available (default: on)"
                checked={!hasFlag("no-mmproj")} onChange={(v) => setFlag("no-mmproj", !v)} />
            </div>
            <Section title="TTS / Audio" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Vocoder Model" hint="Path to vocoder model for audio/TTS generation" value={getEp("model-vocoder")}
                onChange={(v) => setEp("model-vocoder", v)} />
            </div>
            <div className="space-y-3 mt-2">
              <Toggle label="TTS Guide Tokens" hint="Use guide tokens to improve TTS word recall" checked={hasFlag("tts-use-guide-tokens")} onChange={(v) => setFlag("tts-use-guide-tokens", v)} />
            </div>
            <Section title="CPU Affinity" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="CPU Mask" hint="Hex affinity mask" value={getEp("cpu-mask")} onChange={(v) => setEp("cpu-mask", v)} />
              <TextInput label="CPU Range" hint="lo-hi range" value={getEp("cpu-range")} onChange={(v) => setEp("cpu-range", v)} />
              <SelectInput label="CPU Strict" value={getEp("cpu-strict") || "0"}
                options={[{ value: "0", label: "Off (default)" }, { value: "1", label: "On" }]}
                onChange={(v) => setEp("cpu-strict", v === "0" ? "" : v)} />
              <SelectInput label="Priority" value={getEp("prio") || "0"}
                options={[{ value: "-1", label: "Low" }, { value: "0", label: "Normal (default)" }, { value: "1", label: "Medium" }, { value: "2", label: "High" }, { value: "3", label: "Realtime" }]}
                onChange={(v) => setEp("prio", v === "0" ? "" : v)} />
              <NumberInput label="Poll" hint="Polling level 0-100 (default: 50)" value={getEpNum("poll")} min={0} max={100}
                onChange={(v) => setEpNum("poll", v)} />
            </div>
            <Section title="Logging" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Log File" value={getEp("log-file")} onChange={(v) => setEp("log-file", v)} />
              <SelectInput label="Log Colors" value={getEp("log-colors") || "auto"}
                options={[{ value: "auto", label: "Auto" }, { value: "on", label: "On" }, { value: "off", label: "Off" }]}
                onChange={(v) => setEp("log-colors", v === "auto" ? "" : v)} />
              <SelectInput label="Verbosity" value={getEp("log-verbosity") || "3"}
                options={[{ value: "0", label: "0 - Generic" }, { value: "1", label: "1 - Error" }, { value: "2", label: "2 - Warning" }, { value: "3", label: "3 - Info (default)" }, { value: "4", label: "4 - Debug" }]}
                onChange={(v) => setEp("log-verbosity", v === "3" ? "" : v)} />
            </div>
            <div className="space-y-3 mt-2">
              <Toggle label="Verbose" hint="Log all messages" checked={hasFlag("verbose")} onChange={(v) => setFlag("verbose", v)} />
              <Toggle label="Perf Timings" hint="Internal libllama performance timings" checked={hasFlag("perf")} onChange={(v) => setFlag("perf", v)} />
              <Toggle label="Log Prefix" hint="Add prefix to log messages" checked={hasFlag("log-prefix")} onChange={(v) => setFlag("log-prefix", v)} />
              <Toggle label="Log Timestamps" hint="Add timestamps to log messages" checked={hasFlag("log-timestamps")} onChange={(v) => setFlag("log-timestamps", v)} />
              <Toggle label="Offline" hint="Prevent network access, use cache only" checked={hasFlag("offline")} onChange={(v) => setFlag("offline", v)} />
              <Toggle label="Profile" hint="Enable cross-backend profiling (CPU, BLAS, CUDA)" checked={hasFlag("profile")} onChange={(v) => setFlag("profile", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <TextInput label="Profile Output" hint="Write profiling JSON to file (default: stdout)" value={getEp("profile-output")}
                onChange={(v) => setEp("profile-output", v)} />
            </div>
            <Section title="Extra Arguments" />
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-3)" }}>Raw CLI Arguments</label>
              <p className="text-xs mb-1 text-hint">Any additional flags not covered above, space-separated</p>
              <input type="text" className="glass-input font-mono text-xs"
                value={getEp("__raw__")} placeholder="e.g. --reverse-prompt '### Human:'"
                onChange={(e) => setEp("__raw__", e.target.value)} />
            </div>
          </>}
        </div>

        <FallbackProgress steps={fallbackSteps} total={fallbackTotal.current} />

        {/* Server logs */}
        <div className="glass-card-static p-5">
          <button className="w-full flex items-center justify-between" onClick={() => setShowLogs(!showLogs)}>
            <div className="flex items-center gap-2">
              <Terminal size={15} className="text-hint" />
              <span className="text-sm font-medium" style={{ color: "var(--text-3)" }}>Server Logs</span>
              {logs.length > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--bg-1)", color: "var(--text-4)" }}>
                  {logs.length}
                </span>
              )}
            </div>
            {showLogs ? <ChevronUp size={14} className="text-hint" /> : <ChevronDown size={14} className="text-hint" />}
          </button>
          {showLogs && (
            <div
              ref={logsRef}
              className="mt-3 p-3 h-64 overflow-y-auto font-mono text-xs space-y-0.5 rounded-xl"
              style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-1)" }}
            >
              {logs.length === 0 ? (
                <span className="text-hint">No logs yet…</span>
              ) : logs.map((line, i) => {
                let color = "var(--text-4)";
                let icon = null;

                if (line.startsWith("[success]")) {
                  color = "rgba(74,222,128,0.9)";
                  icon = "✓";
                } else if (line.startsWith("[fallback]")) {
                  color = "rgba(96,165,250,0.9)";
                  icon = "↻";
                } else if (line.startsWith("[error]") || line.toLowerCase().includes("error")) {
                  color = "rgba(248,113,113,0.9)";
                  icon = "✗";
                } else if (line.startsWith("[stderr]") && line.toLowerCase().includes("warn")) {
                  color = "rgba(251,191,36,0.7)";
                } else if (line.startsWith("[stderr]")) {
                  color = "var(--text-5)";
                } else if (line.startsWith("$ ")) {
                  color = "var(--text-2)";
                  icon = "›";
                } else if (line.includes("listening on")) {
                  color = "rgba(74,222,128,0.9)";
                  icon = "●";
                } else if (line.includes("loading model")) {
                  color = "rgba(167,139,250,0.9)";
                } else if (line.includes("loaded multimodal")) {
                  color = "rgba(34,211,238,0.9)";
                } else if (line.includes("loaded model")) {
                  color = "rgba(167,139,250,0.9)";
                }

                return (
                  <div key={i} className="flex items-start gap-1.5 leading-relaxed" style={{ color }}>
                    {icon && <span className="shrink-0 w-3 text-center opacity-70">{icon}</span>}
                    <span className="whitespace-pre-wrap break-all">{line}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

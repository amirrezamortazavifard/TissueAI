import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLocation } from "react-router-dom";
import {
  Settings as SettingsIcon,
  Trash2,
  RefreshCw,
  Download,
  Play,
  Square,
  FolderOpen,
  FileText,
  HardDrive,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  Globe,
  Cpu,
  Shield,
} from "lucide-react";
import type { OpenWebUIStatus, ProgressPayload, InstallPhase, PythonVersion, PlatformInfo, PrereqCheck } from "./types";
import { phaseStringToType } from "./Chat";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatSpeed(bps: number): string {
  if (bps === 0) return "0 B/s";
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1048576) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1048576).toFixed(1)} MB/s`;
}

function formatEta(secs: number): string {
  if (secs <= 0) return "calculating...";
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${(secs % 3600) / 60}m`;
}

function getPhaseLabel(phase: InstallPhase): string {
  switch (phase.type) {
    case "idle": return "Ready";
    case "init": return "Initializing";
    case "discovering_versions": return "Discovering Versions";
    case "version_select": return "Select Version";
    case "detecting_platform": return "Detecting Platform";
    case "validating_prereqs": return "Validating";
    case "checking_python": return "Checking Python";
    case "downloading_python": return "Downloading Python";
    case "extracting_python": return "Extracting Python";
    case "configuring_python": return "Configuring Python";
    case "downloading_get_pip": return "Downloading get-pip.py";
    case "installing_pip": return "Installing pip";
    case "installing_open_webui": return "Installing Open WebUI";
    case "verifying": return "Verifying";
    case "starting": return "Starting Server";
    case "running": return "Running";
    case "error": return "Error";
    case "paused": return "Paused";
    default: return "Unknown";
  }
}

interface PythonStatus {
  python_dir: string;
  python_exists: boolean;
  pip_installed: boolean;
  open_webui_installed: boolean;
  version: string | null;
  system_python: SystemPythonInfo | null;
}

interface SystemPythonInfo {
  path: string;
  version: string;
  pip_available: boolean;
}

interface DiskInfo {
  python_size: number;
  data_size: number;
  total_size: number;
}

// ── Section Component ──────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden glass-card-static">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:opacity-80 transition-opacity"
        onClick={() => setOpen(!open)}
      >
        <span className="text-primary">{icon}</span>
        <span className="flex-1 font-semibold text-hero text-sm">{title}</span>
        {open ? <ChevronUp size={16} className="text-hint" /> : <ChevronDown size={16} className="text-hint" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0 space-y-4" style={{ borderTop: "1px solid var(--border-1)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function LlmSettings() {
  const location = useLocation();
  const [status, setStatus] = useState<OpenWebUIStatus>({
    installed: false,
    running: false,
    installing: false,
    paused: false,
    port: 8082,
    url: "http://127.0.0.1:8082",
    pid: null,
    data_dir: "",
    venv_dir: "",
    python_dir: "",
    error: null,
    progress: null,
    phase: { type: "idle" },
    overall_percent: 0,
    elapsed_secs: 0,
    logs: [],
    selected_version: null,
    selected_variant: null,
    platform_info: null,
  });
  const [pythonStatus, setPythonStatus] = useState<PythonStatus | null>(null);
  const [diskInfo, setDiskInfo] = useState<DiskInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uninstalling, setUninstalling] = useState(false);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [startingInstall, setStartingInstall] = useState(false);
  const [startingServer, setStartingServer] = useState(false);
  const [versions, setVersions] = useState<PythonVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [prereqs, setPrereqs] = useState<PrereqCheck[]>([]);
  const [validatingPrereqs, setValidatingPrereqs] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      const [s, py, disk, logLines] = await Promise.all([
        invoke<OpenWebUIStatus>("llm_get_open_webui_status").catch(() => status),
        invoke<PythonStatus>("llm_check_python_status").catch(() => null),
        invoke<DiskInfo>("llm_get_open_webui_disk_usage").catch(() => null),
        invoke<string[]>("llm_get_open_webui_logs").catch(() => []),
      ]);
      setStatus(s);
      setPythonStatus(py);
      setDiskInfo(disk);
      setLogs(logLines);
    } catch (e) {
      console.error("Failed to load settings data:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    setLoadingVersions(true);
    try {
      const [vers, plat] = await Promise.all([
        invoke<PythonVersion[]>("llm_discover_python_versions").catch(() => []),
        invoke<PlatformInfo>("llm_detect_platform").catch(() => null),
      ]);
      setVersions(vers);
      setPlatform(plat);
    } catch (e) {
      console.error("Failed to load versions:", e);
    } finally {
      setLoadingVersions(false);
    }
  };

  const loadPrereqs = async () => {
    setValidatingPrereqs(true);
    try {
      const checks = await invoke<PrereqCheck[]>("llm_validate_prereqs").catch(() => []);
      setPrereqs(checks);
    } catch (e) {
      console.error("Failed to load prereqs:", e);
    } finally {
      setValidatingPrereqs(false);
    }
  };

  useEffect(() => {
    loadData();
    loadVersions();
    loadPrereqs();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Handle deep link from Chat page
  useEffect(() => {
    const state = location.state as { tab?: string; action?: string } | null;
    if (state?.tab === "api" && state?.action === "install") {
      // Auto-trigger installation if not already installed/instaling
      if (!status.installed && !status.installing && !startingInstall) {
        handleInstall();
      }
    }
  }, [location.state]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  // Listen for progress events
  useEffect(() => {
    const unlisten = (window as any).__TAURI__?.event?.listen?.(
      "open_webui_progress",
      (event: { payload: ProgressPayload }) => {
        const payload = event.payload;
        const phase = phaseStringToType(payload.phase.current, payload.phase.sub_phase, payload.metrics);
        setStatus((prev) => ({
          ...prev,
          phase,
          overall_percent: payload.progress.overall_percent,
          progress: payload.message,
          elapsed_secs: payload.metrics.elapsed_secs,
          installing: !payload.phase.is_terminal && !payload.phase.is_error && payload.phase.current !== "idle",
        }));
      }
    );
    return () => { unlisten?.then?.((fn: () => void) => fn()); };
  }, []);

  const handleInstall = () => {
    setStartingInstall(true);
    setStatus(prev => ({
      ...prev,
      installing: true,
      phase: { type: "init", sub_phase: "checking_existing", percent: 0, detail: "Starting installation..." },
      progress: "Starting installation...",
    }));
    invoke("llm_install_full").catch(() => setStartingInstall(false));
  };

  const handleUninstall = async () => {
    setUninstalling(true);
    try {
      await invoke("llm_uninstall_open_webui");
      await loadData();
    } catch (e) {
      console.error("Uninstall failed:", e);
    } finally {
      setUninstalling(false);
      setShowUninstallConfirm(false);
    }
  };

  const handleCopyDir = (path: string) => {
    navigator.clipboard.writeText(path);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <Loader2 size={24} className="animate-spin text-primary" />
        <p className="text-sm text-hint">Loading settings...</p>
      </div>
    );
  }

  const isInstalling = status.installing || startingInstall;
  const isRunning = status.running;
  const isInstalled = status.installed;
  const hasError = status.phase.type === "error" || status.error;

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-1)" }}>
        <SettingsIcon size={18} className="text-primary" />
        <h1 className="text-base font-bold text-hero">API Chat Settings</h1>
        <div className="flex-1" />
        <span className={`text-xs px-2.5 py-1 rounded-full ${
          isRunning ? "bg-green-500/15 text-green-400" :
          isInstalling ? "bg-primary/15 text-primary" :
          isInstalled ? "bg-yellow-500/15 text-yellow-400" :
          "bg-red-500/15 text-red-400"
        }`}>
          {isRunning ? "Running" : isInstalling ? "Installing..." : isInstalled ? "Installed" : "Not Installed"}
        </span>
      </div>

      <div className="flex-1 p-6 space-y-5">
        {/* ── Server Status ── */}
        <Section title="Open WebUI Server" icon={<Play size={16} />}>
          <div className="space-y-3">
            {/* Status row */}
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-1)" }}>
              <div className={`w-2.5 h-2.5 rounded-full ${isRunning ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
              <span className="text-sm text-hero font-medium">
                {isRunning ? "Server Running" : isInstalling ? "Installing..." : "Server Stopped"}
              </span>
              {isRunning && (
                <span className="text-xs text-hint font-mono ml-auto">{status.url}</span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {isRunning ? (
                <button
                  className="btn-glass !px-3 !py-2 !text-xs flex items-center gap-2"
                  onClick={() => {
                    setStatus(prev => ({ ...prev, running: false }));
                    invoke("llm_stop_open_webui");
                  }}
                >
                  <Square size={13} /> Stop Server
                </button>
              ) : !isInstalling ? (
                <button
                  className="btn-accent !px-3 !py-2 !text-xs flex items-center gap-2"
                  onClick={() => {
                    setStartingServer(true);
                    invoke("llm_start_open_webui").catch(() => setStartingServer(false));
                  }}
                  disabled={!isInstalled || startingServer}
                >
                  {startingServer ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  {startingServer ? "Starting..." : "Start Server"}
                </button>
              ) : null}
              <button
                className="btn-glass !px-3 !py-2 !text-xs flex items-center gap-2"
                onClick={loadData}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {/* Install progress */}
            {isInstalling && (
              <div className="p-3 rounded-lg space-y-2" style={{ background: "var(--bg-1)" }}>
                <div className="flex justify-between text-xs text-hint">
                  <span>{getPhaseLabel(status.phase)}</span>
                  <span>{status.overall_percent.toFixed(1)}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-3)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${status.overall_percent}%`, background: "var(--primary)" }}
                  />
                </div>
                {status.progress && (
                  <p className="text-[11px] text-hint opacity-70">{status.progress}</p>
                )}

                {/* Sub-phase indicator */}
                {status.phase.type !== "idle" && status.phase.type !== "running" && status.phase.type !== "error" && (() => {
                  const phase = status.phase;
                  let subPhase = "";
                  let detail = "";
                  switch (phase.type) {
                    case "checking_python": subPhase = phase.sub_phase; detail = phase.detail; break;
                    case "downloading_python": subPhase = phase.sub_phase; detail = `Speed: ${formatSpeed(phase.speed_bps)} | ${formatBytes(phase.bytes_downloaded)} / ${formatBytes(phase.total_bytes)} | ETA: ${formatEta(Math.floor(phase.eta_secs))}`; break;
                    case "extracting_python": subPhase = phase.sub_phase; detail = `Files: ${phase.files_extracted} / ${phase.total_files}`; break;
                    case "configuring_python": subPhase = phase.sub_phase; detail = phase.detail; break;
                    case "downloading_get_pip": subPhase = phase.sub_phase; detail = `Speed: ${formatSpeed(phase.speed_bps)} | ${formatBytes(phase.bytes_downloaded)} / ${formatBytes(phase.total_bytes)}`; break;
                    case "installing_pip": subPhase = phase.sub_phase; detail = phase.detail; break;
                    case "installing_open_webui": subPhase = phase.sub_phase; detail = `Packages: ${phase.packages_installed} / ${phase.total_packages}`; break;
                    case "starting": subPhase = phase.sub_phase; detail = phase.detail; break;
                  }
                  return (
                    <div className="text-[10px] text-hint space-y-0.5">
                      <div className="flex justify-between">
                        <span>[{subPhase}]</span>
                        <span>{status.elapsed_secs.toFixed(1)}s elapsed</span>
                      </div>
                      {detail && <div className="opacity-70 truncate">{detail}</div>}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Error */}
            {hasError && (
              <div className="p-3 rounded-lg flex items-start gap-2" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
                <p className="text-xs text-red-300 break-all">{status.error || "Unknown error"}</p>
              </div>
            )}
          </div>
        </Section>

        {/* ── Python Environment ── */}
        <Section title="Python Environment" icon={<Info size={16} />}>
          {pythonStatus ? (
            <div className="space-y-3">
              {/* Python status */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg" style={{ background: "var(--bg-1)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    {pythonStatus.python_exists ? (
                      <CheckCircle size={13} className="text-green-400" />
                    ) : (
                      <AlertCircle size={13} className="text-red-400" />
                    )}
                    <span className="text-xs text-hint">Python</span>
                  </div>
                  <p className="text-sm text-hero font-medium">
                    {pythonStatus.python_exists ? `v${pythonStatus.version || "?"}` : "Not Found"}
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "var(--bg-1)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    {pythonStatus.pip_installed ? (
                      <CheckCircle size={13} className="text-green-400" />
                    ) : (
                      <AlertCircle size={13} className="text-red-400" />
                    )}
                    <span className="text-xs text-hint">pip</span>
                  </div>
                  <p className="text-sm text-hero font-medium">
                    {pythonStatus.pip_installed ? "Installed" : "Not Found"}
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "var(--bg-1)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    {pythonStatus.open_webui_installed ? (
                      <CheckCircle size={13} className="text-green-400" />
                    ) : (
                      <AlertCircle size={13} className="text-red-400" />
                    )}
                    <span className="text-xs text-hint">Open WebUI</span>
                  </div>
                  <p className="text-sm text-hero font-medium">
                    {pythonStatus.open_webui_installed ? "Installed" : "Not Found"}
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "var(--bg-1)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <HardDrive size={13} className="text-primary" />
                    <span className="text-xs text-hint">Disk Usage</span>
                  </div>
                  <p className="text-sm text-hero font-medium">
                    {diskInfo ? formatBytes(diskInfo.total_size) : "—"}
                  </p>
                </div>
              </div>

              {/* Python directory */}
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--bg-1)" }}>
                <FolderOpen size={13} className="text-hint shrink-0" />
                <span className="text-[11px] text-hint truncate flex-1 font-mono">{pythonStatus.python_dir}</span>
                <button
                  className="text-hint hover:text-hero transition-colors"
                  onClick={() => handleCopyDir(pythonStatus.python_dir)}
                  title="Copy path"
                >
                  <Copy size={12} />
                </button>
              </div>

              {/* System Python Info */}
              {pythonStatus.system_python && (
                <div className="p-2 rounded-lg flex items-center gap-2" style={{ background: "var(--bg-1)" }}>
                  <CheckCircle size={12} className="text-green-400" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-hint">System Python:</span>
                      <span className="text-[11px] font-medium text-hero">v{pythonStatus.system_python.version}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {pythonStatus.system_python.pip_available ? (
                        <CheckCircle size={10} className="text-green-400" />
                      ) : (
                        <AlertCircle size={10} className="text-yellow-400" />
                      )}
                      <span className="text-[10px] text-hint">
                        {pythonStatus.system_python.pip_available ? "pip available" : "pip not available"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <FolderOpen size={10} className="text-hint shrink-0" />
                      <span className="text-[10px] text-hint font-mono truncate">{pythonStatus.system_python.path}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Disk breakdown */}
              {diskInfo && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-hint">
                    <span>Python + pip + Open WebUI</span>
                    <span>{formatBytes(diskInfo.python_size)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-hint">
                    <span>User Data (models, cache)</span>
                    <span>{formatBytes(diskInfo.data_size)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-hint">Python not detected. Click Install to set up.</p>
          )}
        </Section>

        {/* ── Python Version Selector ── */}
        <Section title="Python Version" icon={<Globe size={16} />}>
          {loadingVersions ? (
            <div className="flex items-center gap-2 text-xs text-hint">
              <Loader2 size={14} className="animate-spin" />
              <span>Fetching versions from GitHub...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {platform && (
                <div className="flex items-center gap-2 text-[11px] text-hint">
                  <Cpu size={12} />
                  <span>Platform: {platform.os} {platform.arch} ({platform.os_version})</span>
                  <span className="text-hint opacity-50">|</span>
                  <span>Variant: {platform.recommended_variant}</span>
                </div>
              )}
              {versions.length > 0 ? (
                <div className="space-y-1.5">
                  {versions.map((v) => (
                    <div
                      key={v.version}
                      className={`p-2.5 rounded-lg cursor-pointer transition-all ${
                        v.recommended
                          ? "ring-1 ring-primary/30 bg-primary/5"
                          : "hover:bg-white/5"
                      }`}
                      style={{ background: v.recommended ? undefined : "var(--bg-1)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-hero font-medium">Python {v.version}</span>
                        {v.recommended && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                            Recommended
                          </span>
                        )}
                        {v.is_latest && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">
                            Latest
                          </span>
                        )}
                      </div>
                      {v.distributions.length > 0 && (
                        <div className="mt-1 text-[11px] text-hint">
                          {v.distributions[0].variant} ({v.distributions[0].arch}) - {v.distributions[0].size_display}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-hint">No versions available. Using default Python 3.11.9.</p>
              )}
            </div>
          )}
        </Section>

        {/* ── Pre-installation Checks ── */}
        <Section title="Pre-installation Checks" icon={<Shield size={16} />}>
          {validatingPrereqs ? (
            <div className="flex items-center gap-2 text-xs text-hint">
              <Loader2 size={14} className="animate-spin" />
              <span>Running checks...</span>
            </div>
          ) : prereqs.length > 0 ? (
            <div className="space-y-1.5">
              {prereqs.map((check, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {check.passed ? (
                    <CheckCircle size={13} className="text-green-400 shrink-0" />
                  ) : (
                    <AlertCircle size={13} className={`${check.required ? "text-red-400" : "text-yellow-400"} shrink-0`} />
                  )}
                  <span className="text-hero font-medium">{check.name}</span>
                  <span className="text-hint">- {check.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <button
              className="btn-glass !px-3 !py-1.5 !text-xs flex items-center gap-1.5"
              onClick={loadPrereqs}
            >
              <RefreshCw size={11} /> Run Checks
            </button>
          )}
        </Section>

        {/* ── Installation ── */}
        <Section title="Installation" icon={<Download size={16} />}>
          <div className="space-y-3">
            {!isInstalled && !isInstalling && (
              <div className="text-center py-4">
                <p className="text-sm text-hint mb-3">
                  Install Python and Open WebUI for API chat.
                </p>
                <button
                  className="relative z-10 btn-accent"
                  onClick={handleInstall}
                >
                  <Download size={14} /> Install Everything
                </button>
              </div>
            )}

            {isInstalled && !isInstalling && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <CheckCircle size={14} />
                  <span>Python and Open WebUI are installed</span>
                </div>

                {/* Uninstall */}
                {!showUninstallConfirm ? (
                  <button
                    className="btn-glass !px-3 !py-2 !text-xs flex items-center gap-2 text-red-400 hover:text-red-300"
                    onClick={() => setShowUninstallConfirm(true)}
                  >
                    <Trash2 size={13} /> Uninstall & Remove All Data
                  </button>
                ) : (
                  <div className="p-3 rounded-lg space-y-2" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                    <p className="text-xs text-red-300">
                      This will remove Python, Open WebUI, and all user data. This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="!px-3 !py-1.5 !text-xs rounded-lg font-medium"
                        style={{ background: "rgba(248,113,113,0.2)", color: "#fca5a5" }}
                        onClick={handleUninstall}
                        disabled={uninstalling}
                      >
                        {uninstalling ? <Loader2 size={12} className="animate-spin inline mr-1" /> : <Trash2 size={12} className="inline mr-1" />}
                        Yes, Uninstall
                      </button>
                      <button
                        className="btn-glass !px-3 !py-1.5 !text-xs"
                        onClick={() => setShowUninstallConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* ── Logs ── */}
        <Section title="Logs" icon={<FileText size={16} />} defaultOpen={false}>
          <div
            ref={logsRef}
            className="rounded-lg p-3 overflow-y-auto font-mono text-[11px] leading-relaxed max-h-64"
            style={{ background: "var(--bg-1)", color: "var(--text-hint)" }}
          >
            {logs.length === 0 ? (
              <p className="opacity-50">No logs yet.</p>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
              ))
            )}
          </div>
          <button
            className="btn-glass !px-3 !py-1.5 !text-[11px] flex items-center gap-1.5"
            onClick={() => setLogs([])}
          >
            <Trash2 size={11} /> Clear Logs
          </button>
        </Section>
      </div>
    </div>
  );
}

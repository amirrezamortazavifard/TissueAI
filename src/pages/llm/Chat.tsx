import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "react-router-dom";
import {
  Play,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Terminal,
  Cpu,
  Cloud,
  Download,
  Loader2,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import type { ServerStatus, OpenWebUIStatus, ProgressPayload, InstallPhase } from "./types";

type ChatMode = "local" | "api";

function formatSpeed(bps: number): string {
  if (bps > 1_048_576) return `${(bps / 1_048_576).toFixed(1)} MB/s`;
  if (bps > 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

function formatBytes(bytes: number): string {
  if (bytes > 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatEta(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
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

export function phaseStringToType(phase: string, subPhase: string, metrics: any): InstallPhase {
  switch (phase) {
    case "idle": return { type: "idle" };
    case "init":
      return { type: "init", sub_phase: subPhase, percent: metrics?.phase_percent || 0, detail: "" };
    case "discovering_versions":
      return { type: "discovering_versions", sub_phase: subPhase, percent: metrics?.phase_percent || 0, detail: "" };
    case "version_select":
      return { type: "version_select", available_versions: [], recommended: "", reason: "" };
    case "detecting_platform":
      return { type: "detecting_platform", sub_phase: subPhase, percent: metrics?.phase_percent || 0, detail: "" };
    case "validating_prereqs":
      return { type: "validating_prereqs", sub_phase: subPhase, percent: metrics?.phase_percent || 0, detail: "" };
    case "checking_python":
      return { type: "checking_python", sub_phase: subPhase, percent: metrics?.phase_percent || 0, detail: "" };
    case "downloading_python":
      return { type: "downloading_python", sub_phase: subPhase, percent: metrics?.phase_percent || 0,
        bytes_downloaded: metrics?.bytes_downloaded || 0, total_bytes: metrics?.total_bytes || 0,
        speed_bps: metrics?.speed_bytes_per_sec || 0, eta_secs: metrics?.eta_total_secs || 0 };
    case "extracting_python":
      return { type: "extracting_python", sub_phase: subPhase, percent: metrics?.phase_percent || 0,
        files_extracted: metrics?.files_processed || 0, total_files: metrics?.total_files || 0, current_file: "" };
    case "configuring_python":
      return { type: "configuring_python", sub_phase: subPhase, percent: metrics?.phase_percent || 0, detail: "" };
    case "downloading_get_pip":
      return { type: "downloading_get_pip", sub_phase: subPhase, percent: metrics?.phase_percent || 0,
        bytes_downloaded: metrics?.bytes_downloaded || 0, total_bytes: metrics?.total_bytes || 0,
        speed_bps: metrics?.speed_bytes_per_sec || 0, eta_secs: metrics?.eta_total_secs || 0 };
    case "installing_pip":
      return { type: "installing_pip", sub_phase: subPhase, percent: metrics?.phase_percent || 0,
        packages_installed: metrics?.packages_installed || 0, total_packages: metrics?.total_packages || 0, detail: "" };
    case "installing_open_webui":
      return { type: "installing_open_webui", sub_phase: subPhase, percent: metrics?.phase_percent || 0,
        packages_installed: metrics?.packages_installed || 0, total_packages: metrics?.total_packages || 0, detail: "" };
    case "verifying":
      return { type: "verifying", sub_phase: subPhase, percent: metrics?.phase_percent || 0, detail: "" };
    case "starting":
      return { type: "starting", sub_phase: subPhase, percent: metrics?.phase_percent || 0, detail: "" };
    case "running": return { type: "running" };
    case "error": return { type: "error", message: subPhase, phase: "", recoverable: false, retry_count: 0, max_retries: 3, suggested_action: "", error_code: "" };
    case "paused": return { type: "paused", paused_at_phase: subPhase, sub_phase: "", overall_percent: 0, can_resume: true, reason: "" };
    default: return { type: "idle" };
  }
}

function getPhaseSteps(): string[] {
  return [
    "Initialize",
    "Discover Versions",
    "Detect Platform",
    "Validate Prereqs",
    "Check Python",
    "Download Python",
    "Extract & Configure",
    "Install pip",
    "Install Open WebUI",
    "Verify",
    "Start Server",
  ];
}

function getCurrentStepIndex(phase: InstallPhase): number {
  switch (phase.type) {
    case "idle": return -1;
    case "init": return 0;
    case "discovering_versions": return 1;
    case "version_select": return 1;
    case "detecting_platform": return 2;
    case "validating_prereqs": return 3;
    case "checking_python": return 4;
    case "downloading_python": return 5;
    case "extracting_python": return 6;
    case "configuring_python": return 6;
    case "downloading_get_pip": return 7;
    case "installing_pip": return 7;
    case "installing_open_webui": return 8;
    case "verifying": return 9;
    case "starting": return 10;
    case "running": return 10;
    case "error": return -1;
    case "paused": return -1;
    default: return -1;
  }
}

export default function Chat() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<ChatMode>("local");
  const [status, setStatus] = useState<ServerStatus>({ type: "stopped" });
  const [openWebUIStatus, setOpenWebUIStatus] = useState<OpenWebUIStatus>({
    installed: false,
    running: false,
    installing: false,
    paused: false,
    port: 8082,
    url: "",
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
  const [startingInstall, setStartingInstall] = useState(false);
  const [startingServer, setStartingServer] = useState(false);
  const [stoppingServer, setStoppingServer] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);
  const pendingLogs = useRef<string[]>([]);
  const logRaf = useRef<number | null>(null);

  const flushLogs = useCallback(() => {
    logRaf.current = null;
    const batch = pendingLogs.current;
    if (batch.length === 0) return;
    pendingLogs.current = [];
    setLogs((prev) => [...prev, ...batch].slice(-500));
  }, []);

  const addLog = useCallback((line: string) => {
    pendingLogs.current.push(line);
    if (logRaf.current === null) {
      logRaf.current = requestAnimationFrame(flushLogs);
    }
  }, [flushLogs]);

  // Poll llama.cpp server status
  useEffect(() => {
    const poll = async () => {
      try {
        const s = await invoke<ServerStatus>("llm_get_server_status");
        setStatus(s);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  // Poll Open WebUI status when in API mode
  useEffect(() => {
    if (mode !== "api") return;
    const poll = async () => {
      try {
        const s = await invoke<OpenWebUIStatus>("llm_get_open_webui_status");
        setOpenWebUIStatus(s);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [mode]);

  // Listen for Open WebUI progress events
  useEffect(() => {
    const unlisten = listen<ProgressPayload>("open_webui_progress", (e) => {
      const evt = e.payload;
      const phase: InstallPhase = phaseStringToType(evt.phase.current, evt.phase.sub_phase, evt.metrics);
      setOpenWebUIStatus((prev) => ({
        ...prev,
        phase,
        overall_percent: evt.progress.overall_percent,
        elapsed_secs: evt.metrics.elapsed_secs,
        progress: evt.message,
        installing: !evt.phase.is_terminal && !evt.phase.is_error && evt.phase.current !== "idle",
      }));
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  // Load llama.cpp server logs
  useEffect(() => {
    invoke<string[]>("llm_get_server_logs").then((existing) => {
      if (existing.length > 0) {
        setLogs(existing);
      }
    }).catch(() => {});

    const unlistenLog = listen<string>("server_log", (e) => {
      addLog(e.payload);
    });

    return () => {
      unlistenLog.then((f) => f());
      if (logRaf.current !== null) cancelAnimationFrame(logRaf.current);
    };
  }, [addLog]);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  const port = status.type === "running" ? status.port : null;

  const handleInstall = () => {
    setStartingInstall(true);
    setOpenWebUIStatus(prev => ({
      ...prev,
      installing: true,
      phase: { type: "checking_python", sub_phase: "detecting", percent: 0, detail: "Starting installation..." },
      progress: "Starting installation...",
    }));
    invoke("llm_install_full").catch(() => {
      setStartingInstall(false);
    });
  };

  const modeToggle = (
    <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: "var(--bg-2)" }}>
      <button
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
          mode === "local" ? "bg-primary/15 text-primary" : "text-hint hover:text-hero"
        }`}
        onClick={() => setMode("local")}
      >
        <Cpu size={12} /> Local
      </button>
      <button
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
          mode === "api" ? "bg-primary/15 text-primary" : "text-hint hover:text-hero"
        }`}
        onClick={() => setMode("api")}
      >
        <Cloud size={12} /> API
      </button>
    </div>
  );

  // ── API Mode: Open WebUI ──────────────────────────────────────────────────

  if (mode === "api") {
    const isInstalling = openWebUIStatus.installing || startingInstall;
    const isInstalled = openWebUIStatus.installed;
    const isRunning = openWebUIStatus.running;
    const hasError = openWebUIStatus.phase.type === "error" || openWebUIStatus.error;
    const currentStep = getCurrentStepIndex(openWebUIStatus.phase);
    const steps = getPhaseSteps();

    // ── Error state (MUST be first check!) ──
    if (hasError) {
      return (
        <div className="flex-1 flex flex-col min-h-0 h-full">
          <div className="flex items-center justify-center px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-1)" }}>
            {modeToggle}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="relative z-10 text-center max-w-md">
              <AlertCircle size={48} className="mx-auto mb-4" style={{ color: "rgba(248,113,113,0.9)" }} />
              <p className="text-lg font-semibold text-hero">Installation Failed</p>
              <p className="text-xs mt-2 text-hint leading-relaxed break-all">
                {openWebUIStatus.error || "An unknown error occurred."}
              </p>
            </div>
            <button
              className="relative z-10 btn-accent"
              onClick={handleInstall}
            >
              <RefreshCw size={15} /> Retry Installation
            </button>
          </div>
        </div>
      );
    }

    // ── Not installed, not installing -> show install button ──
    if (!isInstalled && !isInstalling) {
      return (
        <div className="flex-1 flex flex-col min-h-0 h-full">
          <div className="flex items-center justify-center px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-1)" }}>
            {modeToggle}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="relative z-10 text-center max-w-md">
              <Cloud size={48} className="mx-auto mb-4 text-hint opacity-50" />
              <p className="text-lg font-semibold text-hero">Open WebUI not installed</p>
              <p className="text-sm mt-2 text-hint leading-relaxed">
                Install Python and Open WebUI to chat with cloud AI providers
                (OpenAI, Gemini, Claude, DeepSeek, and more).
              </p>
              <p className="text-xs mt-3 text-hint opacity-60">
                Python and Open WebUI will be installed automatically.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                className="relative z-10 btn-accent"
                onClick={() => navigate('/llm/settings', { state: { tab: 'api', action: 'install' } })}
              >
                <Download size={15} /> Configure API & Install Python
              </button>
              <button
                className="relative z-10 btn-glass !text-xs"
                onClick={() => navigate('/llm/settings', { state: { tab: 'api' } })}
              >
                Open Settings
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Installing -> show detailed progress ──
    if (isInstalling) {
      const phase = openWebUIStatus.phase;
      const subPhaseLabel = phase.type === "idle" ? "" :
        (phase.type === "running" ? "" :
        (phase.type === "error" ? "" :
        (() => {
          switch (phase.type) {
            case "checking_python": return phase.sub_phase;
            case "downloading_python": return phase.sub_phase;
            case "extracting_python": return phase.sub_phase;
            case "configuring_python": return phase.sub_phase;
            case "downloading_get_pip": return phase.sub_phase;
            case "installing_pip": return phase.sub_phase;
            case "installing_open_webui": return phase.sub_phase;
            case "starting": return phase.sub_phase;
            default: return "";
          }
        })()));

      return (
        <div className="flex-1 flex flex-col min-h-0 h-full">
          <div className="flex items-center justify-center px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-1)" }}>
            {modeToggle}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <div className="relative z-10 w-full max-w-lg">
              {/* Phase indicator */}
              <div className="text-center mb-6">
                <Loader2 size={28} className="mx-auto mb-3 animate-spin text-primary" />
                <p className="text-sm font-semibold text-hero">{getPhaseLabel(phase)}</p>
                {subPhaseLabel && (
                  <p className="text-xs mt-1 text-hint opacity-70">[{subPhaseLabel}]</p>
                )}
                <p className="text-xs mt-1 text-hint">{openWebUIStatus.progress || "Please wait..."}</p>
                {openWebUIStatus.elapsed_secs > 0 && (
                  <p className="text-xs mt-1 text-hint opacity-60">
                    Elapsed: {formatEta(Math.floor(openWebUIStatus.elapsed_secs))}
                  </p>
                )}
              </div>

              {/* Overall progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-hint mb-1">
                  <span>Overall Progress</span>
                  <span>{openWebUIStatus.overall_percent.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-2)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${openWebUIStatus.overall_percent}%`,
                      background: "linear-gradient(90deg, var(--primary), var(--primary-hover))",
                    }}
                  />
                </div>
              </div>

              {/* Step indicators */}
              <div className="space-y-1.5 mb-4">
                {steps.map((step, i) => {
                  const isDone = i < currentStep;
                  const isCurrent = i === currentStep;
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        isDone ? "bg-green-500/20 text-green-400"
                          : isCurrent ? "bg-primary/20 text-primary"
                          : "text-hint opacity-30"
                      }`}>
                        {isDone ? <Check size={10} /> : isCurrent ? <Loader2 size={10} className="animate-spin" /> : <span>{i + 1}</span>}
                      </div>
                      <span className={`${
                        isDone ? "text-green-400" : isCurrent ? "text-hero font-medium" : "text-hint opacity-40"
                      }`}>{step}</span>
                    </div>
                  );
                })}
              </div>

              {/* Download metrics */}
              {(phase.type === "downloading_python" || phase.type === "downloading_get_pip") && (
                <div className="text-xs text-hint space-y-0.5 mt-3 p-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
                  <div>Speed: {formatSpeed(phase.speed_bps)}</div>
                  <div>Downloaded: {formatBytes(phase.bytes_downloaded)} / {formatBytes(phase.total_bytes)}</div>
                  <div>ETA: {formatEta(Math.floor(phase.eta_secs))}</div>
                </div>
              )}

              {/* Extraction metrics */}
              {phase.type === "extracting_python" && (
                <div className="text-xs text-hint space-y-0.5 mt-3 p-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
                  <div>Files: {phase.files_extracted} / {phase.total_files}</div>
                  {phase.current_file && <div className="truncate">Current: {phase.current_file}</div>}
                </div>
              )}

              {/* Installation metrics */}
              {(phase.type === "installing_pip" || phase.type === "installing_open_webui") && (
                <div className="text-xs text-hint space-y-0.5 mt-3 p-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
                  <div>Packages: {phase.packages_installed} / {phase.total_packages}</div>
                  <div>{phase.detail}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // ── Installed but not running -> show start button ──
    if (isInstalled && !isRunning) {
      return (
        <div className="flex-1 flex flex-col min-h-0 h-full">
          <div className="flex items-center justify-center px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-1)" }}>
            {modeToggle}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="relative z-10 text-center">
              <Check size={48} className="mx-auto mb-4 text-green-400" />
              <p className="text-lg font-semibold text-hero">Open WebUI is ready</p>
              <p className="text-sm mt-2 text-hint">Click to start the API chat server on port {openWebUIStatus.port}.</p>
            </div>
            <button
              className="relative z-10 btn-accent"
              onClick={() => {
                setStartingServer(true);
                invoke("llm_start_open_webui").catch(() => setStartingServer(false));
              }}
              disabled={startingServer}
            >
              {startingServer ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {startingServer ? "Starting..." : "Start Open WebUI"}
            </button>
          </div>
        </div>
      );
    }

    // ── Running -> show iframe ──
    const openWebUIUrl = openWebUIStatus.url || `http://127.0.0.1:${openWebUIStatus.port}`;

    return (
      <div className="flex-1 flex flex-col min-h-0 h-full relative">
        <div className="flex items-center justify-center px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-1)" }}>
          {modeToggle}
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(91,168,245,0.04) 0%, transparent 50%)",
          }}
        />

        {/* Header bar */}
        <div
          className="relative z-10 flex items-center justify-between px-4 py-2.5 shrink-0"
          style={{ borderBottom: "1px solid var(--border-1)" }}
        >
          <span className="text-xs font-mono px-2.5 py-1 rounded-lg glass-input !w-auto !inline-flex">
            {openWebUIUrl}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="btn-glass !px-2.5 !py-1.5 !text-[11px]"
              onClick={() => {
                setStoppingServer(true);
                invoke("llm_stop_open_webui").catch(() => setStoppingServer(false));
              }}
              disabled={stoppingServer}
            >
              {stoppingServer ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              {stoppingServer ? "Stopping..." : "Stop"}
            </button>
          </div>
        </div>

        {/* Open WebUI iframe */}
        <iframe
          src={openWebUIUrl}
          className="relative z-10 flex-1 w-full border-0 min-h-0"
          style={{ height: "100%" }}
          allow="clipboard-write"
          title="Open WebUI Chat"
        />
      </div>
    );
  }

  if (status.type === "starting") {
    return (
      <div className="flex-1 flex flex-col min-h-0 h-full">
        <div className="flex items-center justify-center px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-1)" }}>
          {modeToggle}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 relative">
          <div className="relative z-10 text-center">
            <p className="text-base font-semibold text-hero">Server is starting…</p>
            <p className="text-sm mt-1 text-hint">The model is loading. This may take a moment.</p>
          </div>
          <RefreshCw size={20} className="relative z-10 animate-spin text-hint" />
        </div>
      </div>
    );
  }

  if (status.type !== "running" || !port) {
    return (
      <div className="flex-1 flex flex-col min-h-0 h-full">
        <div className="flex items-center justify-center px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-1)" }}>
          {modeToggle}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 relative">
          <div className="relative z-10 text-center">
            <p className="text-base font-semibold text-hero">Server is not running</p>
            <p className="text-sm mt-1 text-hint">Start the server first to use the local chat.</p>
          </div>
          <button className="relative z-10 btn-accent" onClick={() => navigate("/llm/server")}>
            <Play size={15} /> Go to Run
          </button>
        </div>
      </div>
    );
  }

  const chatUrl = `http://127.0.0.1:${port}`;

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full relative">
      <div className="flex items-center justify-center px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-1)" }}>
        {modeToggle}
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(91,168,245,0.04) 0%, transparent 50%)",
        }}
      />

      {/* Header bar */}
      <div
        className="relative z-10 flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid var(--border-1)" }}
      >
        <span className="text-xs font-mono px-2.5 py-1 rounded-lg glass-input !w-auto !inline-flex">
          {chatUrl}
        </span>
        <div className="flex items-center gap-1">
          <button
            className={`btn-glass !px-2.5 !py-1.5 !text-[11px] ${showLogs ? "!border-primary/30 !text-primary" : ""}`}
            onClick={() => setShowLogs(!showLogs)}
          >
            <Terminal size={12} />
            Logs
            {showLogs ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <button
            className="btn-glass !px-2.5 !py-1.5 !text-[11px]"
            onClick={() => invoke("llm_open_chat_window", { port })}
          >
            <ExternalLink size={12} />
            Pop out
          </button>
        </div>
      </div>

      {/* Log panel */}
      {showLogs && (
        <div
          ref={logsRef}
          className="relative z-10 p-3 h-48 overflow-y-auto font-mono text-xs space-y-0.5 shrink-0"
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border-1)",
          }}
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
              color = "rgba(91,168,245,0.9)";
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

      {/* Chat iframe */}
      <iframe
        src={chatUrl}
        className="relative z-10 flex-1 w-full border-0 min-h-0"
        style={{ height: "100%" }}
        allow="clipboard-write"
        title="llama.cpp Chat"
      />
    </div>
  );
}

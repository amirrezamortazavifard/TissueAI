import { useState, useEffect } from "react";
import {
  Palette,
  Cpu,
  Gauge,
  Info,
  Save,
  Moon,
  Sun,
  FolderOpen,
  RotateCcw,
  Shield,
  Zap,
  HardDrive,
  BrainCircuit,
  MonitorCheck,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

interface AppSettings {
  theme: "dark" | "light";
  executionProvider: "cpu" | "gpu";
  confidenceThreshold: number;
  nmsThreshold: number;
  checkUpdatesOnStartup: boolean;
  defaultModelsDir: string;
}

const defaultSettings: AppSettings = {
  theme: "dark",
  executionProvider: "cpu",
  confidenceThreshold: 0.5,
  nmsThreshold: 0.45,
  checkUpdatesOnStartup: true,
  defaultModelsDir: "Documents/TissueAI/Models",
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem("tissueai_settings");
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
  return defaultSettings;
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem("tissueai_settings", JSON.stringify(settings));
}

const tabs = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "detection", label: "Detection", icon: Cpu },
  { id: "general", label: "General", icon: MonitorCheck },
  { id: "about", label: "About", icon: Info },
] as const;

type TabId = (typeof tabs)[number]["id"];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className="toggle-track"
      data-state={checked ? "on" : "off"}
      onClick={() => onChange(!checked)}
    >
      <div className="toggle-thumb" />
    </button>
  );
}

export default function Settings() {
  const { theme, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>("appearance");
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings((s) => ({ ...s, theme }));
  }, [theme]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveSettings(settings);
    if (settings.theme !== theme) toggle();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto relative page-enter">
      <div className="max-w-[800px] mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 style={{ color: "var(--text-1)" }} className="text-[28px] font-bold leading-none tracking-tight">
              Settings
            </h1>
            <p style={{ color: "var(--text-3)" }} className="text-[13px] mt-2">
              Configure appearance, detection, and general preferences
            </p>
          </div>
          <button onClick={handleSave} className="btn-accent flex items-center gap-2 text-[13px]">
            <Save size={14} />
            {saved ? "Saved!" : "Save Settings"}
          </button>
        </div>

        {/* Tab Bar */}
        <div className="tab-bar">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`tab-item flex items-center gap-1.5 ${activeTab === id ? "active" : ""}`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === "appearance" && (
            <AppearanceTab settings={settings} update={update} />
          )}
          {activeTab === "detection" && (
            <DetectionTab settings={settings} update={update} />
          )}
          {activeTab === "general" && (
            <GeneralTab settings={settings} update={update} />
          )}
          {activeTab === "about" && <AboutTab />}
        </div>
      </div>
    </div>
  );
}

/* ═══ Appearance Tab ═══ */

function AppearanceTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Theme */}
      <div className="glass-card-static p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(91,168,245,0.2), rgba(91,168,245,0.05))", color: "#5BA8F5" }}>
              <Palette size={16} />
            </div>
            <div>
              <p style={{ color: "var(--text-1)" }} className="text-[13px] font-medium">Application Theme</p>
              <p style={{ color: "var(--text-4)" }} className="text-[12px] mt-0.5">Select your preferred color scheme</p>
            </div>
          </div>
          <div className="tab-bar">
            <button
              onClick={() => update("theme", "dark")}
              className={`tab-item flex items-center gap-1.5 ${settings.theme === "dark" ? "active" : ""}`}
            >
              <Moon size={13} />
              Dark
            </button>
            <button
              onClick={() => update("theme", "light")}
              className={`tab-item flex items-center gap-1.5 ${settings.theme === "light" ? "active" : ""}`}
            >
              <Sun size={13} />
              Light
            </button>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="glass-card-static p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))", color: "#8b5cf6" }}>
              <BrainCircuit size={16} />
            </div>
            <div>
              <p style={{ color: "var(--text-1)" }} className="text-[13px] font-medium">Display Language</p>
              <p style={{ color: "var(--text-4)" }} className="text-[12px] mt-0.5">UI language (Help pages support En/Fa)</p>
            </div>
          </div>
          <span className="badge badge-blue">English</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ Detection Tab ═══ */

function DetectionTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Execution Provider */}
      <div className="glass-card-static p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))", color: "#22c55e" }}>
              <Cpu size={16} />
            </div>
            <div>
              <p style={{ color: "var(--text-1)" }} className="text-[13px] font-medium">Execution Provider</p>
              <p style={{ color: "var(--text-4)" }} className="text-[12px] mt-0.5">Choose CPU or GPU for model inference</p>
            </div>
          </div>
          <div className="tab-bar">
            <button
              onClick={() => update("executionProvider", "cpu")}
              className={`tab-item flex items-center gap-1.5 ${settings.executionProvider === "cpu" ? "active" : ""}`}
            >
              <Cpu size={13} />
              CPU
            </button>
            <button
              onClick={() => update("executionProvider", "gpu")}
              className={`tab-item flex items-center gap-1.5 ${settings.executionProvider === "gpu" ? "active" : ""}`}
            >
              <Zap size={13} />
              GPU
            </button>
          </div>
        </div>
      </div>

      {/* Confidence Threshold */}
      <div className="glass-card-static p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))", color: "#f59e0b" }}>
              <Gauge size={16} />
            </div>
            <div>
              <p style={{ color: "var(--text-1)" }} className="text-[13px] font-medium">Confidence Threshold</p>
              <p style={{ color: "var(--text-4)" }} className="text-[12px] mt-0.5">Minimum confidence score for detection results</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ color: "#5BA8F5" }} className="text-[13px] font-bold min-w-[4ch] text-right">
              {Math.round(settings.confidenceThreshold * 100)}%
            </span>
            <input
              type="range"
              min={10}
              max={99}
              value={Math.round(settings.confidenceThreshold * 100)}
              onChange={(e) => update("confidenceThreshold", Number(e.target.value) / 100)}
              className="w-32"
            />
          </div>
        </div>
      </div>

      {/* NMS Threshold */}
      <div className="glass-card-static p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))", color: "#8b5cf6" }}>
              <Gauge size={16} />
            </div>
            <div>
              <p style={{ color: "var(--text-1)" }} className="text-[13px] font-medium">NMS Threshold</p>
              <p style={{ color: "var(--text-4)" }} className="text-[12px] mt-0.5">Non-Maximum Suppression IoU threshold</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ color: "#5BA8F5" }} className="text-[13px] font-bold min-w-[4ch] text-right">
              {Math.round(settings.nmsThreshold * 100)}%
            </span>
            <input
              type="range"
              min={10}
              max={90}
              value={Math.round(settings.nmsThreshold * 100)}
              onChange={(e) => update("nmsThreshold", Number(e.target.value) / 100)}
              className="w-32"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ General Tab ═══ */

function GeneralTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Check for updates */}
      <div className="glass-card-static p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(91,168,245,0.2), rgba(91,168,245,0.05))", color: "#5BA8F5" }}>
              <RotateCcw size={16} />
            </div>
            <div>
              <p style={{ color: "var(--text-1)" }} className="text-[13px] font-medium">Check for Updates on Startup</p>
              <p style={{ color: "var(--text-4)" }} className="text-[12px] mt-0.5">Automatically check for model updates when the app launches</p>
            </div>
          </div>
          <Toggle
            checked={settings.checkUpdatesOnStartup}
            onChange={(v) => update("checkUpdatesOnStartup", v)}
          />
        </div>
      </div>

      {/* Default Models Directory */}
      <div className="glass-card-static p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.05))", color: "#f97316" }}>
              <FolderOpen size={16} />
            </div>
            <div>
              <p style={{ color: "var(--text-1)" }} className="text-[13px] font-medium">Models Directory</p>
              <p style={{ color: "var(--text-4)" }} className="text-[12px] mt-0.5">Default location for storing AI model files</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="glass-input text-[12px] w-[200px] truncate" style={{ padding: "6px 10px" }}>
              {settings.defaultModelsDir}
            </span>
            <button className="btn-glass text-[12px] py-2 px-3">
              <FolderOpen size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="glass-card-static p-5">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))", color: "#22c55e" }}>
            <HardDrive size={16} />
          </div>
          <div>
            <p style={{ color: "var(--text-1)" }} className="text-[13px] font-medium">System Information</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="badge badge-green">Runtime: Tauri 2</span>
              <span className="badge badge-blue">Frontend: React 19</span>
              <span className="badge badge-purple">Backend: Rust</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ About Tab ═══ */

function AboutTab() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Project Info */}
      <div className="glass-card-static p-6">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg, rgba(91,168,245,0.25), rgba(91,168,245,0.1))", border: "1px solid rgba(91,168,245,0.2)", boxShadow: "0 0 40px rgba(91,168,245,0.15)" }}>
            <Shield size={26} style={{ color: "#5BA8F5" }} />
          </div>
          <h2 style={{ color: "var(--text-1)" }} className="text-[22px] font-bold">TissueAI</h2>
          <p style={{ color: "var(--text-3)" }} className="text-[13px] mt-1">AI-Powered Tissue Analysis Platform</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="badge badge-blue">v0.1.0</span>
            <span className="badge badge-green">Stable</span>
          </div>
        </div>

        <div className="h-[1px] my-4" style={{ background: "var(--border-2)" }} />

        <p style={{ color: "var(--text-2)" }} className="text-[13px] leading-relaxed text-center">
          TissueAI is a specialized software for cellular identification and diagnosis in the human body.
          Built on AI using PyTorch and YOLO (You Only Look Once) architecture with Convolutional Neural
          Networks (CNNs) for image recognition. Currently calibrated to identify cells within tissue samples.
        </p>
      </div>

      {/* Developer */}
      <div className="glass-card-static p-6">
        <div className="flex items-center gap-2 mb-4">
          <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase">
            Development Team
          </span>
          <div className="flex-1 h-[1px]" style={{ background: "var(--border-2)" }} />
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(91,168,245,0.2), rgba(139,92,246,0.15))", border: "1px solid rgba(91,168,245,0.15)" }}>
            <span style={{ color: "#5BA8F5", fontSize: "24px", fontWeight: 700 }}>AF</span>
          </div>
          <div>
            <p style={{ color: "var(--text-1)" }} className="text-[15px] font-semibold">Amirreza Mortazavi Fard</p>
            <p style={{ color: "var(--text-3)" }} className="text-[12px] mt-0.5">Full Stack Software Engineer (AI and Neural Networks)</p>
            <div className="flex items-center gap-3 mt-2">
              <a
                href="https://t.me/reallyFard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-medium transition-colors"
                style={{ color: "#5BA8F5" }}
              >
                @reallyFard
              </a>
              <span style={{ color: "var(--text-5)" }}>|</span>
              <a
                href="mailto:mortazavi.a.stu@gmu.ac.ir"
                className="text-[12px] font-medium transition-colors"
                style={{ color: "#5BA8F5" }}
              >
                mortazavi.a.stu@gmu.ac.ir
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="glass-card-static p-5">
        <div className="flex items-center gap-2 mb-4">
          <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase">
            Technology Stack
          </span>
        </div>
      </div>
    </div>
  );
}
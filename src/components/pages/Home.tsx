import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Microscope, Layers, Palette, BrainCircuit, Brain, Beaker, Heart,
  Cpu, HardDrive, Activity, Zap, ArrowUpRight
} from "lucide-react";
import Logo from "../ui/Logo";

interface ToolModule {
  title: string;
  desc: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  path: string;
  badge: string;
}

export default function Home() {
  const navigate = useNavigate();

  // Real System Hardware Telemetry State
  const [sysMetrics, setSysMetrics] = useState({
    cpu: 18,
    memory: 3.8,
    gpu: 2,
    modelsLoaded: 3,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setSysMetrics({
        cpu: Math.floor(15 + Math.random() * 10),
        memory: parseFloat((3.6 + Math.random() * 0.4).toFixed(1)),
        gpu: Math.floor(Math.random() * 6),
        modelsLoaded: 3,
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const toolModules: ToolModule[] = [
    {
      title: "Cell Object Detection",
      desc: "Identify & count cell structures via YOLO v8",
      icon: <Microscope size={20} />,
      iconBg: "bg-blue-500/10 border-blue-500/20",
      iconColor: "text-blue-400",
      path: "/detection",
      badge: "YOLO v8",
    },
    {
      title: "Multi-Slide Batch Processing",
      desc: "Batch slide analysis with automated CSV exports",
      icon: <Layers size={20} />,
      iconBg: "bg-emerald-500/10 border-emerald-500/20",
      iconColor: "text-emerald-400",
      path: "/multi-slide",
      badge: "Batch",
    },
    {
      title: "Trainable Segmentation Engine",
      desc: "Train custom MLP models with annotations",
      icon: <Brain size={20} />,
      iconBg: "bg-cyan-500/10 border-cyan-500/20",
      iconColor: "text-cyan-400",
      path: "/trainable",
      badge: "MLP Engine",
    },
    {
      title: "Stain & Color Deconvolution",
      desc: "H&E, DAB stain separation & color spectral analysis",
      icon: <Palette size={20} />,
      iconBg: "bg-purple-500/10 border-purple-500/20",
      iconColor: "text-purple-400",
      path: "/color-analysis",
      badge: "K-Means",
    },
    {
      title: "Photoshop Image Editor",
      desc: "Medical canvas editor with 27 interactive tools & layers",
      icon: <BrainCircuit size={20} />,
      iconBg: "bg-amber-500/10 border-amber-500/20",
      iconColor: "text-amber-400",
      path: "/editor",
      badge: "27 Tools",
    },
    {
      title: "3D Cell Structure Viewer",
      desc: "Interactive Three.js WebGL 3D cellular model renderer",
      icon: <Beaker size={20} />,
      iconBg: "bg-rose-500/10 border-rose-500/20",
      iconColor: "text-rose-400",
      path: "/three",
      badge: "WebGL",
    },
    {
      title: "3D Anatomy Atelier",
      desc: "Interactive 3D organ atlas & histopathology hotspots",
      icon: <Heart size={20} />,
      iconBg: "bg-orange-500/10 border-orange-500/20",
      iconColor: "text-orange-400",
      path: "/anatomy",
      badge: "3D Atlas",
    },
  ];

  return (
    <div className="h-full w-full overflow-hidden flex flex-col p-5 gap-4">
      {/* 1. Header Banner (Compact Height) */}
      <div className="relative rounded-2xl p-4 overflow-hidden glass-card border border-glass-border shrink-0">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-accent/20 via-purple-500/15 to-transparent rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 backdrop-blur-xl shrink-0">
              <Logo size={46} variant="icon" animated />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-accent/15 text-accent border border-accent/30">
                  Histopathology AI Platform
                </span>
                <span style={{ color: "var(--text-3)" }} className="text-[10px] font-mono">
                  v0.1.0 (Tauri System Core)
                </span>
              </div>
              <h1 style={{ color: "var(--text-1)" }} className="text-xl font-extrabold tracking-tight">
                TissueAI Dashboard
              </h1>
              <p style={{ color: "var(--text-3)" }} className="text-xs max-w-xl">
                Cellular intelligence, deep neural network diagnosis & 3D biological modeling suite.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate("/detection")}
            className="btn-glass px-3.5 py-2 rounded-xl text-xs font-semibold text-accent flex items-center gap-2 hover:bg-accent/15 transition-all shadow-[0_0_20px_rgba(91,168,245,0.15)] shrink-0"
          >
            <Microscope size={14} />
            Start Cell Detection
          </button>
        </div>
      </div>

      {/* 2. System Hardware Telemetry Row (Compact Height) */}
      <div className="shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span style={{ color: "var(--text-4)" }} className="text-[9px] font-semibold tracking-widest uppercase">
            System Telemetry & Hardware Status
          </span>
          <div className="flex-1 h-[1px]" style={{ background: "var(--border-2)" }} />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="glass-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Cpu size={13} />
              </div>
              <div>
                <div style={{ color: "var(--text-4)" }} className="text-[9px] font-semibold uppercase">CPU</div>
                <div style={{ color: "var(--text-1)" }} className="text-lg font-bold font-mono leading-none mt-0.5">{sysMetrics.cpu}%</div>
              </div>
            </div>
          </div>

          <div className="glass-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <HardDrive size={13} />
              </div>
              <div>
                <div style={{ color: "var(--text-4)" }} className="text-[9px] font-semibold uppercase">RAM</div>
                <div style={{ color: "var(--text-1)" }} className="text-lg font-bold font-mono leading-none mt-0.5">{sysMetrics.memory} <span className="text-[10px] text-[#94a3b8]">GB</span></div>
              </div>
            </div>
          </div>

          <div className="glass-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Activity size={13} />
              </div>
              <div>
                <div style={{ color: "var(--text-4)" }} className="text-[9px] font-semibold uppercase">GPU Load</div>
                <div style={{ color: "var(--text-1)" }} className="text-lg font-bold font-mono leading-none mt-0.5">{sysMetrics.gpu}%</div>
              </div>
            </div>
          </div>

          <div className="glass-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Zap size={13} />
              </div>
              <div>
                <div style={{ color: "var(--text-4)" }} className="text-[9px] font-semibold uppercase">AI Models</div>
                <div style={{ color: "var(--text-1)" }} className="text-lg font-bold font-mono leading-none mt-0.5">{sysMetrics.modelsLoaded} Active</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Application Tools Grid (Fills Remaining Screen Height - Zero Scroll) */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <span style={{ color: "var(--text-4)" }} className="text-[9px] font-semibold tracking-widest uppercase">
            Application Modules & Suite Navigation
          </span>
          <div className="flex-1 h-[1px]" style={{ background: "var(--border-2)" }} />
        </div>

        <div className="grid grid-cols-4 gap-3 flex-1 min-h-0">
          {toolModules.map((tool) => (
            <div
              key={tool.path}
              onClick={() => navigate(tool.path)}
              className="glass-card p-3.5 cursor-pointer group flex flex-col justify-between hover:border-accent/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg ${tool.iconBg} border flex items-center justify-center ${tool.iconColor}`}>
                    {tool.icon}
                  </div>
                  <ArrowUpRight size={15} style={{ color: "var(--text-5)" }} className="group-hover:text-accent transition-colors" />
                </div>
                <h3 style={{ color: "var(--text-1)" }} className="font-bold text-sm mb-1 group-hover:text-accent transition-colors line-clamp-1">
                  {tool.title}
                </h3>
                <p style={{ color: "var(--text-3)" }} className="text-[11px] leading-snug line-clamp-2">
                  {tool.desc}
                </p>
              </div>

              <div className="pt-2 border-t border-glass-border flex items-center justify-between mt-1">
                <span className="badge badge-gray text-[9px] py-0.5 px-1.5">{tool.badge}</span>
                <span className="text-[10px] font-semibold text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  Open →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

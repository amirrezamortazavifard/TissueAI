import { useState, useCallback } from "react";
import { useSceneStore } from "@/stores/sceneStore";
import SceneViewport from "./SceneViewport";
import ModelLibrary from "./panels/ModelLibrary";
import ToolsPanel from "./panels/ToolsPanel";
import FilePanel from "./panels/FilePanel";
import SceneHierarchy from "./panels/SceneHierarchy";
import { Box, Wrench, FolderOpen, List, HelpCircle } from "lucide-react";

type TabId = "models" | "tools" | "file" | "scene";

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "models", label: "Models", icon: <Box size={14} /> },
  { id: "tools", label: "Tools", icon: <Wrench size={14} /> },
  { id: "file", label: "File", icon: <FolderOpen size={14} /> },
  { id: "scene", label: "Scene", icon: <List size={14} /> },
];

export default function ThreeViewer() {
  const [activeTab, setActiveTab] = useState<TabId>("models");
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const state = useSceneStore.getState();
    const selectedId = state.selectedId;
    if (!selectedId) return;
    const obj = state.objects.find((o) => o.id === selectedId);
    if (!obj) return;

    const speed = e.shiftKey ? 2.0 : 0.5;
    const pos = [...obj.position] as [number, number, number];

    switch (e.key.toLowerCase()) {
      case "w": pos[2] -= speed; break;
      case "s": pos[2] += speed; break;
      case "a": pos[0] -= speed; break;
      case "d": pos[0] += speed; break;
      case "q": pos[1] += speed; break;
      case "e": pos[1] -= speed; break;
      default: return;
    }
    e.preventDefault();
    state.updateObject(selectedId, { position: pos });
  }, []);

  return (
    <div className="flex h-full w-full gap-0">
      {/* Left: 3D Viewport */}
      <div className="flex-1 relative overflow-hidden">
        <SceneViewport onKeyDown={handleKeyDown} />

        {/* Help overlay */}
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="absolute bottom-4 left-4 z-10 p-2 rounded-lg transition-all"
          style={{
            background: "rgba(10,13,20,0.6)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <HelpCircle size={16} />
        </button>

        {showHelp && (
          <div
            className="absolute bottom-14 left-4 z-10 p-4 rounded-xl w-72"
            style={{
              background: "rgba(10,13,20,0.85)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="text-xs font-semibold text-white/80 mb-2">Keyboard Controls</div>
            <div className="space-y-1 text-[11px] text-white/50">
              <div><span className="text-white/70 font-mono">W/A/S/D</span> — Move object (X/Z axis)</div>
              <div><span className="text-white/70 font-mono">Q/E</span> — Move object (Y axis)</div>
              <div><span className="text-white/70 font-mono">Shift</span> — Double speed</div>
              <div><span className="text-white/70 font-mono">1-6</span> — Camera presets</div>
              <div><span className="text-white/70 font-mono">Left drag</span> — Orbit camera</div>
              <div><span className="text-white/70 font-mono">Right drag</span> — Pan camera</div>
              <div><span className="text-white/70 font-mono">Scroll</span> — Zoom</div>
              <div><span className="text-white/70 font-mono">Click</span> — Select object</div>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-2 text-[10px] text-white/30 hover:text-white/50"
            >
              Close
            </button>
          </div>
        )}

        {/* Bottom hint */}
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-[11px] text-white/30 px-4 py-1.5 rounded-lg"
          style={{
            background: "rgba(10,13,20,0.5)",
            backdropFilter: "blur(8px)",
          }}
        >
          Click an object to select it. Use the gizmo to move, rotate, or scale. WASD to move selected object.
        </div>
      </div>

      {/* Right: Side Panel */}
      <div className="w-[260px] flex-shrink-0 flex flex-col glass-sidebar">
        {/* Tab Bar */}
        <div className="flex gap-0.5 p-2 border-b border-white/5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all flex-1 justify-center ${
                activeTab === tab.id
                  ? "bg-white/8 text-white/90 border border-white/10"
                  : "text-white/40 hover:text-white/60 hover:bg-white/4 border border-transparent"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === "models" && <ModelLibrary />}
          {activeTab === "tools" && <ToolsPanel />}
          {activeTab === "file" && <FilePanel />}
          {activeTab === "scene" && <SceneHierarchy />}
        </div>
      </div>
    </div>
  );
}

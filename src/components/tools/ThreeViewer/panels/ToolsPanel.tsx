import { useSceneStore } from "@/stores/sceneStore";
import { Sun, Palette, Grid3x3, Box, Trash2 } from "lucide-react";

const COLOR_PRESETS = [
  { name: "Red", color: "#E57373" },
  { name: "Green", color: "#81C784" },
  { name: "Blue", color: "#64B5F6" },
  { name: "Pink", color: "#F06292" },
  { name: "Orange", color: "#FFB74D" },
  { name: "Purple", color: "#CE93D8" },
  { name: "Cyan", color: "#4DD0E1" },
  { name: "Yellow", color: "#FFF176" },
];

const BG_PRESETS = [
  { name: "Default", color: "#1A0129" },
  { name: "Black", color: "#000000" },
  { name: "White", color: "#FFFFFF" },
  { name: "Sky", color: "#87CEEB" },
  { name: "Dark", color: "#0a0d14" },
  { name: "Gray", color: "#2a2a2a" },
];

export default function ToolsPanel() {
  const selectedId = useSceneStore((s) => s.selectedId);
  const objects = useSceneStore((s) => s.objects);
  const updateObject = useSceneStore((s) => s.updateObject);
  const removeObject = useSceneStore((s) => s.removeObject);
  const duplicateObject = useSceneStore((s) => s.duplicateObject);
  const backgroundColor = useSceneStore((s) => s.backgroundColor);
  const setBackgroundColor = useSceneStore((s) => s.setBackgroundColor);
  const showGrid = useSceneStore((s) => s.showGrid);
  const setShowGrid = useSceneStore((s) => s.setShowGrid);
  const lightIntensity = useSceneStore((s) => s.lightIntensity);
  const setLightIntensity = useSceneStore((s) => s.setLightIntensity);
  const ambientIntensity = useSceneStore((s) => s.ambientIntensity);
  const setAmbientIntensity = useSceneStore((s) => s.setAmbientIntensity);
  const showLabels = useSceneStore((s) => s.showLabels);
  const setShowLabels = useSceneStore((s) => s.setShowLabels);
  const wireframeMode = useSceneStore((s) => s.wireframeMode);
  const setWireframeMode = useSceneStore((s) => s.setWireframeMode);

  const selectedObj = objects.find((o) => o.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="section-label">Tools</div>

      {/* Selected Object */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Box size={14} className="text-white/40" />
          <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Selected Object
          </span>
        </div>
        {selectedObj ? (
          <div className="space-y-3 glass-card-static p-3 rounded-xl">
            <div className="text-sm font-medium text-white/80">{selectedObj.name}</div>

            {/* Scale */}
            <div>
              <label className="text-xs text-white/40 mb-1 block">
                Scale: {selectedObj.scale[0].toFixed(1)}
              </label>
              <input
                type="range"
                min={0.1}
                max={5}
                step={0.1}
                value={selectedObj.scale[0]}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  updateObject(selectedObj.id, { scale: [v, v, v] });
                }}
                className="w-full"
              />
            </div>

            {/* Color */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() => updateObject(selectedObj.id, { color: preset.color })}
                    className="w-7 h-7 rounded-lg transition-all hover:scale-110"
                    style={{
                      background: preset.color,
                      border:
                        selectedObj.color === preset.color
                          ? "2px solid white"
                          : "2px solid rgba(255,255,255,0.1)",
                      boxShadow:
                        selectedObj.color === preset.color
                          ? `0 0 10px ${preset.color}40`
                          : "none",
                    }}
                    title={preset.name}
                  />
                ))}
                <input
                  type="color"
                  value={selectedObj.color}
                  onChange={(e) => updateObject(selectedObj.id, { color: e.target.value })}
                  className="w-7 h-7 rounded-lg cursor-pointer border border-white/10"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="text-xs text-white/40 mb-1 block">Position</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["X", "Y", "Z"] as const).map((axis, i) => (
                  <div key={axis}>
                    <span className="text-[10px] text-white/30">{axis}</span>
                    <input
                      type="number"
                      value={selectedObj.position[i].toFixed(1)}
                      onChange={(e) => {
                        const pos = [...selectedObj.position] as [number, number, number];
                        pos[i] = parseFloat(e.target.value) || 0;
                        updateObject(selectedObj.id, { position: pos });
                      }}
                      className="input-field w-full text-center text-xs py-1"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1.5">
              <button
                onClick={() => duplicateObject(selectedObj.id)}
                className="btn-glass flex-1 text-xs py-1.5"
              >
                Clone
              </button>
              <button
                onClick={() => removeObject(selectedObj.id)}
                className="btn-danger flex-1 text-xs py-1.5"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-white/30 py-3 text-center">
            Click an object to select it
          </div>
        )}
      </div>

      {/* Lighting */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sun size={14} className="text-white/40" />
          <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Lighting
          </span>
        </div>
        <div className="space-y-2 glass-card-static p-3 rounded-xl">
          <div>
            <label className="text-xs text-white/40 mb-1 block">
              Directional: {lightIntensity.toFixed(1)}
            </label>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={lightIntensity}
              onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">
              Ambient: {ambientIntensity.toFixed(1)}
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={ambientIntensity}
              onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Background */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Palette size={14} className="text-white/40" />
          <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Background
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BG_PRESETS.map((preset) => (
            <button
              key={preset.color}
              onClick={() => setBackgroundColor(preset.color)}
              className="w-8 h-8 rounded-lg transition-all hover:scale-110"
              style={{
                background: preset.color,
                border:
                  backgroundColor === preset.color
                    ? "2px solid #5BA8F5"
                    : "2px solid rgba(255,255,255,0.1)",
              }}
              title={preset.name}
            />
          ))}
        </div>
      </div>

      {/* Display Options */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Grid3x3 size={14} className="text-white/40" />
          <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Display
          </span>
        </div>
        <div className="space-y-2 glass-card-static p-3 rounded-xl">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-white/60">Show Grid</span>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className="toggle-track"
              data-state={showGrid ? "on" : "off"}
            >
              <div className="toggle-thumb" />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-white/60">Show Labels</span>
            <button
              onClick={() => setShowLabels(!showLabels)}
              className="toggle-track"
              data-state={showLabels ? "on" : "off"}
            >
              <div className="toggle-thumb" />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-white/60">Wireframe Mode</span>
            <button
              onClick={() => {
                const next = !wireframeMode;
                setWireframeMode(next);
                objects.forEach((o) => updateObject(o.id, { wireframe: next }));
              }}
              className="toggle-track"
              data-state={wireframeMode ? "on" : "off"}
            >
              <div className="toggle-thumb" />
            </button>
          </label>
        </div>
      </div>
    </div>
  );
}

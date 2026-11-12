import { useState } from "react";
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, Copy, FolderPlus, Palette, SlidersHorizontal, Layers as LayersIcon, History as HistoryIcon, Image as ImageIcon, Undo2, Redo2 } from "lucide-react";
import { Layer, BlendMode, ImageAdjustments, BLEND_MODE_LABELS } from "../Utils/types";

interface RightBentoPanelProps {
  // Layers
  layers: Layer[];
  activeLayerId: string;
  onLayerSelect: (id: string) => void;
  onLayerToggleVisibility: (id: string) => void;
  onLayerToggleLock: (id: string) => void;
  onLayerOpacityChange: (id: string, opacity: number) => void;
  onLayerBlendModeChange: (id: string, blendMode: BlendMode) => void;
  onAddLayer: () => void;
  onDeleteLayer: () => void;
  onDuplicateLayer: () => void;

  // Adjustments
  adjustments: ImageAdjustments;
  onAdjustmentChange: (key: keyof ImageAdjustments, value: number) => void;

  // Colors
  primaryColor: string;
  secondaryColor: string;
  onPrimaryChange: (c: string) => void;
  onSecondaryChange: (c: string) => void;
  onSwapColors: () => void;

  // History
  historyCount: number;
  historyIndex: number;
  onUndo: () => void;
  onRedo: () => void;
}

type Tab = "layers" | "adjustments" | "history";

export default function RightBentoPanel(props: RightBentoPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("layers");

  return (
    <div className="ed-right-panel">
      {/* Colors Bento Card */}
      <div className="ed-bento-card ed-glass-panel flex-shrink-0" style={{ padding: '16px' }}>
        <div className="ed-bento-header mb-3">
          <span className="flex items-center gap-2"><Palette size={14} /> Colors</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative" style={{ width: 48, height: 48 }}>
            <div
              className="absolute top-0 left-0 rounded-lg border-2 border-[rgba(255,255,255,0.2)] shadow-lg"
              style={{ width: 32, height: 32, backgroundColor: props.primaryColor, zIndex: 2 }}
            />
            <div
              className="absolute bottom-0 right-0 rounded-lg border-2 border-[rgba(255,255,255,0.1)]"
              style={{ width: 32, height: 32, backgroundColor: props.secondaryColor, zIndex: 1 }}
            />
            <button
              onClick={props.onSwapColors}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] flex items-center justify-center text-white/50 z-10 transition-colors shadow-md"
              title="Swap Colors (X)"
            >
              ⇄
            </button>
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/50">Primary</label>
              <input
                type="color"
                value={props.primaryColor}
                onChange={(e) => props.onPrimaryChange(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/50">Secondary</label>
              <input
                type="color"
                value={props.secondaryColor}
                onChange={(e) => props.onSecondaryChange(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Tools Bento Card */}
      <div className="ed-bento-card ed-glass-panel flex-1 min-h-0 flex flex-col p-0">
        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab("layers")}
            className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === "layers" ? "text-white border-b-2 border-[#c084fc] bg-white/5" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}
          >
            <LayersIcon size={14} /> Layers
          </button>
          <button
            onClick={() => setActiveTab("adjustments")}
            className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === "adjustments" ? "text-white border-b-2 border-[#c084fc] bg-white/5" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}
          >
            <SlidersHorizontal size={14} /> Adjust
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === "history" ? "text-white border-b-2 border-[#c084fc] bg-white/5" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}
          >
            <HistoryIcon size={14} /> Hist
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-3">
          
          {/* LAYERS TAB */}
          {activeTab === "layers" && (
            <div className="flex flex-col h-full">
              {/* Layer Blend/Opacity Controls */}
              <div className="flex gap-2 mb-3">
                <select
                  value={props.layers.find(l => l.id === props.activeLayerId)?.blendMode || "normal"}
                  onChange={(e) => props.onLayerBlendModeChange(props.activeLayerId, e.target.value as BlendMode)}
                  className="ed-select flex-1"
                >
                  {Object.entries(BLEND_MODE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1 w-20">
                  <span className="text-[10px] text-white/40">Op</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={props.layers.find(l => l.id === props.activeLayerId)?.opacity || 100}
                    onChange={(e) => props.onLayerOpacityChange(props.activeLayerId, parseInt(e.target.value) || 100)}
                    className="ed-input w-full px-1 py-0.5 text-right"
                  />
                </div>
              </div>

              {/* Layer List */}
              <div className="flex-1 overflow-y-auto ed-scroll flex flex-col gap-1 pr-1">
                {[...props.layers].reverse().map(layer => (
                  <div
                    key={layer.id}
                    onClick={() => props.onLayerSelect(layer.id)}
                    className={`ed-layer-item ${layer.id === props.activeLayerId ? "active" : ""}`}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); props.onLayerToggleVisibility(layer.id); }}
                      className="text-white/40 hover:text-white"
                    >
                      {layer.visible ? <Eye size={14} /> : <EyeOff size={14} className="opacity-30" />}
                    </button>
                    <div className="ed-layer-thumb" style={{ backgroundImage: layer.thumbnail ? `url(${layer.thumbnail})` : undefined, backgroundSize: 'cover' }}>
                      {!layer.thumbnail && <ImageIcon size={10} className="m-auto mt-1 opacity-20" />}
                    </div>
                    <span className="ed-layer-name">{layer.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); props.onLayerToggleLock(layer.id); }}
                      className="text-white/40 hover:text-white"
                    >
                      {layer.locked ? <Lock size={12} /> : <Unlock size={12} className="opacity-0 group-hover:opacity-100" />}
                    </button>
                  </div>
                ))}
              </div>

              {/* Layer Actions */}
              <div className="flex justify-between mt-3 pt-3 border-t border-white/10">
                <button className="ed-tool-btn" title="Add Layer Mask"><div className="w-3 h-3 rounded-sm border border-current bg-white/20"></div></button>
                <button className="ed-tool-btn" onClick={props.onAddLayer} title="New Layer"><Plus size={14} /></button>
                <button className="ed-tool-btn" onClick={props.onDuplicateLayer} title="Duplicate Layer"><Copy size={14} /></button>
                <button className="ed-tool-btn" title="New Group"><FolderPlus size={14} /></button>
                <button className="ed-tool-btn" onClick={props.onDeleteLayer} title="Delete Layer"><Trash2 size={14} /></button>
              </div>
            </div>
          )}

          {/* ADJUSTMENTS TAB */}
          {activeTab === "adjustments" && (
            <div className="flex flex-col h-full overflow-y-auto ed-scroll pr-2 gap-4 pb-4">
              <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Basic</div>
              <AdjustmentSlider label="Brightness" min={-100} max={100} value={props.adjustments.brightness} onChange={(v) => props.onAdjustmentChange("brightness", v)} />
              <AdjustmentSlider label="Contrast" min={-100} max={100} value={props.adjustments.contrast} onChange={(v) => props.onAdjustmentChange("contrast", v)} />
              <AdjustmentSlider label="Exposure" min={-100} max={100} value={props.adjustments.exposure} onChange={(v) => props.onAdjustmentChange("exposure", v)} />
              
              <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1 mt-2">Color</div>
              <AdjustmentSlider label="Hue" min={-180} max={180} value={props.adjustments.hue} onChange={(v) => props.onAdjustmentChange("hue", v)} />
              <AdjustmentSlider label="Saturation" min={-100} max={100} value={props.adjustments.saturation} onChange={(v) => props.onAdjustmentChange("saturation", v)} />
              <AdjustmentSlider label="Lightness" min={-100} max={100} value={props.adjustments.lightness} onChange={(v) => props.onAdjustmentChange("lightness", v)} />
              
              <div className="text-xs font-semibold text-[#ec4899] uppercase tracking-wider mb-1 mt-2">Medical (Stain)</div>
              <AdjustmentSlider label="Gamma" min={1} max={40} value={props.adjustments.gamma * 10} formatter={(v) => (v/10).toFixed(1)} onChange={(v) => props.onAdjustmentChange("gamma", v/10)} />
              <AdjustmentSlider label="H&E Intensity" min={0} max={100} value={props.adjustments.stainIntensity} onChange={(v) => props.onAdjustmentChange("stainIntensity", v)} />
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <div className="flex flex-col h-full">
              <div className="ed-bento-header">
                <span>Navigator</span>
              </div>
              <div className="w-full aspect-video bg-black/50 rounded-lg border border-white/10 mb-4 flex items-center justify-center overflow-hidden relative">
                {/* Navigator thumbnail stub */}
                <ImageIcon size={24} className="opacity-20" />
                <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 border border-red-500 bg-red-500/10 pointer-events-none"></div>
              </div>

              <div className="ed-bento-header flex justify-between items-center">
                <span>History</span>
                <span className="text-[10px] text-white/30">{props.historyIndex}/{props.historyCount}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto ed-scroll flex flex-col gap-1 pr-1">
                {/* History list stub */}
                <div className="ed-layer-item text-white/50 text-xs italic">
                   State history is managed in canvas.
                </div>
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                <button className="ed-tool-btn flex-1 flex gap-2" onClick={props.onUndo}><Undo2 size={14}/> Undo</button>
                <button className="ed-tool-btn flex-1 flex gap-2" onClick={props.onRedo}><Redo2 size={14}/> Redo</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function AdjustmentSlider({ label, min, max, value, onChange, formatter }: { label: string, min: number, max: number, value: number, onChange: (v: number) => void, formatter?: (v: number) => string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <label className="text-xs text-white/80">{label}</label>
        <span className="text-[10px] font-mono text-white/40">{formatter ? formatter(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="ed-slider"
      />
    </div>
  );
}

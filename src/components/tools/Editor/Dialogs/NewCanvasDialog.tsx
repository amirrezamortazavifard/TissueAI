import { useState } from "react";

interface NewCanvasDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (width: number, height: number, bgColor: string) => void;
}

const PRESETS = [
  { label: "Custom", w: 0, h: 0 },
  { label: "HD (1280×720)", w: 1280, h: 720 },
  { label: "Full HD (1920×1080)", w: 1920, h: 1080 },
  { label: "4K (3840×2160)", w: 3840, h: 2160 },
  { label: "A4 (2480×3508)", w: 2480, h: 3508 },
  { label: "Square (1024×1024)", w: 1024, h: 1024 },
  { label: "Small (640×480)", w: 640, h: 480 },
];

export default function NewCanvasDialog({ open, onClose, onCreate }: NewCanvasDialogProps) {
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [bgColor, setBgColor] = useState("#ffffff");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-panel rounded-xl p-5 w-[360px] animate-scale-in">
        <h3 className="text-sm font-semibold text-white/80 mb-4">New Canvas</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Preset</label>
            <select
              className="input-field w-full"
              onChange={(e) => {
                const p = PRESETS[parseInt(e.target.value)];
                if (p.w > 0) { setWidth(p.w); setHeight(p.h); }
              }}
            >
              {PRESETS.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-white/40 mb-1 block">Width (px)</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value) || 1)}
                className="input-field w-full"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-white/40 mb-1 block">Height (px)</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value) || 1)}
                className="input-field w-full"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1 block">Background</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <button
                onClick={() => setBgColor("#ffffff")}
                className="btn-small"
              >
                White
              </button>
              <button
                onClick={() => setBgColor("transparent")}
                className="btn-small"
              >
                Transparent
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => { onCreate(width, height, bgColor); onClose(); }} className="btn-primary">Create</button>
        </div>
      </div>
    </div>
  );
}

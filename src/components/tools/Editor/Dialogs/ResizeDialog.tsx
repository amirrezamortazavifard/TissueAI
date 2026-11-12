import { useState } from "react";

interface ResizeDialogProps {
  open: boolean;
  onClose: () => void;
  onResize: (width: number, height: number) => void;
  currentWidth: number;
  currentHeight: number;
}

export default function ResizeDialog({ open, onClose, onResize, currentWidth, currentHeight }: ResizeDialogProps) {
  const [mode, setMode] = useState<"pixels" | "percent">("pixels");
  const [width, setWidth] = useState(currentWidth);
  const [height, setHeight] = useState(currentHeight);
  const [percent, setPercent] = useState(100);
  const [maintainAspect, setMaintainAspect] = useState(true);

  if (!open) return null;

  const aspect = currentWidth / currentHeight;

  const handleWidthChange = (w: number) => {
    setWidth(w);
    if (maintainAspect) setHeight(Math.round(w / aspect));
  };

  const handleHeightChange = (h: number) => {
    setHeight(h);
    if (maintainAspect) setWidth(Math.round(h * aspect));
  };

  const handlePercentChange = (p: number) => {
    setPercent(p);
    setWidth(Math.round(currentWidth * p / 100));
    setHeight(Math.round(currentHeight * p / 100));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-panel rounded-xl p-5 w-[360px] animate-scale-in">
        <h3 className="text-sm font-semibold text-white/80 mb-4">Resize Canvas</h3>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("pixels")}
            className={`btn-small ${mode === "pixels" ? "active" : ""}`}
          >
            Pixels
          </button>
          <button
            onClick={() => setMode("percent")}
            className={`btn-small ${mode === "percent" ? "active" : ""}`}
          >
            Percent
          </button>
        </div>

        <div className="space-y-3">
          {mode === "pixels" ? (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-white/40 mb-1 block">Width</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={width}
                  onChange={(e) => handleWidthChange(parseInt(e.target.value) || 1)}
                  className="input-field w-full"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-white/40 mb-1 block">Height</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={height}
                  onChange={(e) => handleHeightChange(parseInt(e.target.value) || 1)}
                  className="input-field w-full"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-white/40 mb-1 block">Percentage</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={percent}
                onChange={(e) => handlePercentChange(parseInt(e.target.value) || 1)}
                className="input-field w-full"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
            <input
              type="checkbox"
              checked={maintainAspect}
              onChange={(e) => setMaintainAspect(e.target.checked)}
              className="rounded"
            />
            Maintain aspect ratio
          </label>
        </div>

        <div className="text-xs text-white/30 mt-3">
          Current: {currentWidth} × {currentHeight} px
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => { onResize(width, height); onClose(); }} className="btn-primary">Apply</button>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";

interface EditColorsDialogProps {
  open: boolean;
  onClose: () => void;
  currentColor: string;
  onColorSelect: (color: string) => void;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export default function EditColorsDialog({ open, onClose, currentColor, onColorSelect }: EditColorsDialogProps) {
  const [hex, setHex] = useState(currentColor);
  const [hsl, setHsl] = useState(() => hexToHsl(currentColor));
  const wheelRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open) {
      setHex(currentColor);
      setHsl(hexToHsl(currentColor));
    }
  }, [open, currentColor]);

  useEffect(() => {
    const canvas = wheelRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = 180;
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2, cy = size / 2, r = size / 2 - 5;

    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `hsl(${angle}, 100%, 100%)`);
      grad.addColorStop(1, `hsl(${angle}, 100%, 50%)`);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    const satRadius = (hsl.s / 100) * r;
    const angleRad = (hsl.h * Math.PI) / 180;
    const px = cx + Math.cos(angleRad) * satRadius;
    const py = cy + Math.sin(angleRad) * satRadius;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [hsl]);

  const handleHexChange = (val: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setHex(val);
      setHsl(hexToHsl(val));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-panel rounded-xl p-5 w-[340px] animate-scale-in">
        <h3 className="text-sm font-semibold text-white/80 mb-4">Edit Colors</h3>

        <div className="flex gap-4">
          <canvas
            ref={wheelRef}
            className="rounded-lg cursor-crosshair flex-shrink-0"
            onClick={(e) => {
              const canvas = e.currentTarget;
              const rect = canvas.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const cx = canvas.width / 2, cy = canvas.height / 2;
              const r = canvas.width / 2 - 5;
              const dx = x - cx, dy = y - cy;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= r) {
                const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                const sat = Math.round((dist / r) * 100);
                const newHsl = { h: Math.round(angle), s: sat, l: hsl.l };
                setHsl(newHsl);
                setHex(hslToHex(newHsl.h, newHsl.s, newHsl.l));
              }
            }}
          />

          <div className="flex-1 space-y-3">
            <div>
              <label className="text-xs text-white/40 block mb-1">Hex</label>
              <input
                type="text"
                value={hex}
                onChange={(e) => handleHexChange(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1">H: {hsl.h}°</label>
              <input
                type="range"
                min={0}
                max={360}
                value={hsl.h}
                onChange={(e) => {
                  const newH = parseInt(e.target.value);
                  setHsl((p) => ({ ...p, h: newH }));
                  setHex(hslToHex(newH, hsl.s, hsl.l));
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1">S: {hsl.s}%</label>
              <input
                type="range"
                min={0}
                max={100}
                value={hsl.s}
                onChange={(e) => {
                  const newS = parseInt(e.target.value);
                  setHsl((p) => ({ ...p, s: newS }));
                  setHex(hslToHex(hsl.h, newS, hsl.l));
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1">L: {hsl.l}%</label>
              <input
                type="range"
                min={0}
                max={100}
                value={hsl.l}
                onChange={(e) => {
                  const newL = parseInt(e.target.value);
                  setHsl((p) => ({ ...p, l: newL }));
                  setHex(hslToHex(hsl.h, hsl.s, newL));
                }}
                className="w-full"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <div className="w-10 h-10 rounded border border-white/10" style={{ backgroundColor: currentColor }} />
              <span className="text-white/30">→</span>
              <div className="w-10 h-10 rounded border border-white/10" style={{ backgroundColor: hex }} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => { onColorSelect(hex); onClose(); }} className="btn-primary">OK</button>
        </div>
      </div>
    </div>
  );
}

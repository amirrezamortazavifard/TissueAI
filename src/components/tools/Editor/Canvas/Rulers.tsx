interface RulersProps {
  zoom: number;
  panX: number;
  panY: number;
  canvasWidth: number;
  canvasHeight: number;
  showRulers: boolean;
}

export default function Rulers({ zoom, panX, panY, canvasWidth, canvasHeight, showRulers }: RulersProps) {
  if (!showRulers) return null;

  const rulerSize = 20;
  const step = zoom >= 2 ? 10 : zoom >= 1 ? 50 : 100;

  const horizontalMarks: { pos: number; label: number }[] = [];
  const verticalMarks: { pos: number; label: number }[] = [];

  const startX = Math.floor(-panX / zoom / step) * step;
  const endX = Math.ceil((-panX + canvasWidth * zoom) / zoom / step) * step;
  for (let x = startX; x <= endX; x += step) {
    horizontalMarks.push({ pos: x * zoom + panX, label: x });
  }

  const startY = Math.floor(-panY / zoom / step) * step;
  const endY = Math.ceil((-panY + canvasHeight * zoom) / zoom / step) * step;
  for (let y = startY; y <= endY; y += step) {
    verticalMarks.push({ pos: y * zoom + panY, label: y });
  }

  return (
    <>
      {/* Horizontal ruler */}
      <div
        className="absolute top-0 left-[20px] right-0 bg-black/30 border-b border-white/5 z-10 overflow-hidden"
        style={{ height: rulerSize }}
      >
        <svg width="100%" height={rulerSize}>
          {horizontalMarks.map((m, i) => (
            <g key={i}>
              <line x1={m.pos} y1={rulerSize} x2={m.pos} y2={rulerSize - 8} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
              <text x={m.pos + 2} y={10} fill="rgba(255,255,255,0.35)" fontSize={8} fontFamily="monospace">
                {m.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Vertical ruler */}
      <div
        className="absolute left-0 top-[20px] bottom-0 bg-black/30 border-r border-white/5 z-10 overflow-hidden"
        style={{ width: rulerSize }}
      >
        <svg width={rulerSize} height="100%">
          {verticalMarks.map((m, i) => (
            <g key={i}>
              <line x1={rulerSize} y1={m.pos} x2={rulerSize - 8} y2={m.pos} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
              <text
                x={10}
                y={m.pos - 2}
                fill="rgba(255,255,255,0.35)"
                fontSize={8}
                fontFamily="monospace"
                transform={`rotate(-90, 10, ${m.pos - 2})`}
              >
                {m.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}

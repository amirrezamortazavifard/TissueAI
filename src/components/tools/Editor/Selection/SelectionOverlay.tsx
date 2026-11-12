import { useEffect, useRef, useState } from "react";
import { Selection } from "../Utils/types";

interface SelectionOverlayProps {
  selection: Selection | null;
  zoom: number;
  onUpdate?: (sel: Selection | null) => void;
  onCommit?: (sel: Selection) => void;
  onCancel?: () => void;
}

export default function SelectionOverlay({ selection, zoom, onUpdate: _onUpdate, onCommit: _onCommit, onCancel: _onCancel }: SelectionOverlayProps) {
  const animFrame = useRef(0);
  const [marchOffset, setMarchOffset] = useState(0);

  useEffect(() => {
    if (!selection) return;
    let running = true;
    const animate = () => {
      if (!running) return;
      setMarchOffset((p) => (p + 1) % 16);
      animFrame.current = requestAnimationFrame(animate);
    };
    animFrame.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(animFrame.current);
    };
  }, [selection]);

  if (!selection) return null;

  const { rect } = selection;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: rect.x * zoom,
        top: rect.y * zoom,
        width: rect.w * zoom,
        height: rect.h * zoom,
      }}
    >
      <div
        className="absolute inset-0 border border-dashed"
        style={{
          borderColor: "transparent",
          backgroundImage: `repeating-linear-gradient(0deg, #000 0, #000 4px, #fff 4px, #fff 8px), repeating-linear-gradient(90deg, #000 0, #000 4px, #fff 4px, #fff 8px)`,
          backgroundSize: "8px 8px",
          backgroundPosition: `${marchOffset}px ${marchOffset}px`,
          pointerEvents: "auto",
          cursor: "move",
        }}
      />
      {/* Corner handles */}
      {[
        { top: -4, left: -4, cursor: "nw-resize" },
        { top: -4, right: -4, cursor: "ne-resize" },
        { bottom: -4, left: -4, cursor: "sw-resize" },
        { bottom: -4, right: -4, cursor: "se-resize" },
      ].map((style, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-white border border-blue-500 rounded-sm pointer-events-auto"
          style={style}
        />
      ))}
    </div>
  );
}

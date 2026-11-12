import { MousePointer2, ZoomIn, Scaling } from "lucide-react";
import { Tool } from "../Utils/types";

interface StatusBarProps {
  mouseX: number;
  mouseY: number;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  currentTool: Tool;
  imageLoaded: boolean;
}

export default function StatusBar({
  mouseX,
  mouseY,
  canvasWidth,
  canvasHeight,
  zoom,
  currentTool,
  imageLoaded,
}: StatusBarProps) {
  const formatCoord = (val: number) => {
    if (!imageLoaded) return "0";
    if (val < 0 || val > (canvasWidth > canvasHeight ? canvasWidth : canvasHeight) * 2) return "-";
    return Math.floor(val).toString();
  };

  return (
    <div className="ed-statusbar">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5" title="Pointer Coordinates">
          <MousePointer2 size={12} className="text-white/40" />
          <span className="w-20">
            {formatCoord(mouseX)}, {formatCoord(mouseY)} px
          </span>
        </div>

        <div className="flex items-center gap-1.5" title="Canvas Resolution">
          <Scaling size={12} className="text-white/40" />
          <span className="w-24">
            {imageLoaded ? `${canvasWidth} × ${canvasHeight} px` : "--- × --- px"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-white/10 pl-4" title="Active Tool">
          <span className="capitalize text-white/70">
            {currentTool.replace(/([A-Z])/g, ' $1').trim()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {imageLoaded && (
          <div className="flex items-center gap-2 text-white/50 text-[10px] italic pr-2 border-r border-white/10">
            <span>{canvasWidth * canvasHeight > 1000000 ? ((canvasWidth * canvasHeight * 4) / 1024 / 1024).toFixed(1) + " MB in RAM" : ""}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5" title="Zoom Level">
          <ZoomIn size={12} className="text-white/40" />
          <span className="w-12 text-right">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

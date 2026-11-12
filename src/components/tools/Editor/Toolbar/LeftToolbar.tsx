import {
  MousePointer2, Paintbrush, Eraser, Minus, Square, Circle,
  Type, Pipette, PaintBucket, Search, Spline, Undo2, Redo2, Save,
  Upload, Slash, Pentagon, Eraser as ColorEraserIcon, SprayCan,
  Ruler, Microscope, CheckCircle2, MapPin, Wand2
} from "lucide-react";
import { Tool } from "../Utils/types";

interface LeftToolbarProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onLoadImage: () => void;
  onSaveImage: () => void;
  imageLoaded: boolean;
}

const TOOL_GROUPS = [
  // Navigate
  {
    group: "navigate",
    tools: [
      { tool: "magnifier", icon: <Search size={16} />, label: "Zoom (Z)" },
    ],
  },
  // Select
  {
    group: "select",
    tools: [
      { tool: "select", icon: <Square size={16} style={{ border: '1px dashed currentColor', borderRadius: 2 }} />, label: "Marquee (M)" },
      { tool: "freeSelect", icon: <MousePointer2 size={16} style={{ clipPath: "polygon(0 0, 100% 0, 80% 100%, 20% 80%)" }} />, label: "Lasso (L)" },
      { tool: "lassoPolygonal", icon: <Pentagon size={16} style={{ border: '1px dashed currentColor', borderRadius: 2 }} />, label: "Polygonal Lasso" },
      { tool: "magicWand", icon: <Wand2 size={16} />, label: "Magic Wand (W)" },
    ],
  },
  // Medical & Pathology
  {
    group: "medical",
    tools: [
      { tool: "measure", icon: <Ruler size={16} />, label: "Measure Distance" },
      { tool: "roi", icon: <Square size={16} style={{ border: '2px solid currentColor', borderRadius: 2 }} />, label: "Region of Interest (ROI)" },
      { tool: "cellCounter", icon: <CheckCircle2 size={16} />, label: "Cell Counter" },
      { tool: "annotationPin", icon: <MapPin size={16} />, label: "Annotation Pin" },
      { tool: "stainAnalysis", icon: <Microscope size={16} />, label: "Stain Analysis" },
    ],
  },
  // Draw
  {
    group: "draw",
    tools: [
      { tool: "brush", icon: <Paintbrush size={16} />, label: "Brush (B)" },
      { tool: "pencil", icon: <Slash size={16} />, label: "Pencil (N)" },
      { tool: "airbrush", icon: <SprayCan size={16} />, label: "Airbrush (A)" },
      { tool: "cloneStamp", icon: <Circle size={16} style={{ border: '2px dotted currentColor' }} />, label: "Clone Stamp (S)" },
    ],
  },
  // Erase
  {
    group: "erase",
    tools: [
      { tool: "eraser", icon: <Eraser size={16} />, label: "Eraser (E)" },
      { tool: "colorEraser", icon: <ColorEraserIcon size={16} />, label: "Color Eraser" },
    ],
  },
  // Fill & Color
  {
    group: "fill",
    tools: [
      { tool: "fill", icon: <PaintBucket size={16} />, label: "Fill (G)" },
      { tool: "gradient", icon: <Square size={16} style={{ background: 'linear-gradient(45deg, currentColor, transparent)' }} />, label: "Gradient" },
      { tool: "eyedropper", icon: <Pipette size={16} />, label: "Color Picker (I)" },
    ],
  },
  // Shapes & Text
  {
    group: "shapes",
    tools: [
      { tool: "line", icon: <Minus size={16} />, label: "Line" },
      { tool: "curve", icon: <Spline size={16} />, label: "Curve" },
      { tool: "rect", icon: <Square size={16} />, label: "Rectangle (U)" },
      { tool: "roundedRect", icon: <Square size={16} style={{ borderRadius: 4 }} />, label: "Rounded Rectangle" },
      { tool: "ellipse", icon: <Circle size={16} />, label: "Ellipse" },
      { tool: "polygon", icon: <Pentagon size={16} />, label: "Polygon" },
    ],
  },
  // Text
  {
    group: "text",
    tools: [
      { tool: "text", icon: <Type size={16} />, label: "Text (T)" },
    ],
  },
];

export default function LeftToolbar({
  currentTool,
  onToolChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onLoadImage,
  onSaveImage,
  imageLoaded,
}: LeftToolbarProps) {
  return (
    <div className="ed-left-toolbar ed-glass-panel">
      {/* File Operations */}
      <div className="flex flex-col gap-1 w-full px-2">
        <button onClick={onLoadImage} className="ed-tool-btn w-full" title="Open Image">
          <Upload size={15} />
        </button>
        <button onClick={onSaveImage} className="ed-tool-btn w-full" title="Save Image" disabled={!imageLoaded}>
          <Save size={15} />
        </button>
      </div>

      <div className="ed-toolbar-divider" />

      {/* Tools */}
      <div className="flex flex-col gap-1 w-full px-2 ed-scroll overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {TOOL_GROUPS.map((group, groupIdx) => (
          <div key={group.group} className="flex flex-col gap-1 w-full items-center">
            {group.tools.map(({ tool, icon, label }) => (
              <button
                key={tool}
                onClick={() => onToolChange(tool as Tool)}
                className={`ed-tool-btn w-full ${currentTool === tool ? "active" : ""}`}
                title={label}
              >
                {icon}
              </button>
            ))}
            {groupIdx < TOOL_GROUPS.length - 1 && <div className="ed-toolbar-divider" />}
          </div>
        ))}
      </div>

      <div className="ed-toolbar-divider" />

      {/* Undo / Redo */}
      <div className="flex flex-col gap-1 w-full px-2">
        <button onClick={onUndo} className="ed-tool-btn w-full" title="Undo (Ctrl+Z)" disabled={!canUndo}>
          <Undo2 size={15} />
        </button>
        <button onClick={onRedo} className="ed-tool-btn w-full" title="Redo (Ctrl+Y)" disabled={!canRedo}>
          <Redo2 size={15} />
        </button>
      </div>
    </div>
  );
}

import { Tool, BrushType, MeasureUnit, StainPreset } from "../Utils/types";

interface ToolOptionsBarProps {
  tool: Tool;
  penColor: string;
  penThickness: number;
  eraserThickness: number;
  brushType: BrushType;
  fillColor: string;
  strokeColor: string;
  fontSize: number;
  fontFamily: string;
  fontBold: boolean;
  fontItalic: boolean;
  floodFillTolerance: number;
  roundedRectRadius: number;
  
  // New options
  brushHardness: number;
  brushOpacity: number;
  measureUnit: MeasureUnit;
  stainPreset: StainPreset;
  
  onPenColorChange: (c: string) => void;
  onPenThicknessChange: (t: number) => void;
  onEraserThicknessChange: (t: number) => void;
  onBrushTypeChange: (b: BrushType) => void;
  onFillColorChange: (c: string) => void;
  onStrokeColorChange: (c: string) => void;
  onFontSizeChange: (s: number) => void;
  onFontFamilyChange: (f: string) => void;
  onFontBoldChange: (b: boolean) => void;
  onFontItalicChange: (i: boolean) => void;
  onFloodFillToleranceChange: (t: number) => void;
  onRoundedRectRadiusChange: (r: number) => void;
  
  // New option handlers
  onBrushHardnessChange: (h: number) => void;
  onBrushOpacityChange: (o: number) => void;
  onMeasureUnitChange: (u: MeasureUnit) => void;
  onStainPresetChange: (p: StainPreset) => void;

  systemFonts: string[];
}

const BRUSH_TYPES: { value: BrushType; label: string }[] = [
  { value: "default", label: "Default Round" },
  { value: "soft", label: "Soft Airbrush" },
  { value: "watercolor", label: "Watercolor" },
  { value: "crayon", label: "Crayon" },
  { value: "marker", label: "Marker" },
  { value: "stipple", label: "Stipple" },
];

export default function ToolOptionsBar(props: ToolOptionsBarProps) {
  const { tool } = props;
  
  const showThickness = ["pencil", "brush", "airbrush", "line", "rect", "roundedRect", "ellipse", "curve", "polygon", "cloneStamp", "eraser", "colorEraser", "measure", "roi"].includes(tool);
  const showBrushType = ["brush", "airbrush"].includes(tool);
  const showBrushAdvanced = ["brush", "airbrush", "cloneStamp", "eraser"].includes(tool);
  const showFillStroke = ["rect", "roundedRect", "ellipse", "polygon", "roi", "gradient"].includes(tool);
  const showText = tool === "text";
  const showTolerance = ["fill", "magicWand", "colorEraser"].includes(tool);
  const showRoundedRadius = tool === "roundedRect";
  const showMeasure = tool === "measure";
  const showStain = tool === "stainAnalysis";

  return (
    <div className="ed-contextbar">
      {/* Dynamic icon based on tool */}
      <div className="flex items-center gap-2 pr-4 border-r border-white/10 mr-2 flex-shrink-0">
        <span className="font-semibold text-white/80 capitalize text-xs tracking-wider">
          {tool.replace(/([A-Z])/g, ' $1').trim()}
        </span>
      </div>

      {showThickness && (
        <div className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
          <span className="text-white/60 text-xs">Size</span>
          <input
            type="range"
            min={1}
            max={tool === "pencil" ? 10 : 200}
            value={tool === "eraser" || tool === "colorEraser" ? props.eraserThickness : props.penThickness}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (tool === "eraser" || tool === "colorEraser") props.onEraserThicknessChange(val);
              else props.onPenThicknessChange(val);
            }}
            className="ed-slider w-24"
          />
          <span className="w-8 text-right font-mono text-white/80 text-xs">
            {tool === "eraser" || tool === "colorEraser" ? props.eraserThickness : props.penThickness}px
          </span>
        </div>
      )}

      {showBrushAdvanced && (
        <>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0 whitespace-nowrap">
            <span className="text-white/60 text-xs">Hardness</span>
            <input
              type="range"
              min={0}
              max={100}
              value={props.brushHardness}
              onChange={(e) => props.onBrushHardnessChange(parseInt(e.target.value))}
              className="ed-slider w-20"
            />
            <span className="w-8 text-right font-mono text-white/80 text-xs">{props.brushHardness}%</span>
          </div>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0 whitespace-nowrap">
            <span className="text-white/60 text-xs">Opacity</span>
            <input
              type="range"
              min={1}
              max={100}
              value={props.brushOpacity}
              onChange={(e) => props.onBrushOpacityChange(parseInt(e.target.value))}
              className="ed-slider w-20"
            />
            <span className="w-8 text-right font-mono text-white/80 text-xs">{props.brushOpacity}%</span>
          </div>
        </>
      )}

      {showBrushType && (
        <div className="flex items-center gap-2 ml-2 flex-shrink-0 whitespace-nowrap">
          <span className="text-white/60 text-xs">Type</span>
          <select
            value={props.brushType}
            onChange={(e) => props.onBrushTypeChange(e.target.value as BrushType)}
            className="ed-select"
          >
            {BRUSH_TYPES.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
      )}

      {showFillStroke && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-white/60">Fill</span>
            <input
              type="color"
              value={props.fillColor === "transparent" ? "#000000" : props.fillColor}
              onChange={(e) => props.onFillColorChange(e.target.value)}
              className="w-5 h-5 rounded cursor-pointer border-none p-0 bg-transparent"
            />
            <button
              onClick={() => props.onFillColorChange(props.fillColor === "transparent" ? "#000000" : "transparent")}
              className={`ed-tool-btn h-6 px-2 w-auto text-[10px] ${props.fillColor === "transparent" ? "active" : ""}`}
            >
              {props.fillColor === "transparent" ? "No Fill" : "Clear"}
            </button>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-white/60">Stroke</span>
            <input
              type="color"
              value={props.strokeColor}
              onChange={(e) => props.onStrokeColorChange(e.target.value)}
              className="w-5 h-5 rounded cursor-pointer border-none p-0 bg-transparent"
            />
          </div>
        </>
      )}

      {showText && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-white/60">Font</span>
            <select
              value={props.fontFamily}
              onChange={(e) => props.onFontFamilyChange(e.target.value)}
              className="ed-select w-32"
            >
              {props.systemFonts.length > 0
                ? props.systemFonts.map((f) => <option key={f} value={f}>{f}</option>)
                : ["Arial", "Times New Roman", "Courier New", "Inter"].map((f) => <option key={f} value={f}>{f}</option>)
              }
            </select>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-white/60">Size</span>
            <input
              type="number"
              min={6}
              max={200}
              value={props.fontSize}
              onChange={(e) => props.onFontSizeChange(parseInt(e.target.value) || 16)}
              className="ed-input w-16"
            />
          </div>
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => props.onFontBoldChange(!props.fontBold)}
              className={`ed-tool-btn h-6 w-6 font-bold ${props.fontBold ? "active" : ""}`}
            >
              B
            </button>
            <button
              onClick={() => props.onFontItalicChange(!props.fontItalic)}
              className={`ed-tool-btn h-6 w-6 italic font-serif ${props.fontItalic ? "active" : ""}`}
            >
              I
            </button>
          </div>
        </>
      )}

      {showTolerance && (
        <div className="flex items-center gap-2">
          <span className="text-white/60">Tolerance</span>
          <input
            type="range"
            min={0}
            max={100}
            value={props.floodFillTolerance}
            onChange={(e) => props.onFloodFillToleranceChange(parseInt(e.target.value))}
            className="ed-slider w-24"
          />
          <span className="w-8 text-right font-mono text-white/80">{props.floodFillTolerance}</span>
        </div>
      )}

      {showRoundedRadius && (
        <div className="flex items-center gap-2 ml-4">
          <span className="text-white/60">Radius</span>
          <input
            type="range"
            min={1}
            max={100}
            value={props.roundedRectRadius}
            onChange={(e) => props.onRoundedRectRadiusChange(parseInt(e.target.value))}
            className="ed-slider w-24"
          />
          <span className="w-8 text-right font-mono text-white/80">{props.roundedRectRadius}px</span>
        </div>
      )}

      {showMeasure && (
        <div className="flex items-center gap-2">
          <span className="text-white/60">Unit</span>
          <select
            value={props.measureUnit}
            onChange={(e) => props.onMeasureUnitChange(e.target.value as MeasureUnit)}
            className="ed-select"
          >
            <option value="px">Pixels (px)</option>
            <option value="µm">Micrometers (µm)</option>
            <option value="mm">Millimeters (mm)</option>
          </select>
        </div>
      )}

      {showStain && (
        <div className="flex items-center gap-2">
          <span className="text-white/60">Stain Preset</span>
          <select
            value={props.stainPreset}
            onChange={(e) => props.onStainPresetChange(e.target.value as StainPreset)}
            className="ed-select"
          >
            <option value="he">H&E (Hematoxylin & Eosin)</option>
            <option value="dab">DAB (IHC)</option>
            <option value="masson">Masson's Trichrome</option>
            <option value="pas">PAS</option>
            <option value="custom">Custom Deconvolution...</option>
          </select>
        </div>
      )}

      {!showThickness && !showBrushType && !showBrushAdvanced && !showFillStroke && !showText && !showTolerance && !showRoundedRadius && !showMeasure && !showStain && (
        <span className="text-white/20 italic">No advanced options for this tool</span>
      )}
    </div>
  );
}

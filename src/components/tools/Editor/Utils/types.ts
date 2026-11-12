export type Tool =
  | "select"
  | "freeSelect"
  | "lassoPolygonal"
  | "magicWand"
  | "eraser"
  | "fill"
  | "eyedropper"
  | "magnifier"
  | "pencil"
  | "brush"
  | "airbrush"
  | "cloneStamp"
  | "text"
  | "colorEraser"
  | "line"
  | "curve"
  | "rect"
  | "roundedRect"
  | "ellipse"
  | "polygon"
  | "gradient"
  | "pan"
  // Medical / Pathology tools (stubs ready for Rust IPC)
  | "measure"
  | "roi"
  | "cellCounter"
  | "annotationPin"
  | "stainAnalysis";

export type BrushType = "default" | "watercolor" | "crayon" | "airbrush" | "calligraphy" | "marker" | "soft" | "stipple";

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "softLight"
  | "hardLight"
  | "colorDodge"
  | "colorBurn"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity"
  | "darken"
  | "lighten";

export const BLEND_MODE_LABELS: Record<BlendMode, string> = {
  normal: "Normal",
  multiply: "Multiply",
  screen: "Screen",
  overlay: "Overlay",
  softLight: "Soft Light",
  hardLight: "Hard Light",
  colorDodge: "Color Dodge",
  colorBurn: "Color Burn",
  difference: "Difference",
  exclusion: "Exclusion",
  hue: "Hue",
  saturation: "Saturation",
  color: "Color",
  luminosity: "Luminosity",
  darken: "Darken",
  lighten: "Lighten",
};

export const CANVAS_BLEND_MODE_MAP: Record<BlendMode, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  softLight: "soft-light",
  hardLight: "hard-light",
  colorDodge: "color-dodge",
  colorBurn: "color-burn",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
  darken: "darken",
  lighten: "lighten",
};

export type OutlineStyle = "solid" | "dashed" | "dotted";
export type FillStyle = "solid" | "hatch" | "crosshatch" | "none";
export type MeasureUnit = "px" | "µm" | "mm";
export type StainPreset = "he" | "dab" | "masson" | "pas" | "giemsa" | "custom";

export interface CanvasSize {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ColorPair {
  primary: string;
  secondary: string;
}

export interface HistoryEntry {
  imageData: ImageData;
  width: number;
  height: number;
}

export interface LayerHistoryEntry {
  layers: LayerSnapshot[];
  activeLayerId: string;
  label: string;
}

export interface LayerSnapshot {
  id: string;
  imageData: ImageData | null;
  width: number;
  height: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0–100
  blendMode: BlendMode;
  isGroup?: boolean;
  thumbnail?: string; // base64 mini preview
}

export interface Selection {
  type: "rect" | "freeform";
  path?: Point[];
  rect: { x: number; y: number; w: number; h: number };
  imageData?: ImageData;
  transparent: boolean;
  moving: boolean;
  resizing: boolean;
}

export interface CurveState {
  phase: 0 | 1 | 2;
  startPoint: Point;
  endPoint: Point;
  control1: Point;
  control2: Point;
}

export interface PolygonState {
  points: Point[];
  closed: boolean;
}

export interface ImageAdjustments {
  brightness: number;     // -100 to 100
  contrast: number;       // -100 to 100
  exposure: number;       // -100 to 100
  highlights: number;     // -100 to 100
  shadows: number;        // -100 to 100
  whites: number;         // -100 to 100
  blacks: number;         // -100 to 100
  hue: number;            // -180 to 180
  saturation: number;     // -100 to 100
  lightness: number;      // -100 to 100
  vibrance: number;       // 0 to 100
  sharpness: number;      // 0 to 100
  blur: number;           // 0 to 100
  noise: number;          // 0 to 100
  temperature: number;    // -100 to 100
  tint: number;           // -100 to 100
  gamma: number;          // 0.1 to 4.0 — medical
  stainIntensity: number; // 0 to 100 — medical H&E
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0, contrast: 0, exposure: 0,
  highlights: 0, shadows: 0, whites: 0, blacks: 0,
  hue: 0, saturation: 0, lightness: 0, vibrance: 0,
  sharpness: 0, blur: 0, noise: 0,
  temperature: 0, tint: 0, gamma: 1.0,
  stainIntensity: 50,
};

export interface MedicalAnnotation {
  id: string;
  type: "pin" | "roi" | "measurement" | "count";
  x: number;
  y: number;
  label: string;
  color: string;
  unit?: MeasureUnit;
  value?: number;
}

export interface EditorConfig {
  canvasWidth: number;
  canvasHeight: number;
  bgColor: string;
  zoom: number;
  panX: number;
  panY: number;
  showRulers: boolean;
  showGrid: boolean;
  gridSize: number;
  showStatusBar: boolean;
  zoomLevel: number;
}

// Medical stain color presets
export const MEDICAL_STAIN_COLORS: { label: string; colors: string[] }[] = [
  {
    label: "H&E",
    colors: ["#C86B85", "#8B5F96", "#E8B4BC", "#4A3060", "#F5E6E8", "#2D1B3D"],
  },
  {
    label: "DAB",
    colors: ["#8B4513", "#A0522D", "#D2691E", "#F4A460", "#DEB887", "#FFDEAD"],
  },
  {
    label: "Masson",
    colors: ["#1E5FAD", "#2980B9", "#A52A2A", "#C0392B", "#ECF0F1", "#BDC3C7"],
  },
  {
    label: "PAS",
    colors: ["#8E44AD", "#9B59B6", "#6C3483", "#F1948A", "#922B21", "#1A5276"],
  },
  {
    label: "Classic",
    colors: [
      "#000000", "#808080", "#800000", "#808000",
      "#008000", "#008080", "#000080", "#800080",
      "#ffffff", "#c0c0c0", "#ff0000", "#ffff00",
      "#00ff00", "#00ffff", "#0000ff", "#ff00ff",
    ],
  },
];

// Legacy MS_PAINT_COLORS kept for backward compat
export const MS_PAINT_COLORS = [
  "#000000", "#808080", "#800000", "#808000",
  "#008000", "#008080", "#000080", "#800080",
  "#808040", "#004040", "#0080ff", "#004080",
  "#4000ff", "#804000",
  "#ffffff", "#c0c0c0", "#ff0000", "#ffff00",
  "#00ff00", "#00ffff", "#0000ff", "#ff00ff",
  "#ffff80", "#00ff80", "#80ffff", "#8080ff",
  "#ff0080", "#ff8040",
];

export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  canvasWidth: 800,
  canvasHeight: 600,
  bgColor: "#ffffff",
  zoom: 1,
  panX: 0,
  panY: 0,
  showRulers: true,
  showGrid: false,
  gridSize: 10,
  showStatusBar: true,
  zoomLevel: 1,
};

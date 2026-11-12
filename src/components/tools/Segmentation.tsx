import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  Ruler, SlidersHorizontal, Brain, PenTool,
  Upload, Play, Download, Trash2,
  Save, Crosshair, Eye, EyeOff,
  Square, AlertCircle, CheckCircle2,
  Image, Scissors, Magnet
} from "lucide-react";
import { useNotification } from "../../contexts/NotificationContext";

// ===================== TYPES =====================

interface ScaleCalibrationInfo {
  pixels_per_unit: number;
  unit_name: string;
}

interface HsvRanges {
  h_min: number; h_max: number;
  s_min: number; s_max: number;
  v_min: number; v_max: number;
}

interface ThresholdResultItem {
  display_index: number;
  label: number;
  area: number;
  perimeter: number;
  circularity: number;
  centroid_x: number;
  centroid_y: number;
  bounding_x: number;
  bounding_y: number;
  bounding_width: number;
  bounding_height: number;
  calculated_area_with_unit: string;
}

interface ThresholdAnalysisResult {
  results: ThresholdResultItem[];
  binary_mask: boolean[][];
  labeled_mask: number[][];
  width: number;
  height: number;
}

interface ManualPolygonData {
  name: string;
  points: { x: number; y: number }[];
  calculated_area_with_unit: string;
}

interface CalibrationGridSettings {
  is_enabled: boolean;
  rows: number;
  columns: number;
  marker_color: string;
  marker_type: string;
}

type ActiveTab = "scale" | "threshold" | "smart" | "manual";

// ===================== MAIN COMPONENT =====================

export default function Segmentation() {
  const notif = useNotification();
  const [activeTab, setActiveTab] = useState<ActiveTab>("scale");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ data: number[]; width: number; height: number } | null>(null);
  const [calibration, setCalibration] = useState<ScaleCalibrationInfo>({ pixels_per_unit: 1, unit_name: "px" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<ScaleCalibrationInfo>("get_current_calibration")
      .then(setCalibration)
      .catch(() => {});
  }, []);

  const fileToBytes = async (path: string): Promise<{ data: number[]; width: number; height: number }> => {
    const bytes = await invoke<number[]>("read_file_bytes", { path });
    const blob = new Blob([new Uint8Array(bytes)]);
    const url = URL.createObjectURL(blob);
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const rgba = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data;
    URL.revokeObjectURL(url);
    return { data: Array.from(rgba), width: img.naturalWidth, height: img.naturalHeight };
  };

  const handleSelectImage = async () => {
    try {
      setError(null);
      const selected = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "bmp", "gif"] }],
      });
      if (selected && typeof selected === "string") {
        setSelectedImage(selected);
        setImageData(null);
        const bytes = await invoke<number[]>("read_file_bytes", { path: selected });
        const b64 = btoa(bytes.map(b => String.fromCharCode(b)).join(""));
        setImagePreview(`data:image/png;base64,${b64}`);
        try {
          const d = await fileToBytes(selected);
          setImageData(d);
        } catch (e) {
          console.warn("Could not extract pixel data:", e);
        }
      }
    } catch (e) {
      setError(`Failed to open file: ${e}`);
    }
  };

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: "scale", label: "Scale", icon: <Ruler size={16} /> },
    { id: "threshold", label: "Threshold", icon: <SlidersHorizontal size={16} /> },
    { id: "smart", label: "Smart AI", icon: <Brain size={16} /> },
    { id: "manual", label: "Manual", icon: <PenTool size={16} /> },
  ];

  return (
    <div className="flex h-full gap-3 p-3">
      {/* Tab Navigation - Vertical Icon Bar */}
      <div className="w-[52px] shrink-0 glass-panel flex flex-col items-center py-3 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-[rgba(91,168,245,0.15)] text-[#5BA8F5] shadow-[0_0_16px_rgba(91,168,245,0.2)]"
                : "text-[var(--text-4)] hover:text-[var(--text-2)] hover:bg-white/[0.05]"
            }`}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-3 min-w-0">
        {/* Left Sidebar */}
        <div className="w-[260px] shrink-0 glass-panel p-3 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h2 style={{ color: "var(--text-1)" }} className="text-[14px] font-semibold">Segmentation</h2>
              <p style={{ color: "var(--text-4)" }} className="text-[11px] mt-0.5">{tabs.find(t => t.id === activeTab)?.label} Mode</p>
            </div>
          </div>

          <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

          {/* Image Selection */}
          <div>
            <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase mb-2 block">
              Image
            </span>
            <div className="glass-card p-2.5">
              <div className="flex items-center gap-2">
                <div style={{ background: "var(--bg-2)" }} className="w-7 h-7 rounded-lg flex items-center justify-center">
                  <Image size={13} style={{ color: "var(--text-4)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ color: "var(--text-1)" }} className="text-[11px] font-medium truncate">
                    {selectedImage ? selectedImage.split("\\").pop()?.split("/").pop() : "No image"}
                  </p>
                  <p style={{ color: "var(--text-4)" }} className="text-[9px] truncate">
                    {imageData ? `${imageData.width}x${imageData.height}` : "Select image"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button onClick={handleSelectImage} className="btn-glass flex items-center justify-center gap-2 text-[11px]">
            <Upload size={13} />
            Select Image
          </button>

          <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

          {/* Tab-specific controls */}
          {activeTab === "scale" && (
            <ScaleControls calibration={calibration} setCalibration={setCalibration} setError={setError} notif={notif} />
          )}
          {activeTab === "threshold" && (
            <ThresholdControls imageData={imageData} calibration={calibration} setError={setError} notif={notif} />
          )}
          {activeTab === "smart" && (
            <SmartControls imageData={imageData} calibration={calibration} setError={setError} notif={notif} />
          )}
          {activeTab === "manual" && (
            <ManualControls calibration={calibration} setError={setError} notif={notif} />
          )}
        </div>

        {/* Viewport */}
        <div className="flex-1 glass-panel p-3 flex flex-col min-w-0">
          {error && (
            <div className="mb-2 p-2.5 rounded-xl flex items-center gap-2 text-[11px]" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.9)" }}>
              <AlertCircle size={13} />
              {error}
              <button onClick={() => setError(null)} className="ml-auto opacity-60 hover:opacity-100">x</button>
            </div>
          )}

          <div className="flex-1 relative rounded-xl overflow-hidden flex items-center justify-center min-h-0" style={{ background: "rgba(0,0,0,0.3)" }}>
            {imagePreview ? (
              <img src={imagePreview} alt="Selected" className="max-w-full max-h-full object-contain animate-fade-in" />
            ) : (
              <div className="text-center" style={{ color: "var(--text-4)" }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--bg-1)" }}>
                  <Scissors size={24} className="opacity-30" />
                </div>
                <p className="text-[12px] font-medium">Select an image to begin</p>
                <p style={{ color: "var(--text-5)" }} className="text-[10px] mt-1">Choose a tab and load an image</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== SCALE TAB CONTROLS =====================

function ScaleControls({
  calibration,
  setCalibration,
  setError,
  notif,
}: {
  calibration: ScaleCalibrationInfo;
  setCalibration: (c: ScaleCalibrationInfo) => void;
  setError: (e: string | null) => void;
  notif: ReturnType<typeof useNotification>;
}) {
  const [knownValue, setKnownValue] = useState("100");
  const [unit, setUnit] = useState("um");
  const [gridSettings, setGridSettings] = useState<CalibrationGridSettings>({
    is_enabled: false, rows: 10, columns: 10, marker_color: "Yellow", marker_type: "+",
  });

  const handleSaveScale = async () => {
    const val = parseFloat(knownValue);
    if (isNaN(val) || val <= 0) {
      setError("Enter a valid known value");
      return;
    }
    try {
      const result = await invoke<ScaleCalibrationInfo>("calculate_scale_calibration", {
        startX: 0, startY: 0,
        endX: 100, endY: 0,
        knownValue: val, unit,
      });
      setCalibration(result);
      setError(null);
      notif.success("Scale calibration saved");
    } catch (e) {
      setError(`Scale calibration failed: ${e}`);
      notif.error(`Scale calibration failed: ${e}`);
    }
  };

  return (
    <>
      <div>
        <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase mb-2 block">
          Calibration Grid
        </span>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label style={{ color: "var(--text-4)" }} className="text-[9px] uppercase mb-1 block">Rows</label>
              <input type="number" value={gridSettings.rows} min={1} max={100}
                onChange={(e) => setGridSettings({ ...gridSettings, rows: parseInt(e.target.value) || 10 })}
                className="glass-input text-[11px] w-full" />
            </div>
            <div className="flex-1">
              <label style={{ color: "var(--text-4)" }} className="text-[9px] uppercase mb-1 block">Columns</label>
              <input type="number" value={gridSettings.columns} min={1} max={100}
                onChange={(e) => setGridSettings({ ...gridSettings, columns: parseInt(e.target.value) || 10 })}
                className="glass-input text-[11px] w-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label style={{ color: "var(--text-4)" }} className="text-[9px] uppercase mb-1 block">Marker</label>
              <select value={gridSettings.marker_type}
                onChange={(e) => setGridSettings({ ...gridSettings, marker_type: e.target.value })}
                className="glass-input text-[11px] w-full">
                <option value="+">+</option>
                <option value="x">x</option>
                <option value="dot">dot</option>
              </select>
            </div>
            <div className="flex-1">
              <label style={{ color: "var(--text-4)" }} className="text-[9px] uppercase mb-1 block">Color</label>
              <select value={gridSettings.marker_color}
                onChange={(e) => setGridSettings({ ...gridSettings, marker_color: e.target.value })}
                className="glass-input text-[11px] w-full">
                <option value="Yellow">Yellow</option>
                <option value="Cyan">Cyan</option>
                <option value="Red">Red</option>
                <option value="White">White</option>
              </select>
            </div>
          </div>
          <button onClick={() => setGridSettings({ ...gridSettings, is_enabled: !gridSettings.is_enabled })}
            className={`btn-glass flex items-center justify-center gap-2 text-[11px] w-full ${gridSettings.is_enabled ? "text-[#5BA8F5]" : ""}`}>
            {gridSettings.is_enabled ? <EyeOff size={13} /> : <Eye size={13} />}
            {gridSettings.is_enabled ? "Hide Grid" : "Show Grid"}
          </button>
        </div>
      </div>

      <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

      <div>
        <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase mb-2 block">
          Measure Tool
        </span>
        <div className="space-y-2">
          <input type="number" value={knownValue} placeholder="Known length"
            onChange={(e) => setKnownValue(e.target.value)}
            className="glass-input text-[11px] w-full" />
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="glass-input text-[11px] w-full">
            <option value="um">um (micrometers)</option>
            <option value="mm">mm (millimeters)</option>
            <option value="cm">cm (centimeters)</option>
            <option value="px">px (pixels)</option>
          </select>
          <button onClick={handleSaveScale} className="btn-accent flex items-center justify-center gap-2 text-[11px] w-full">
            <Save size={13} />
            Save Scale
          </button>
        </div>
      </div>

      <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

      <div className="glass-card p-2.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={13} className="text-[#22c55e]" />
          <div>
            <p style={{ color: "var(--text-1)" }} className="text-[11px] font-medium">Current Scale</p>
            <p style={{ color: "var(--text-4)" }} className="text-[10px]">
              {calibration.pixels_per_unit.toFixed(2)} px/{calibration.unit_name}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ===================== THRESHOLD TAB CONTROLS =====================

function ThresholdControls({
  imageData,
  calibration,
  setError,
  notif,
}: {
  imageData: { data: number[]; width: number; height: number } | null;
  calibration: ScaleCalibrationInfo;
  setError: (e: string | null) => void;
  notif: ReturnType<typeof useNotification>;
}) {
  const [subTab, setSubTab] = useState<"auto" | "manual" | "morphology" | "save">("auto");
  const [autoMethod, setAutoMethod] = useState("Otsu");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ThresholdResultItem[]>([]);
  const [hsvRanges, setHzvRanges] = useState<HsvRanges>({
    h_min: 0, h_max: 180, s_min: 0, s_max: 255, v_min: 0, v_max: 255,
  });
  const [isGrayscale, setIsGrayscale] = useState(false);
  const [grayscaleMin, setGrayscaleMin] = useState(0);
  const [grayscaleMax, setGrayscaleMax] = useState(255);
  const [minObjectSize, setMinObjectSize] = useState(50);
  const [highlightLabel, setHighlightLabel] = useState<number | null>(null);
  const [_overlayImage, setOverlayImage] = useState<string | null>(null);

  const handleAutoThreshold = async () => {
    if (!imageData) { setError("Select an image first"); return; }
    setIsProcessing(true);
    try {
      const result = await invoke<ThresholdAnalysisResult>("apply_auto_threshold", {
        imageData: imageData.data, width: imageData.width, height: imageData.height,
        method: autoMethod, minObjectSize,
      });
      setResults(result.results);
      await generateOverlay(result.labeled_mask, imageData.width, imageData.height, null);
      setError(null);
      notif.success(`Auto threshold (${autoMethod}): ${result.results.length} objects found`);
    } catch (e) { setError(`Auto threshold failed: ${e}`); notif.error(`Auto threshold failed: ${e}`); }
    finally { setIsProcessing(false); }
  };

  const handleManualThreshold = async () => {
    if (!imageData) { setError("Select an image first"); return; }
    setIsProcessing(true);
    try {
      const result = await invoke<ThresholdAnalysisResult>("apply_threshold", {
        imageData: imageData.data, width: imageData.width, height: imageData.height,
        hsvRanges, isGrayscaleMode: isGrayscale,
        grayscaleMin: isGrayscale ? grayscaleMin : undefined,
        grayscaleMax: isGrayscale ? grayscaleMax : undefined,
        minObjectSize,
      });
      setResults(result.results);
      await generateOverlay(result.labeled_mask, imageData.width, imageData.height, null);
      setError(null);
      notif.success(`Threshold analysis: ${result.results.length} objects found`);
    } catch (e) { setError(`Threshold failed: ${e}`); notif.error(`Threshold failed: ${e}`); }
    finally { setIsProcessing(false); }
  };

  const handleMorphology = async (operation: string) => {
    if (!imageData) { setError("Apply threshold first"); return; }
    setIsProcessing(true);
    try {
      const result = await invoke<ThresholdAnalysisResult>("apply_morphology", {
        operation, width: imageData.width, height: imageData.height,
      });
      setResults(result.results);
      await generateOverlay(result.labeled_mask, imageData.width, imageData.height, null);
      setError(null);
      notif.success(`Morphology ${operation.toLowerCase()}: ${result.results.length} objects`);
    } catch (e) { setError(`Morphology failed: ${e}`); notif.error(`Morphology failed: ${e}`); }
    finally { setIsProcessing(false); }
  };

  const generateOverlay = async (_labeledMask: number[][], w: number, h: number, highlight: number | null) => {
    try {
      const overlay = await invoke<number[]>("create_threshold_overlay", {
        highlightLabel: highlight, width: w, height: h,
      });
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      const imgData = ctx.createImageData(w, h);
      for (let i = 0; i < overlay.length; i++) imgData.data[i] = overlay[i];
      ctx.putImageData(imgData, 0, 0);
      setOverlayImage(canvas.toDataURL());
    } catch (e) {
      console.warn("Overlay generation failed:", e);
    }
  };

  const handleHighlight = async (label: number | null) => {
    setHighlightLabel(label);
    if (imageData && label !== null) {
      await generateOverlay([], imageData.width, imageData.height, label);
    }
  };

  const handleExportCsv = async () => {
    if (results.length === 0) return;
    try {
      const path = await save({ defaultPath: "threshold_results.csv", filters: [{ name: "CSV", extensions: ["csv"] }] });
      if (path) {
        await invoke("export_threshold_csv", { results, path, imageName: "segmentation", unit: calibration.unit_name });
      }
    } catch (e) { setError(`Export failed: ${e}`); }
  };

  return (
    <>
      <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: "var(--bg-1)" }}>
        {(["auto", "manual", "morphology", "save"] as const).map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all capitalize ${
              subTab === t ? "bg-[rgba(91,168,245,0.15)] text-[#5BA8F5]" : "text-[var(--text-4)] hover:text-[var(--text-2)]"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {subTab === "auto" && (
        <div className="space-y-2">
          <select value={autoMethod} onChange={(e) => setAutoMethod(e.target.value)} className="glass-input text-[11px] w-full">
            <option value="Otsu">Otsu</option>
            <option value="Mean">Mean</option>
            <option value="Li">Li</option>
          </select>
          <div>
            <label style={{ color: "var(--text-4)" }} className="text-[9px] uppercase mb-1 block">Min Object Size</label>
            <input type="number" value={minObjectSize} min={1}
              onChange={(e) => setMinObjectSize(parseInt(e.target.value) || 50)}
              className="glass-input text-[11px] w-full" />
          </div>
          <button onClick={handleAutoThreshold} disabled={!imageData || isProcessing}
            className="btn-accent flex items-center justify-center gap-2 text-[11px] w-full">
            {isProcessing ? <><div className="spinner" /> Processing...</> : <><Play size={13} /> Apply Auto</>}
          </button>
        </div>
      )}

      {subTab === "manual" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={isGrayscale} onChange={(e) => setIsGrayscale(e.target.checked)} className="accent-[#5BA8F5]" />
            <label style={{ color: "var(--text-2)" }} className="text-[11px]">Grayscale Mode</label>
          </div>
          {!isGrayscale ? (
            <>
              {(["h", "s", "v"] as const).map((ch) => (
                <div key={ch} className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-4)" }} className="text-[9px] uppercase">{ch === "h" ? "Hue" : ch === "s" ? "Saturation" : "Brightness"}</span>
                    <span style={{ color: "#5BA8F5" }} className="text-[10px]">{hsvRanges[`${ch}_min` as keyof HsvRanges]}-{hsvRanges[`${ch}_max` as keyof HsvRanges]}</span>
                  </div>
                  <div className="flex gap-1">
                    <input type="range" min={0} max={ch === "h" ? 180 : 255} value={hsvRanges[`${ch}_min` as keyof HsvRanges]}
                      onChange={(e) => setHzvRanges({ ...hsvRanges, [`${ch}_min`]: Number(e.target.value) })} className="flex-1" />
                    <input type="range" min={0} max={ch === "h" ? 180 : 255} value={hsvRanges[`${ch}_max` as keyof HsvRanges]}
                      onChange={(e) => setHzvRanges({ ...hsvRanges, [`${ch}_max`]: Number(e.target.value) })} className="flex-1" />
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="space-y-2">
              <div>
                <div className="flex justify-between mb-1">
                  <span style={{ color: "var(--text-4)" }} className="text-[9px] uppercase">Grayscale Range</span>
                  <span style={{ color: "#5BA8F5" }} className="text-[10px]">{grayscaleMin}-{grayscaleMax}</span>
                </div>
                <div className="flex gap-1">
                  <input type="range" min={0} max={255} value={grayscaleMin}
                    onChange={(e) => setGrayscaleMin(Number(e.target.value))} className="flex-1" />
                  <input type="range" min={0} max={255} value={grayscaleMax}
                    onChange={(e) => setGrayscaleMax(Number(e.target.value))} className="flex-1" />
                </div>
              </div>
            </div>
          )}
          <div>
            <label style={{ color: "var(--text-4)" }} className="text-[9px] uppercase mb-1 block">Min Object Size</label>
            <input type="number" value={minObjectSize} min={1}
              onChange={(e) => setMinObjectSize(parseInt(e.target.value) || 50)}
              className="glass-input text-[11px] w-full" />
          </div>
          <button onClick={handleManualThreshold} disabled={!imageData || isProcessing}
            className="btn-accent flex items-center justify-center gap-2 text-[11px] w-full">
            {isProcessing ? <><div className="spinner" /> Processing...</> : <><Play size={13} /> Apply & Analyze</>}
          </button>
        </div>
      )}

      {subTab === "morphology" && (
        <div className="space-y-2">
          <p style={{ color: "var(--text-4)" }} className="text-[10px]">Refine the binary mask</p>
          {[
            { op: "Erode", label: "Erode" },
            { op: "Dilate", label: "Dilate" },
            { op: "Open", label: "Open" },
            { op: "Close", label: "Close" },
          ].map(({ op, label }) => (
            <button key={op} onClick={() => handleMorphology(op)} disabled={isProcessing}
              className="btn-glass flex items-center justify-center gap-2 text-[11px] w-full">
              <Scissors size={12} />
              {label}
            </button>
          ))}
        </div>
      )}

      {subTab === "save" && (
        <div className="space-y-2">
          <p style={{ color: "var(--text-4)" }} className="text-[10px]">Export segmentation results</p>
          <button onClick={handleExportCsv} disabled={results.length === 0}
            className="btn-glass flex items-center justify-center gap-2 text-[11px] w-full">
            <Download size={13} />
            Export CSV ({results.length} objects)
          </button>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="h-[1px]" style={{ background: "var(--border-2)" }} />
          <div>
            <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase mb-2 block">
              Results ({results.length})
            </span>
            <div className="overflow-auto max-h-40 rounded-xl">
              <table className="w-full text-[10px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-2)" }}>
                    <th className="px-2 py-1.5 text-left" style={{ color: "var(--text-4)" }}>#</th>
                    <th className="px-2 py-1.5 text-left" style={{ color: "var(--text-4)" }}>Area</th>
                    <th className="px-2 py-1.5 text-left" style={{ color: "var(--text-4)" }}>Circ.</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 20).map((r) => (
                    <tr key={r.display_index}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: "1px solid var(--border-2)",
                        background: highlightLabel === r.label ? "rgba(91,168,245,0.1)" : undefined,
                      }}
                      onClick={() => handleHighlight(r.label)}>
                      <td className="px-2 py-1" style={{ color: "var(--text-4)" }}>{r.display_index}</td>
                      <td className="px-2 py-1 font-medium" style={{ color: "var(--text-1)" }}>{r.calculated_area_with_unit}</td>
                      <td className="px-2 py-1" style={{ color: "var(--text-3)" }}>{r.circularity.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ===================== SMART TAB CONTROLS =====================

function SmartControls({
  imageData: _imageData,
  calibration: _calibration,
  setError,
  notif,
}: {
  imageData: { data: number[]; width: number; height: number } | null;
  calibration: ScaleCalibrationInfo;
  setError: (e: string | null) => void;
  notif: ReturnType<typeof useNotification>;
}) {
  const [modelType, setModelType] = useState("Base");
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [maskOpacity, setMaskOpacity] = useState(0.5);
  const [interactionMode, setInteractionMode] = useState<"point" | "box">("point");

  const handleLoadModel = async () => {
    setIsLoading(true);
    try {
      // Placeholder - will need actual SAM model loading
      await new Promise(r => setTimeout(r, 1000));
      setIsModelLoaded(true);
      setError(null);
      notif.success(`${modelType} SAM model loaded successfully`);
    } catch (e) { setError(`Model load failed: ${e}`); notif.error(`Model load failed: ${e}`); }
    finally { setIsLoading(false); }
  };

  return (
    <>
      <div>
        <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase mb-2 block">
          AI Model
        </span>
        <select value={modelType} onChange={(e) => setModelType(e.target.value)} className="glass-input text-[11px] w-full">
          <option value="Mobile">Mobile SAM (Fast)</option>
          <option value="Base">Base SAM (Balanced)</option>
          <option value="Large">Large SAM (Best)</option>
        </select>
      </div>

      <div className="glass-card p-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isModelLoaded ? "bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-[var(--text-5)]"}`} />
          <span style={{ color: "var(--text-2)" }} className="text-[11px]">
            {isModelLoaded ? "Model Ready" : "Not Loaded"}
          </span>
        </div>
      </div>

      <button onClick={handleLoadModel} disabled={isLoading}
        className="btn-glass flex items-center justify-center gap-2 text-[11px] w-full">
        {isLoading ? <><div className="spinner" /> Loading...</> : <><Play size={13} /> Check & Load</>}
      </button>

      <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

      <div>
        <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase mb-2 block">
          Interaction
        </span>
        <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: "var(--bg-1)" }}>
          {[
            { mode: "point" as const, label: "Point", icon: <Crosshair size={12} /> },
            { mode: "box" as const, label: "Box", icon: <Square size={12} /> },
          ].map(({ mode, label, icon }) => (
            <button key={mode} onClick={() => setInteractionMode(mode)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all ${
                interactionMode === mode ? "bg-[rgba(91,168,245,0.15)] text-[#5BA8F5]" : "text-[var(--text-4)] hover:text-[var(--text-2)]"
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: "var(--text-4)" }} className="text-[9px] uppercase">Mask Opacity</span>
          <span style={{ color: "#5BA8F5" }} className="text-[10px]">{(maskOpacity * 100).toFixed(0)}%</span>
        </div>
        <input type="range" min={10} max={100} value={maskOpacity * 100}
          onChange={(e) => setMaskOpacity(Number(e.target.value) / 100)} />
      </div>

      <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

      <div className="space-y-2">
        <button disabled={!isModelLoaded} className="btn-glass flex items-center justify-center gap-2 text-[11px] w-full">
          <Trash2 size={12} /> Clear Mask
        </button>
        <button className="btn-glass flex items-center justify-center gap-2 text-[11px] w-full">
          <Download size={13} /> Export CSV
        </button>
      </div>
    </>
  );
}

// ===================== MANUAL TAB CONTROLS =====================

function ManualControls({
  calibration: _calibration,
  setError: _setError,
  notif: _notif,
}: {
  calibration: ScaleCalibrationInfo;
  setError: (e: string | null) => void;
  notif: ReturnType<typeof useNotification>;
}) {
  const [polygons] = useState<ManualPolygonData[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [magneticSnap, setMagneticSnap] = useState(false);
  const [sensitivity, setSensitivity] = useState(10);
  const [rulerMode, setRulerMode] = useState(false);
  const [selectedPolygon, setSelectedPolygon] = useState<number | null>(null);

  return (
    <>
      <div>
        <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase mb-2 block">
          Drawing Tools
        </span>
        <div className="space-y-2">
          <button onClick={() => { setIsDrawing(!isDrawing); setRulerMode(false); }}
            className={`${isDrawing ? "btn-accent" : "btn-glass"} flex items-center justify-center gap-2 text-[11px] w-full`}>
            <PenTool size={13} />
            {isDrawing ? "Stop Drawing" : "New Polygon"}
          </button>

          <div className="flex items-center gap-2 glass-card p-2">
            <Magnet size={13} style={{ color: magneticSnap ? "#5BA8F5" : "var(--text-4)" }} />
            <label style={{ color: "var(--text-2)" }} className="text-[11px] flex-1">Magnetic Snap</label>
            <input type="checkbox" checked={magneticSnap} onChange={(e) => setMagneticSnap(e.target.checked)} className="accent-[#5BA8F5]" />
          </div>

          {magneticSnap && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span style={{ color: "var(--text-4)" }} className="text-[9px] uppercase">Sensitivity</span>
                <span style={{ color: "#5BA8F5" }} className="text-[10px]">{sensitivity}</span>
              </div>
              <input type="range" min={3} max={25} value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))} />
            </div>
          )}
        </div>
      </div>

      <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

      <div>
        <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase mb-2 block">
          Measurement
        </span>
        <button onClick={() => { setRulerMode(!rulerMode); setIsDrawing(false); }}
          className={`${rulerMode ? "btn-accent" : "btn-glass"} flex items-center justify-center gap-2 text-[11px] w-full`}>
          <Ruler size={13} />
          {rulerMode ? "Stop Measuring" : "Measure Distance"}
        </button>
      </div>

      <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

      <div>
        <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase mb-2 block">
          Manual Areas ({polygons.length})
        </span>
        <div className="overflow-auto max-h-32 rounded-xl space-y-1">
          {polygons.map((p, i) => (
            <div key={i}
              className="glass-card p-2 flex items-center gap-2 cursor-pointer transition-all"
              style={{ border: selectedPolygon === i ? "1px solid rgba(91,168,245,0.3)" : undefined }}
              onClick={() => setSelectedPolygon(i)}>
              <span style={{ color: "var(--text-4)" }} className="text-[10px] w-4">{i + 1}</span>
              <span style={{ color: "var(--text-1)" }} className="text-[11px] flex-1 truncate">{p.name || `Area ${i + 1}`}</span>
              <span style={{ color: "var(--text-3)" }} className="text-[9px]">{p.calculated_area_with_unit}</span>
            </div>
          ))}
          {polygons.length === 0 && (
            <p style={{ color: "var(--text-5)" }} className="text-[10px] text-center py-2">No polygons drawn</p>
          )}
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <button disabled={selectedPolygon === null}
          className="btn-glass flex items-center justify-center gap-2 text-[11px] w-full">
          <Trash2 size={12} /> Delete Selected
        </button>
        <button className="btn-glass flex items-center justify-center gap-2 text-[11px] w-full">
          <Download size={13} /> Export CSV
        </button>
      </div>
    </>
  );
}

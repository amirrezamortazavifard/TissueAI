import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Palette, MousePointer, Pencil, Pipette, Eraser, Play, Download,
  Undo2, Trash2, Target, Droplets, Image, Eye, ChevronDown,
  ChevronUp
} from "lucide-react";

interface DominantColor {
  r: number; g: number; b: number;
  hex: string; percentage: number; cluster_index: number;
}

interface ContourResult {
  points: [number, number][];
  area: number; centroid_x: number; centroid_y: number;
}

interface DeconvChannel {
  channel_name: string; width: number; height: number; pixels: number[];
}

type ToolMode = "select" | "roi" | "eyedropper" | "eraser";

const STAIN_TYPES = [
  "H&E", "H-DAB", "Masson's Trichrome", "PAS",
  "Giemsa", "Alcian Blue", "Feulgen-Light Green", "Methyl Green-DAB"
];

const REPLACEMENT_COLORS = [
  { name: "White", r: 255, g: 255, b: 255 },
  { name: "Black", r: 0, g: 0, b: 0 },
  { name: "Red", r: 255, g: 0, b: 0 },
  { name: "Green", r: 0, g: 128, b: 0 },
  { name: "Blue", r: 0, g: 0, b: 255 },
  { name: "Yellow", r: 255, g: 255, b: 0 },
  { name: "Purple", r: 128, g: 0, b: 128 },
  { name: "Gray", r: 128, g: 128, b: 128 },
];

export default function ColorAnalysis() {
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [colors, setColors] = useState<DominantColor[]>([]);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [stainType, setStainType] = useState(STAIN_TYPES[0]);
  const [deconvChannels, setDeconvChannels] = useState<DeconvChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<number>(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [statusText, setStatusText] = useState("Select an image to begin");

  const [colorThreshold, setColorThreshold] = useState(20);
  const [minArea, setMinArea] = useState(10);
  const [contours, setContours] = useState<ContourResult[]>([]);
  const [showContours, setShowContours] = useState(false);

  const [heatmapRadius, setHeatmapRadius] = useState(30);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.7);
  const [heatmapImage, setHeatmapImage] = useState<string | null>(null);

  const [isolationValue, setIsolationValue] = useState(0);
  const [quantResults, setQuantResults] = useState<{ metric: string; value: string }[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roiStartRef = useRef<{ x: number; y: number } | null>(null);
  const [roiRect, setRoiRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [liveColor, setLiveColor] = useState<{ r: number; g: number; b: number; hex: string } | null>(null);

  const [countingPanelOpen, setCountingPanelOpen] = useState(true);
  const [manipulationPanelOpen, setManipulationPanelOpen] = useState(true);
  const [replacementPanelOpen, setReplacementPanelOpen] = useState(true);

  const handleSelectImage = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "bmp"] }],
    });
    if (selected && typeof selected === "string") {
      setImagePath(selected);
      setColors([]);
      setSelectedColors([]);
      setDeconvChannels([]);
      setActiveChannel(-1);
      setContours([]);
      setHeatmapImage(null);
      setQuantResults([]);
      setStatusText("Loading image...");

      try {
        await invoke("load_color_image", { path: selected });
        const base64 = await invoke<string>("get_image_as_base64");
        setImagePreview(base64);
      setHistoryIndex(0);
        setStatusText("Image loaded. Choose an analysis method.");
      } catch (e) {
        setStatusText(`Error: ${e}`);
      }
    }
  };

  const handleAnalyze = async () => {
    setIsProcessing(true);
    setStatusText("Analyzing dominant colors...");
    try {
      const results = await invoke<DominantColor[]>("analyze_dominant_colors", { k: 5 });
      setColors(results);
      setSelectedColors([]);
      const base64 = await invoke<string>("get_image_as_base64");
      setImagePreview(base64);
      // history tracked on backend
      setHistoryIndex(prev => prev + 1);
      setStatusText(`Found ${results.length} dominant colors`);
    } catch (e) {
      setStatusText(`Error: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeconvolve = async () => {
    setIsProcessing(true);
    setStatusText(`Deconvolving ${stainType}...`);
    try {
      const results = await invoke<DeconvChannel[]>("deconvolve_stains", { stainType });
      setDeconvChannels(results);
      setActiveChannel(-1);
      // history tracked
      setHistoryIndex(prev => prev + 1);
      setStatusText(`Deconvolution complete. ${results.length} channels.`);
    } catch (e) {
      setStatusText(`Error: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectChannel = async (idx: number) => {
    setActiveChannel(idx);
    if (idx === -1) {
      const base64 = await invoke<string>("get_image_as_base64");
      setImagePreview(base64);
    } else if (deconvChannels[idx]) {
      const ch = deconvChannels[idx];
      const rgba = new Uint8Array(ch.width * ch.height * 4);
      for (let i = 0; i < ch.width * ch.height; i++) {
        rgba[i * 4] = ch.pixels[i * 3];
        rgba[i * 4 + 1] = ch.pixels[i * 3 + 1];
        rgba[i * 4 + 2] = ch.pixels[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
      const canvas = document.createElement("canvas");
      canvas.width = ch.width;
      canvas.height = ch.height;
      const ctx = canvas.getContext("2d")!;
      const imgData = ctx.createImageData(ch.width, ch.height);
      imgData.data.set(rgba);
      ctx.putImageData(imgData, 0, 0);
      setImagePreview(canvas.toDataURL("image/png"));
    }
  };

  const handleRemoveColor = async () => {
    if (selectedColors.length === 0) return;
    setIsProcessing(true);
    try {
      for (const idx of selectedColors) {
        await invoke("remove_color", { clusterIndex: idx });
      }
      const base64 = await invoke<string>("get_image_as_base64");
      setImagePreview(base64);
      // history tracked
      setHistoryIndex(prev => prev + 1);
      setStatusText("Color removed");
    } catch (e) {
      setStatusText(`Error: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReplaceColor = async (r: number, g: number, b: number) => {
    if (selectedColors.length === 0) return;
    setIsProcessing(true);
    try {
      for (const idx of selectedColors) {
        await invoke("replace_color", { clusterIndex: idx, newR: r, newG: g, newB: b });
      }
      const base64 = await invoke<string>("get_image_as_base64");
      setImagePreview(base64);
      // history tracked
      setHistoryIndex(prev => prev + 1);
      setStatusText("Color replaced");
    } catch (e) {
      setStatusText(`Error: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = async () => {
    if (historyIndex <= 0) return;
    try {
      await invoke("undo_action");
      const base64 = await invoke<string>("get_image_as_base64");
      setImagePreview(base64);
      setHistoryIndex(prev => prev - 1);
      // history tracked
      setStatusText("Undone");
    } catch (e) {
      setStatusText(`Error: ${e}`);
    }
  };

  const handleIsolation = async () => {
    if (selectedColors.length === 0 || isolationValue === 0) return;
    setIsProcessing(true);
    try {
      await invoke("apply_isolation", { clusterIndices: selectedColors, isolationValue });
      const base64 = await invoke<string>("get_image_as_base64");
      setImagePreview(base64);
      // history tracked
      setHistoryIndex(prev => prev + 1);

      const quant = await invoke<{ pixel_count: number; percentage: number }>("get_quantitative_results", {
        clusterIndex: selectedColors[0],
      });
      setQuantResults([
        { metric: "Pixel Count", value: quant.pixel_count.toLocaleString() },
        { metric: "Percentage", value: `${quant.percentage.toFixed(2)}%` },
      ]);
      setStatusText("Isolation applied");
    } catch (e) {
      setStatusText(`Error: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCountObjects = async () => {
    if (selectedColors.length === 0) return;
    setIsProcessing(true);
    setStatusText("Counting objects...");
    try {
      const result = await invoke<ContourResult[]>("find_objects_for_color", {
        clusterIndex: selectedColors[0],
        threshold: colorThreshold,
        minArea,
      });
      setContours(result);
      setShowContours(true);
      // history tracked
      setStatusText(`Found ${result.length} objects`);
    } catch (e) {
      setStatusText(`Error: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateHeatmap = async () => {
    if (contours.length === 0) return;
    setIsProcessing(true);
    setStatusText("Generating heatmap...");
    try {
      const centroids = contours.map(c => [c.centroid_x, c.centroid_y] as [number, number]);
      const [w, h, pixels] = await invoke<[number, number, number[]]>("generate_heatmap", {
        contourCentroids: centroids,
        radius: heatmapRadius,
        opacity: heatmapOpacity,
      });

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      const imgData = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        imgData.data[i * 4] = pixels[i * 4];
        imgData.data[i * 4 + 1] = pixels[i * 4 + 1];
        imgData.data[i * 4 + 2] = pixels[i * 4 + 2];
        imgData.data[i * 4 + 3] = pixels[i * 4 + 3];
      }
      ctx.putImageData(imgData, 0, 0);
      setHeatmapImage(canvas.toDataURL("image/png"));
      setStatusText("Heatmap generated");
    } catch (e) {
      setStatusText(`Error: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInpaint = async () => {
    if (selectedColors.length === 0) return;
    setIsProcessing(true);
    try {
      await invoke("inpaint_artifact", { clusterIndex: selectedColors[0] });
      const base64 = await invoke<string>("get_image_as_base64");
      setImagePreview(base64);
      // history tracked
      setHistoryIndex(prev => prev + 1);
      setStatusText("Artifact inpainted");
    } catch (e) {
      setStatusText(`Error: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportCsv = async () => {
    if (colors.length === 0) return;
    const csv = await invoke<string>("export_color_csv", { results: colors });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `color_analysis_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (toolMode === "roi") {
      roiStartRef.current = { x, y };
      setRoiRect({ x, y, w: 0, h: 0 });
    } else if (toolMode === "eyedropper") {
      handleEyedropperClick(x, y);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (toolMode === "roi" && roiStartRef.current) {
      const start = roiStartRef.current;
      setRoiRect({
        x: Math.min(start.x, x),
        y: Math.min(start.y, y),
        w: Math.abs(x - start.x),
        h: Math.abs(y - start.y),
      });
    }
  };

  const handleCanvasMouseUp = async () => {
    if (toolMode === "roi" && roiStartRef.current && roiRect && roiRect.w > 10 && roiRect.h > 10) {
      setIsProcessing(true);
      setStatusText("Analyzing ROI...");
      try {
        const canvas = canvasRef.current!;
        const scaleX = canvas.width / canvas.clientWidth;
        const scaleY = canvas.height / canvas.clientHeight;
        const cx = (roiRect.x + roiRect.w / 2) * scaleX;
        const cy = (roiRect.y + roiRect.h / 2) * scaleY;
        const rx = (roiRect.w / 2) * scaleX;
        const ry = (roiRect.h / 2) * scaleY;

        const results = await invoke<DominantColor[]>("analyze_region", {
          centerX: cx, centerY: cy, radiusX: rx, radiusY: ry, k: 5,
        });
        setColors(results);
        setSelectedColors([]);
        // history tracked
        setHistoryIndex(prev => prev + 1);
        setStatusText(`ROI analysis: ${results.length} colors`);
      } catch (e) {
        setStatusText(`Error: ${e}`);
      } finally {
        setIsProcessing(false);
      }
    }
    roiStartRef.current = null;
  };

  const handleEyedropperClick = async (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scaleX = canvas.width / canvas.clientWidth;
    const scaleY = canvas.height / canvas.clientHeight;
    const imgX = Math.floor(x * scaleX);
    const imgY = Math.floor(y * scaleY);

    try {
      const [r, g, b] = await invoke<[number, number, number]>("get_color_at_pixel", { x: imgX, y: imgY });
      const results = await invoke<DominantColor[]>("analyze_with_seed_color", { seedR: r, seedG: g, seedB: b });
      setColors(results);
      setSelectedColors(results.length > 0 ? [0] : []);
      // history tracked
      setHistoryIndex(prev => prev + 1);
      setStatusText(`Found color: #${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`);
    } catch (e) {
      setStatusText(`Error: ${e}`);
    }
  };

  const handleCanvasMouseLeave = () => {
    setLiveColor(null);
  };

  const toggleColorSelection = (idx: number) => {
    setSelectedColors(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  // Draw image to canvas whenever imagePreview changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imagePreview) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new window.Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Draw contours on top if active
      if (showContours && contours.length > 0) {
        ctx.strokeStyle = "#00FFFF";
        ctx.lineWidth = 2;
        for (const contour of contours) {
          ctx.beginPath();
          for (let i = 0; i < contour.points.length; i++) {
            const [x, y] = contour.points[i];
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
    };
    img.src = imagePreview;
  }, [imagePreview, showContours, contours]);

  const renderSidebar = () => (
    <div className="w-[280px] shrink-0 glass-panel p-4 flex flex-col gap-4 overflow-y-auto">
      <div className="py-1">
        <h2 style={{ color: "var(--text-1)" }} className="text-[15px] font-semibold">Color Analysis</h2>
        <p style={{ color: "var(--text-4)" }} className="text-[12px] mt-0.5">K-Means clustering & stain deconvolution</p>
      </div>

      <button onClick={handleSelectImage} className="btn-accent w-full flex items-center justify-center gap-2 text-[12px] py-2.5">
        <Image size={14} /> Select Image
      </button>

      {imagePath && (
        <div className="glass-card p-3">
          <div className="flex items-center gap-2.5">
            <div style={{ background: "var(--bg-2)" }} className="w-8 h-8 rounded-lg flex items-center justify-center">
              <Palette size={14} style={{ color: "var(--text-4)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: "var(--text-1)" }} className="text-[12px] font-medium truncate">
                {imagePath.split("\\").pop()?.split("/").pop()}
              </p>
              <p style={{ color: "var(--text-4)" }} className="text-[10px] truncate mt-0.5">Ready</p>
            </div>
          </div>
        </div>
      )}

      <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

      <div>
        <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase mb-2 block">Tools</span>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)" }}>
          {([
            { mode: "select" as ToolMode, icon: <MousePointer size={14} />, label: "Select" },
            { mode: "roi" as ToolMode, icon: <Pencil size={14} />, label: "ROI" },
            { mode: "eyedropper" as ToolMode, icon: <Pipette size={14} />, label: "Pick" },
            { mode: "eraser" as ToolMode, icon: <Eraser size={14} />, label: "Erase" },
          ]).map(t => (
            <button
              key={t.mode}
              onClick={() => setToolMode(t.mode)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background: toolMode === t.mode ? "var(--bg-4)" : "transparent",
                color: toolMode === t.mode ? "var(--text-1)" : "var(--text-4)",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

      <div className="space-y-2">
        <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase block">Analysis</span>
        <button onClick={handleAnalyze} disabled={!imagePath || isProcessing} className="btn-glass w-full flex items-center justify-center gap-2 text-[12px]">
          <Play size={13} /> Analyze Dominant Colors
        </button>
        <div className="flex gap-2">
          <select
            value={stainType}
            onChange={(e) => setStainType(e.target.value)}
            className="glass-input text-[11px] flex-1"
          >
            {STAIN_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={handleDeconvolve} disabled={!imagePath || isProcessing} className="btn-glass px-3 text-[11px]">
            Deconvolve
          </button>
        </div>
      </div>

      {deconvChannels.length > 0 && (
        <div className="flex gap-1">
          <button onClick={() => handleSelectChannel(-1)} className="btn-glass text-[10px] px-2 py-1" style={{ background: activeChannel === -1 ? "var(--bg-4)" : undefined }}>
            Original
          </button>
          {deconvChannels.map((ch, i) => (
            <button key={i} onClick={() => handleSelectChannel(i)} className="btn-glass text-[10px] px-2 py-1" style={{ background: activeChannel === i ? "var(--bg-4)" : undefined }}>
              {ch.channel_name}
            </button>
          ))}
        </div>
      )}

      <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

      <div className="flex gap-2">
        <button onClick={handleRemoveColor} disabled={selectedColors.length === 0} className="btn-glass flex-1 flex items-center justify-center gap-1 text-[11px]">
          <Trash2 size={12} /> Remove
        </button>
        <button onClick={handleUndo} disabled={historyIndex <= 0} className="btn-glass flex items-center justify-center gap-1 text-[11px] px-3">
          <Undo2 size={12} /> Undo
        </button>
      </div>

      <div className="mt-auto h-[1px]" style={{ background: "var(--border-2)" }} />

      <div className="space-y-1">
        <button onClick={handleExportCsv} disabled={colors.length === 0} className="btn-glass w-full flex items-center justify-center gap-2 text-[11px]">
          <Download size={12} /> Export CSV
        </button>
      </div>
    </div>
  );

  const renderToolsPanel = () => {
    if (selectedColors.length === 0) return null;
    return (
      <div className="w-[220px] shrink-0 glass-panel p-4 flex flex-col gap-3 overflow-y-auto">
        {/* Counting */}
        <div>
          <button onClick={() => setCountingPanelOpen(!countingPanelOpen)} className="flex items-center justify-between w-full py-1">
            <span style={{ color: "var(--text-2)" }} className="text-[13px] font-semibold flex items-center gap-2">
              <Target size={14} /> Counting
            </span>
            {countingPanelOpen ? <ChevronUp size={14} style={{ color: "var(--text-4)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-4)" }} />}
          </button>
          {countingPanelOpen && (
            <div className="space-y-3 mt-2">
              <div>
                <div className="flex justify-between mb-1">
                  <span style={{ color: "var(--text-4)" }} className="text-[10px] uppercase tracking-wider">Color Threshold</span>
                  <span style={{ color: "#5BA8F5" }} className="text-[11px] font-semibold">{colorThreshold}</span>
                </div>
                <input type="range" min={0} max={100} value={colorThreshold} onChange={e => setColorThreshold(+e.target.value)} className="w-full" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span style={{ color: "var(--text-4)" }} className="text-[10px] uppercase tracking-wider">Min Object Size</span>
                  <span style={{ color: "#5BA8F5" }} className="text-[11px] font-semibold">{minArea}px</span>
                </div>
                <input type="range" min={0} max={500} step={10} value={minArea} onChange={e => setMinArea(+e.target.value)} className="w-full" />
              </div>
              <button onClick={handleCountObjects} disabled={isProcessing} className="btn-accent w-full text-[11px] py-2">
                Count Objects ({contours.length})
              </button>
            </div>
          )}
        </div>

        <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

        {/* Heatmap */}
        <div>
          <button onClick={() => setManipulationPanelOpen(!manipulationPanelOpen)} className="flex items-center justify-between w-full py-1">
            <span style={{ color: "var(--text-2)" }} className="text-[13px] font-semibold flex items-center gap-2">
              <Droplets size={14} /> Heatmap
            </span>
            {manipulationPanelOpen ? <ChevronUp size={14} style={{ color: "var(--text-4)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-4)" }} />}
          </button>
          {manipulationPanelOpen && (
            <div className="space-y-3 mt-2">
              <div>
                <div className="flex justify-between mb-1">
                  <span style={{ color: "var(--text-4)" }} className="text-[10px] uppercase tracking-wider">Radius</span>
                  <span style={{ color: "#5BA8F5" }} className="text-[11px] font-semibold">{heatmapRadius}</span>
                </div>
                <input type="range" min={5} max={100} step={5} value={heatmapRadius} onChange={e => setHeatmapRadius(+e.target.value)} className="w-full" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span style={{ color: "var(--text-4)" }} className="text-[10px] uppercase tracking-wider">Opacity</span>
                  <span style={{ color: "#5BA8F5" }} className="text-[11px] font-semibold">{heatmapOpacity.toFixed(1)}</span>
                </div>
                <input type="range" min={0.1} max={1.0} step={0.1} value={heatmapOpacity} onChange={e => setHeatmapOpacity(+e.target.value)} className="w-full" />
              </div>
              <button onClick={handleGenerateHeatmap} disabled={contours.length === 0 || isProcessing} className="btn-accent w-full text-[11px] py-2">
                Generate Heatmap
              </button>
            </div>
          )}
        </div>

        <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

        {/* Isolation */}
        <div>
          <span style={{ color: "var(--text-2)" }} className="text-[13px] font-semibold flex items-center gap-2 mb-2">
            <Eye size={14} /> Isolation
          </span>
          <div className="flex gap-2 items-center">
            <input type="range" min={-100} max={100} value={isolationValue} onChange={e => setIsolationValue(+e.target.value)} className="flex-1" />
            <button onClick={handleIsolation} disabled={isolationValue === 0} className="btn-glass text-[10px] px-2 py-1">Apply</button>
          </div>
        </div>

        <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

        {/* Replacement */}
        <div>
          <button onClick={() => setReplacementPanelOpen(!replacementPanelOpen)} className="flex items-center justify-between w-full py-1">
            <span style={{ color: "var(--text-2)" }} className="text-[13px] font-semibold flex items-center gap-2">
              <Palette size={14} /> Replacement
            </span>
            {replacementPanelOpen ? <ChevronUp size={14} style={{ color: "var(--text-4)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-4)" }} />}
          </button>
          {replacementPanelOpen && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {REPLACEMENT_COLORS.map(c => (
                <button
                  key={c.name}
                  onClick={() => handleReplaceColor(c.r, c.g, c.b)}
                  className="w-7 h-7 rounded-lg border transition-transform hover:scale-110"
                  style={{
                    background: `rgb(${c.r},${c.g},${c.b})`,
                    borderColor: "var(--border-3)",
                  }}
                  title={c.name}
                />
              ))}
            </div>
          )}
        </div>

        {toolMode === "eraser" && (
          <>
            <div className="h-[1px]" style={{ background: "var(--border-2)" }} />
            <button onClick={handleInpaint} className="btn-danger w-full flex items-center justify-center gap-2 text-[11px]">
              <Eraser size={12} /> Inpaint Selected
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full gap-0 p-0">
      {renderSidebar()}
      {renderToolsPanel()}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 relative m-2 rounded-2xl overflow-hidden" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-2)" }}>
          {imagePreview ? (
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain cursor-crosshair"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseLeave}
            />
          ) : (
            <div className="flex items-center justify-center h-full" style={{ color: "var(--text-4)" }}>
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--bg-1)" }}>
                  <Palette size={28} className="opacity-30" />
                </div>
                <p className="text-[13px] font-medium">Select an image to begin</p>
                <p style={{ color: "var(--text-5)" }} className="text-[11px] mt-1">Click "Select Image" in the sidebar</p>
              </div>
            </div>
          )}

          {heatmapImage && (
            <img src={heatmapImage} className="absolute inset-0 w-full h-full object-contain mix-blend-screen" style={{ opacity: heatmapOpacity }} />
          )}

          {roiRect && toolMode === "roi" && (
            <div
              className="absolute border-2 border-cyan-400 bg-cyan-400/10 rounded-full pointer-events-none"
              style={{ left: roiRect.x, top: roiRect.y, width: roiRect.w, height: roiRect.h }}
            />
          )}

          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
              <div className="spinner-lg" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 mx-2 mb-2 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }}>
          <span style={{ color: "var(--text-3)" }} className="text-[12px]">{statusText}</span>
          {liveColor && (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded border" style={{ background: liveColor.hex, borderColor: "var(--border-3)" }} />
              <span style={{ color: "var(--text-1)" }} className="text-[11px] font-mono">{liveColor.hex}</span>
            </div>
          )}
        </div>

        {colors.length > 0 && (
          <div className="mx-2 mb-2 glass-panel p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase">Dominant Colors</span>
              <div className="flex items-center gap-3">
                <span style={{ color: "var(--text-4)" }} className="text-[11px]">{colors.length} colors found</span>
                {contours.length > 0 && (
                  <span className="badge badge-blue">{contours.length} objects</span>
                )}
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              {colors.map((c, i) => (
                <button
                  key={i}
                  onClick={() => toggleColorSelection(i)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                  style={{
                    background: selectedColors.includes(i) ? "rgba(91,168,245,0.15)" : "var(--bg-2)",
                    border: `1px solid ${selectedColors.includes(i) ? "rgba(91,168,245,0.3)" : "var(--border-2)"}`,
                  }}
                >
                  <div className="w-6 h-6 rounded-lg border" style={{ background: c.hex, borderColor: "var(--border-3)" }} />
                  <div className="text-left">
                    <p style={{ color: "var(--text-1)" }} className="text-[11px] font-medium">{c.hex}</p>
                    <p style={{ color: "var(--text-4)" }} className="text-[10px]">{c.percentage.toFixed(1)}%</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="h-3 rounded-full overflow-hidden flex" style={{ background: "var(--bg-2)" }}>
              {colors.map((c, i) => (
                <div
                  key={i}
                  className="h-full transition-all"
                  style={{ width: `${c.percentage}%`, background: c.hex }}
                  title={`${c.hex}: ${c.percentage.toFixed(1)}%`}
                />
              ))}
            </div>
          </div>
        )}

        {quantResults.length > 0 && (
          <div className="mx-2 mb-2 glass-panel p-3">
            <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase mb-2 block">Quantitative Results</span>
            <div className="flex gap-4">
              {quantResults.map((q, i) => (
                <div key={i}>
                  <p style={{ color: "var(--text-4)" }} className="text-[10px]">{q.metric}</p>
                  <p style={{ color: "var(--text-1)" }} className="text-[13px] font-semibold">{q.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

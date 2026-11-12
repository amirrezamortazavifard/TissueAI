import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Layers, Plus, Trash2, ChevronUp, ChevronDown, Play, CheckCircle,
  AlertCircle, Loader2, Image as ImageIcon, Clock,
  FolderOpen, Download, LayoutGrid
} from "lucide-react";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class_id: number;
  class_name: string;
}

interface BatchImageResult {
  file_path: string;
  file_name: string;
  detections: BoundingBox[];
  detection_count: number;
  processing_time_ms: number;
  status: string;
}

interface BatchDetectionResult {
  results: BatchImageResult[];
  total_images: number;
  total_detections: number;
  total_time_ms: number;
}

interface ImageItem {
  path: string;
  name: string;
  preview?: string;
  status: "queued" | "scanning" | "completed" | "error";
  detectionCount?: number;
  scanTimeMs?: number;
}

async function fileToBase64(path: string): Promise<string> {
  const bytes = await invoke<number[]>("read_file_bytes", { path });
  const binary = bytes.map(b => String.fromCharCode(b)).join('');
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

function CircularProgress({ value, max, size = 56, strokeWidth = 4, color = "#4FC3F7", label, sub }: {
  value: number; max: number; size?: number; strokeWidth?: number; color?: string; label: string; sub?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color + "18"} strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[14px] font-bold" style={{ color }}>{value}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: "var(--text-2)" }}>{label}</p>
        {sub && <p className="text-[9px] mt-0.5" style={{ color: "var(--text-5)" }}>{sub}</p>}
      </div>
    </div>
  );
}

export default function MultiSlide() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: "" });
  const [results, setResults] = useState<BatchImageResult[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(50);
  const [nms, setNms] = useState(45);
  const modelsDirRef = useRef("");

  useEffect(() => { loadModels(); }, []);

  const loadModels = async () => {
    try {
      const dir = await invoke<string>("get_models_directory");
      modelsDirRef.current = dir;
      const modelList = await invoke<string[]>("list_models_in_directory", { directory: dir });
      setModels(modelList);
      if (modelList.length > 0) setSelectedModel(modelList[0]);
    } catch (e) {
      console.error("Failed to load models:", e);
    }
  };

  const addImages = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "bmp"] }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      const newImages: ImageItem[] = [];
      for (const p of paths) {
        if (!images.find(img => img.path === p)) {
          const name = p.split(/[\\/]/).pop() || p;
          let preview: string | undefined;
          try { preview = await fileToBase64(p); } catch { /* skip */ }
          newImages.push({ path: p, name, preview, status: "queued" });
        }
      }
      setImages(prev => [...prev, ...newImages]);
    } catch (e) {
      console.error("Failed to open dialog:", e);
    }
  };

  const removeSelected = () => {
    if (selectedIndex === null) return;
    setImages(prev => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setImages(prev => { const n = [...prev]; [n[index - 1], n[index]] = [n[index], n[index - 1]]; return n; });
    if (selectedIndex === index) setSelectedIndex(index - 1);
    else if (selectedIndex === index - 1) setSelectedIndex(index);
  };

  const moveDown = (index: number) => {
    if (index >= images.length - 1) return;
    setImages(prev => { const n = [...prev]; [n[index], n[index + 1]] = [n[index + 1], n[index]]; return n; });
    if (selectedIndex === index) setSelectedIndex(index + 1);
    else if (selectedIndex === index + 1) setSelectedIndex(index);
  };

  const startBatchDetection = async () => {
    if (images.length === 0 || !selectedModel) return;
    setIsRunning(true);
    setResults([]);
    setImages(prev => prev.map(img => ({ ...img, status: "queued" as const })));
    setProgress({ current: 0, total: images.length, status: "Loading model..." });

    try {
      const modelPath = `${modelsDirRef.current}\\${selectedModel}`;
      const imagePaths = images.map(img => img.path);

      // Mark first as scanning
      setImages(prev => prev.map((img, i) => i === 0 ? { ...img, status: "scanning" as const } : img));
      setProgress({ current: 0, total: imagePaths.length, status: "Running detection..." });

      const result = await invoke<BatchDetectionResult>("run_batch_detection", {
        imagePaths, modelPath,
        confidenceThreshold: confidence / 100,
        nmsThreshold: nms / 100,
      });

      // Merge results back into images
      setImages(prev => prev.map((img, i) => {
        const r = result.results[i];
        if (r) {
          return {
            ...img,
            status: r.status === "completed" ? "completed" as const : "error" as const,
            detectionCount: r.detection_count,
            scanTimeMs: r.processing_time_ms,
          };
        }
        return img;
      }));

      setResults(result.results);
      setProgress({
        current: result.total_images,
        total: result.total_images,
        status: `Completed: ${result.total_detections} detections in ${(result.total_time_ms / 1000).toFixed(1)}s`,
      });
    } catch (e) {
      setProgress({ current: 0, total: 0, status: `Error: ${e}` });
      setImages(prev => prev.map(img => ({ ...img, status: "error" as const })));
    } finally {
      setIsRunning(false);
    }
  };

  const exportCsv = async () => {
    if (results.length === 0) return;
    try {
      const csv = await invoke<string>("export_batch_csv", { results });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "multislide_results.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
    }
  };

  const totalDetections = results.reduce((sum, r) => sum + r.detection_count, 0);
  const totalTime = results.reduce((sum, r) => sum + r.processing_time_ms, 0);
  const completedCount = results.filter(r => r.status === "completed").length;
  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const statusIcon = (status: ImageItem["status"]) => {
    switch (status) {
      case "completed": return <CheckCircle size={12} style={{ color: "#22c55e" }} />;
      case "scanning": return <Loader2 size={12} className="animate-spin" style={{ color: "#4FC3F7" }} />;
      case "error": return <AlertCircle size={12} style={{ color: "#ef4444" }} />;
      default: return <div className="w-3 h-3 rounded-full" style={{ background: "var(--text-5)", opacity: 0.3 }} />;
    }
  };

  const statusBadge = (status: ImageItem["status"]) => {
    switch (status) {
      case "completed": return (
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
          style={{ color: "#22c55e", background: "#22c55e18" }}>
          <CheckCircle size={9} /> Analysis Complete
        </span>);
      case "scanning": return (
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
          style={{ color: "#4FC3F7", background: "#4FC3F718" }}>
          <Loader2 size={9} className="animate-spin" /> Scanning...
        </span>);
      case "error": return (
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
          style={{ color: "#ef4444", background: "#ef444418" }}>
          <AlertCircle size={9} /> Failed
        </span>);
      default: return (
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: "var(--text-5)", background: "var(--bg-2)" }}>
          Queued
        </span>);
    }
  };

  return (
    <div className="flex-1 overflow-hidden page-enter">
      <div className="h-full flex flex-col gap-4 p-4">

        {/* Stats Bar */}
        <div className="flex items-stretch gap-3 shrink-0">
          {[
            { label: "Total Slides", value: images.length, color: "#4FC3F7", sub: `${completedCount} completed` },
            { label: "Completed Scans", value: completedCount, color: "#22c55e", sub: results.length > 0 ? `${Math.round(completedCount / Math.max(results.length, 1) * 100)}%` : undefined },
            { label: "Total Objects Detected", value: totalDetections, color: "#f59e0b", sub: totalDetections > 0 ? `avg ${Math.round(totalDetections / Math.max(completedCount, 1))}` : undefined },
            { label: "Total Analysis Duration", value: totalTime > 0 ? (totalTime / 1000).toFixed(1) : "0", color: "#8b5cf6", sub: "seconds", isTime: true },
          ].map((stat) => (
            <div key={stat.label} className="flex-1 glass-panel px-4 py-3 flex items-center gap-3">
              <CircularProgress
                value={typeof stat.value === "string" ? parseFloat(stat.value) || 0 : stat.value}
                max={stat.isTime ? Math.max(totalTime / 1000, 30) : Math.max(images.length, 1)}
                color={stat.color}
                label=""
                size={52}
                strokeWidth={3.5}
              />
              <div>
                <p className="text-[18px] font-bold leading-none" style={{ color: stat.color }}>
                  {stat.value}{stat.isTime ? "s" : ""}
                </p>
                <p className="text-[9px] font-bold tracking-wider uppercase mt-1" style={{ color: "var(--text-4)" }}>
                  {stat.label}
                </p>
                {stat.sub && <p className="text-[9px] mt-0.5" style={{ color: "var(--text-5)" }}>{stat.sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">

          {/* Left Panel */}
          <div className="w-[260px] shrink-0 flex flex-col gap-3">

            {/* Model */}
            <div className="glass-panel p-3 space-y-2.5">
              <span style={{ color: "var(--text-4)" }} className="text-[10px] font-bold tracking-widest uppercase">Model</span>
              <select className="glass-input text-[11px]" value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}>
                {models.length === 0 && <option value="">No models found</option>}
                {models.map(m => <option key={m} value={m}>{m.replace(/_/g, " ").replace(/-/g, " ").replace(/\.[^/.]+$/, "")}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ color: "var(--text-4)" }} className="text-[9px] font-bold tracking-widest uppercase">Confidence</span>
                    <span style={{ color: "#4FC3F7" }} className="text-[11px] font-bold">{confidence}%</span>
                  </div>
                  <input type="range" min={10} max={99} value={confidence}
                    onChange={(e) => setConfidence(Number(e.target.value))} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ color: "var(--text-4)" }} className="text-[9px] font-bold tracking-widest uppercase">NMS</span>
                    <span style={{ color: "#4FC3F7" }} className="text-[11px] font-bold">{nms}%</span>
                  </div>
                  <input type="range" min={10} max={90} value={nms}
                    onChange={(e) => setNms(Number(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Input Queue */}
            <div className="glass-panel p-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: "var(--text-4)" }} className="text-[10px] font-bold tracking-widest uppercase">
                  Input Queue
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ color: "#4FC3F7", background: "#4FC3F715" }}>
                  {images.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 min-h-0 mb-2">
                {images.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-6" style={{ color: "var(--text-5)" }}>
                    <FolderOpen size={24} className="mb-2 opacity-30" />
                    <p className="text-[11px]">No images loaded</p>
                  </div>
                )}
                {images.map((img, i) => (
                  <div key={img.path} onClick={() => setSelectedIndex(i)}
                    className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all"
                    style={{
                      background: selectedIndex === i ? "#4FC3F710" : "transparent",
                      border: `1px solid ${selectedIndex === i ? "#4FC3F730" : "transparent"}`,
                    }}>
                    <span className="text-[10px] font-bold w-4 text-right shrink-0" style={{ color: "var(--text-5)" }}>
                      {i + 1}
                    </span>
                    {img.preview ? (
                      <img src={img.preview} alt="" className="w-8 h-8 rounded-md object-cover shrink-0"
                        style={{ border: "1px solid var(--border-2)" }} />
                    ) : (
                      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }}>
                        <ImageIcon size={12} style={{ color: "var(--text-5)" }} />
                      </div>
                    )}
                    <span className="text-[10px] truncate flex-1" style={{ color: "var(--text-2)" }}>
                      {img.name}
                    </span>
                    {statusIcon(img.status)}
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1">
                <button onClick={addImages}
                  className="btn-glass flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold py-1.5">
                  <Plus size={11} /> Add Images
                </button>
                <button onClick={() => selectedIndex !== null && moveUp(selectedIndex)}
                  disabled={selectedIndex === null || selectedIndex === 0}
                  className="btn-glass p-1.5" title="Move up">
                  <ChevronUp size={11} />
                </button>
                <button onClick={() => selectedIndex !== null && moveDown(selectedIndex)}
                  disabled={selectedIndex === null || selectedIndex === images.length - 1}
                  className="btn-glass p-1.5" title="Move down">
                  <ChevronDown size={11} />
                </button>
                <button onClick={removeSelected} disabled={selectedIndex === null}
                  className="btn-glass p-1.5" title="Remove">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            {/* Start Button */}
            <button onClick={startBatchDetection}
              disabled={isRunning || images.length === 0 || !selectedModel}
              className="btn-accent w-full flex items-center justify-center gap-2.5 text-[12px] font-bold py-3 rounded-xl"
              style={{ letterSpacing: "0.05em" }}>
              {isRunning ? (
                <><Loader2 size={15} className="animate-spin" /> PROCESSING...</>
              ) : (
                <><Play size={15} fill="currentColor" /> Start Batch Analysis</>
              )}
            </button>
            {!isRunning && (
              <p className="text-center text-[9px]" style={{ color: "var(--text-5)" }}>Run AI Pipeline</p>
            )}

            {/* Batch Progress */}
            {(isRunning || progress.status) && (
              <div className="glass-panel p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text-4)" }} className="text-[9px] font-bold tracking-widest uppercase">Batch Progress</span>
                  {progress.total > 0 && (
                    <span style={{ color: "#4FC3F7" }} className="text-[11px] font-bold">{progressPct}%</span>
                  )}
                </div>
                {progress.total > 0 && (
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-2)" }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #4FC3F7, #2196F3)" }} />
                  </div>
                )}
                <p className="text-[10px]" style={{ color: "var(--text-3)" }}>
                  {progress.current} of {progress.total} slides
                </p>
                {progress.status && !isRunning && (
                  <p className="text-[10px]" style={{ color: "var(--text-4)" }}>
                    {progress.status}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - Data Table */}
          <div className="flex-1 glass-panel p-3 flex flex-col min-h-0">
            {/* Table Header */}
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ color: "var(--text-1)" }} className="text-[13px] font-bold tracking-wider uppercase">Data Table</h2>
              <div className="flex items-center gap-2">
                <button onClick={exportCsv} disabled={results.length === 0}
                  className="btn-glass flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5">
                  <Download size={11} /> EXPORT CSV DATA
                </button>
                <button disabled={results.length === 0}
                  className="btn-glass flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5">
                  <LayoutGrid size={11} /> VIEW RESULTS DASHBOARD
                </button>
              </div>
            </div>

            {/* Table */}
            {images.length > 0 ? (
              <div className="flex-1 overflow-y-auto min-h-0">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-2)" }}>
                      <th className="text-left px-3 py-2 text-[9px] font-bold tracking-widest uppercase" style={{ color: "var(--text-5)", width: 40 }}>ID</th>
                      <th className="text-left px-3 py-2 text-[9px] font-bold tracking-widest uppercase" style={{ color: "var(--text-5)" }}>Slide/Sample (Preview)</th>
                      <th className="text-center px-3 py-2 text-[9px] font-bold tracking-widest uppercase" style={{ color: "var(--text-5)" }}>Detected Objects</th>
                      <th className="text-center px-3 py-2 text-[9px] font-bold tracking-widest uppercase" style={{ color: "var(--text-5)" }}>Scan Time (ms)</th>
                      <th className="text-left px-3 py-2 text-[9px] font-bold tracking-widest uppercase" style={{ color: "var(--text-5)" }}>Model Used</th>
                      <th className="text-center px-3 py-2 text-[9px] font-bold tracking-widest uppercase" style={{ color: "var(--text-5)" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {images.map((img, i) => {
                      const result = results[i];
                      const isSelected = selectedIndex === i;
                      return (
                        <tr key={img.path}
                          onClick={() => setSelectedIndex(i)}
                          className="cursor-pointer transition-all"
                          style={{
                            borderBottom: "1px solid var(--border-2)",
                            background: isSelected ? "#4FC3F708" : "transparent",
                          }}>
                          <td className="px-3 py-2 text-[11px] font-bold" style={{ color: "var(--text-4)" }}>{i + 1}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              {img.preview ? (
                                <img src={img.preview} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0"
                                  style={{ border: "1px solid var(--border-2)" }} />
                              ) : (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                  style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }}>
                                  <ImageIcon size={14} style={{ color: "var(--text-5)" }} />
                                </div>
                              )}
                              <span className="text-[11px] font-medium truncate" style={{ color: "var(--text-2)" }}>
                                {img.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {result ? (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                style={{ color: result.detection_count > 0 ? "#4FC3F7" : "var(--text-5)", background: result.detection_count > 0 ? "#4FC3F715" : "var(--bg-2)" }}>
                                {result.detection_count}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-5)" }}>—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {result ? (
                              <div className="flex items-center justify-center gap-1">
                                <Clock size={10} style={{ color: "var(--text-5)" }} />
                                <span className="text-[11px] font-medium" style={{ color: "var(--text-3)" }}>
                                  {result.processing_time_ms.toFixed(0)}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: "var(--text-5)" }}>—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-[10px] truncate block max-w-[140px]" style={{ color: "var(--text-4)" }}>
                              {selectedModel ? selectedModel.replace(/_/g, " ").replace(/\.[^/.]+$/, "") : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {statusBadge(img.status)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Layers size={40} style={{ color: "var(--text-5)" }} className="mx-auto mb-3 opacity-20" />
                  <p style={{ color: "var(--text-3)" }} className="text-[13px] font-semibold mb-1">No slides loaded</p>
                  <p style={{ color: "var(--text-5)" }} className="text-[11px]">Add images to start batch analysis</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

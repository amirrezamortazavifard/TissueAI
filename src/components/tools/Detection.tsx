import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Microscope, Play, Download, AlertCircle, Image, RotateCcw,
  ChevronDown, ChevronUp, Crosshair, Target
} from "lucide-react";
import { useNotification } from "../../contexts/NotificationContext";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class_id: number;
  class_name: string;
}

interface DetectionResult {
  file_path: string;
  detections: BoundingBox[];
  processing_time_ms: number;
}

interface DetectionInfo {
  index: number;
  label: string;
  confidence: number;
  original_box: BoundingBox;
  thumbnail?: string;
}

const BOX_COLOR = "#4FC3F7";

async function fileToBase64(path: string): Promise<string> {
  const bytes = await invoke<number[]>("read_file_bytes", { path });
  const binary = bytes.map(b => String.fromCharCode(b)).join('');
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

function generateThumbnail(
  imageSrc: string,
  origX: number,
  origY: number,
  origW: number,
  origH: number,
  naturalW: number,
  naturalH: number,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(""); return; }

      const padX = origW * 0.15;
      const padY = origH * 0.15;
      const sx = Math.max(0, origX - padX);
      const sy = Math.max(0, origY - padY);
      const sw = Math.min(naturalW - sx, origW + padX * 2);
      const sh = Math.min(naturalH - sy, origH + padY * 2);

      const scale = Math.min(size / sw, size / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;

      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve("");
    img.src = imageSrc;
  });
}

export default function Detection() {
  const notif = useNotification();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [models, setModels] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detections, setDetections] = useState<DetectionInfo[]>([]);
  const [selectedDetection, setSelectedDetection] = useState<number | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(50);
  const [nmsThreshold, setNmsThreshold] = useState(45);
  const [error, setError] = useState<string | null>(null);
  const [modelsDir, setModelsDir] = useState<string>("");
  const imageLayoutRef = useRef<{ offsetX: number; offsetY: number; displayW: number; displayH: number } | null>(null);
  const rafRef = useRef<number>(0);
  const PAD = 16; // p-4 = 16px padding on each side

  const [focusMode, setFocusMode] = useState(false);
  const [focusTarget, setFocusTarget] = useState<BoundingBox | null>(null);
  const [hiddenClasses, setHiddenClasses] = useState<Set<number>>(new Set());
  const [classFilterOpen, setClassFilterOpen] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<"idle" | "detecting" | "revealing">("idle");
  const [revealedCount, setRevealedCount] = useState(0);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());

  const uniqueClasses = useMemo(
    () => [...new Map(detections.map(d => [d.original_box.class_id, d.original_box.class_name])).entries()],
    [detections],
  );
  const visibleDetections = useMemo(
    () => detections.filter(d => !hiddenClasses.has(d.original_box.class_id)),
    [detections, hiddenClasses],
  );

  const avgConfidence = useMemo(() => {
    if (visibleDetections.length === 0) return 0;
    return visibleDetections.reduce((s, d) => s + d.confidence, 0) / visibleDetections.length * 100;
  }, [visibleDetections]);

  useEffect(() => { loadModels(); }, []);

  // Generate thumbnails when detections change
  useEffect(() => {
    if (!imagePreview || detections.length === 0 || !imageSize) return;
    let cancelled = false;

    const MODEL_DIM = 640;
    const modelScale = Math.min(MODEL_DIM / imageSize.w, MODEL_DIM / imageSize.h);
    const padX = (MODEL_DIM - imageSize.w * modelScale) / 2;
    const padY = (MODEL_DIM - imageSize.h * modelScale) / 2;

    const gen = async () => {
      const map = new Map<number, string>();
      await Promise.all(
        detections.map(async (det) => {
          const box = det.original_box;
          const left = box.x - box.width / 2;
          const top = box.y - box.height / 2;
          const origX = (left - padX) / modelScale;
          const origY = (top - padY) / modelScale;
          const origW = box.width / modelScale;
          const origH = box.height / modelScale;

          const thumb = await generateThumbnail(
            imagePreview, origX, origY, origW, origH, imageSize.w, imageSize.h,
          );
          if (!cancelled) map.set(det.index, thumb);
        }),
      );
      if (!cancelled) setThumbnails(map);
    };
    gen();
    return () => { cancelled = true; };
  }, [imagePreview, detections, imageSize]);

  const MODEL_SIZE = 640;

  // Convert model coordinates (640x640 center-format) to original image pixel coordinates
  const modelToOriginal = useCallback((box: BoundingBox) => {
    if (!imageSize) return { x: 0, y: 0, width: 0, height: 0 };
    const imgW = imageSize.w;
    const imgH = imageSize.h;
    const modelScale = Math.min(MODEL_SIZE / imgW, MODEL_SIZE / imgH);
    const padX = (MODEL_SIZE - imgW * modelScale) / 2;
    const padY = (MODEL_SIZE - imgH * modelScale) / 2;

    // Center-format to top-left
    const left = box.x - box.width / 2;
    const top = box.y - box.height / 2;

    // Remove letterbox padding and scale back to original
    const origX = (left - padX) / modelScale;
    const origY = (top - padY) / modelScale;
    const origW = box.width / modelScale;
    const origH = box.height / modelScale;

    return { x: origX, y: origY, width: origW, height: origH };
  }, [imageSize]);

  // ---- Canvas drawing: minimal boxes + numbered badges ----
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const layout = imageLayoutRef.current;
    if (!canvas || !container || !imageSize || !layout) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    if (containerW === 0 || containerH === 0) return;

    canvas.width = containerW * dpr;
    canvas.height = containerH * dpr;
    canvas.style.width = `${containerW}px`;
    canvas.style.height = `${containerH}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, containerW, containerH);

    const { offsetX, offsetY, displayW, displayH } = layout;
    if (displayW === 0 || displayH === 0) return;

    const scaleX = displayW / imageSize.w;
    const scaleY = displayH / imageSize.h;

    visibleDetections.forEach((det, i) => {
      if (animationPhase === "revealing" && i >= revealedCount) return;

      const box = det.original_box;
      const orig = modelToOriginal(box);
      const x = orig.x * scaleX + offsetX;
      const y = orig.y * scaleY + offsetY;
      const w = orig.width * scaleX;
      const h = orig.height * scaleY;
      const isSelected = selectedDetection === det.index;
      const isFocused = focusMode && focusTarget === box;

      let animOffset = 0;
      if (animationPhase === "revealing" && i < revealedCount) {
        const progress = Math.min(1, (revealedCount - i) / 4);
        animOffset = (1 - progress) * 12;
      }

      ctx.save();

      if (focusMode && focusTarget && !isFocused) {
        ctx.globalAlpha = 0.08;
      }

      const lw = isSelected || isFocused ? 1.8 : 1;
      ctx.strokeStyle = isSelected || isFocused ? BOX_COLOR : BOX_COLOR + "99";
      ctx.lineWidth = lw;
      ctx.strokeRect(x, y + animOffset, w, h);

      if (isSelected || isFocused) {
        ctx.fillStyle = BOX_COLOR + "12";
        ctx.fillRect(x, y + animOffset, w, h);
      }

      const badgeR = 9;
      const badgeX = x + badgeR + 1;
      const badgeY = y + animOffset - badgeR - 2;
      const badgeVisible = badgeY > badgeR;

      if (badgeVisible) {
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = "#1a2332";
        ctx.fill();
        ctx.strokeStyle = BOX_COLOR + "80";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.font = "600 9px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(det.index), badgeX, badgeY + 0.5);
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      }

      ctx.restore();
    });

    // Focus spotlight overlay
    if (focusMode && focusTarget) {
      const orig = modelToOriginal(focusTarget);
      const x = orig.x * scaleX + offsetX;
      const y = orig.y * scaleY + offsetY;
      const w = orig.width * scaleX;
      const h = orig.height * scaleY;
      const pad = 16;

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.beginPath();
      ctx.rect(0, 0, containerRef.current?.clientWidth ?? displayW, containerRef.current?.clientHeight ?? displayH);
      ctx.roundRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 8);
      ctx.fill("evenodd");

      ctx.strokeStyle = BOX_COLOR;
      ctx.lineWidth = 2;
      ctx.shadowColor = BOX_COLOR;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.roundRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 8);
      ctx.stroke();
      ctx.restore();
    }
  }, [visibleDetections, selectedDetection, focusMode, focusTarget, imageSize, animationPhase, revealedCount, modelToOriginal]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  // Compute image layout mathematically using object-contain algorithm
  // This is pixel-perfect and has zero timing/DOM-reading issues
  const computeLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container || !imageSize) return;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    if (containerW === 0 || containerH === 0) return;

    // Available space for the image (container minus padding on all sides)
    const availW = containerW - PAD * 2;
    const availH = containerH - PAD * 2;

    // object-contain: scale to fit within available space while maintaining aspect ratio
    const scale = Math.min(availW / imageSize.w, availH / imageSize.h);
    const displayW = imageSize.w * scale;
    const displayH = imageSize.h * scale;

    // Center the image within the available space
    const offsetX = PAD + (availW - displayW) / 2;
    const offsetY = PAD + (availH - displayH) / 2;

    imageLayoutRef.current = { offsetX, offsetY, displayW, displayH };
  }, [imageSize]);

  // Recompute layout on resize using ResizeObserver on the CONTAINER
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !imageSize) return;

    computeLayout();
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => drawCanvas());

    const observer = new ResizeObserver(() => {
      computeLayout();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => drawCanvas());
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [computeLayout, drawCanvas, imageSize]);

  // Staggered reveal
  useEffect(() => {
    if (animationPhase === "revealing" && revealedCount < visibleDetections.length) {
      const t = setTimeout(() => setRevealedCount(c => c + 1), 60);
      return () => clearTimeout(t);
    }
    if (animationPhase === "revealing" && revealedCount >= visibleDetections.length) {
      setTimeout(() => setAnimationPhase("idle"), 200);
    }
  }, [animationPhase, revealedCount, visibleDetections.length]);

  // Canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const layout = imageLayoutRef.current;
    if (!canvas || !layout || !imageSize) return;

    const canvasRect = canvas.getBoundingClientRect();
    const clickX = e.clientX - canvasRect.left;
    const clickY = e.clientY - canvasRect.top;

    const { offsetX, offsetY, displayW, displayH } = layout;
    const scaleX = displayW / imageSize.w;
    const scaleY = displayH / imageSize.h;

    for (let i = visibleDetections.length - 1; i >= 0; i--) {
      const box = visibleDetections[i].original_box;
      const orig = modelToOriginal(box);
      const bx = orig.x * scaleX + offsetX;
      const by = orig.y * scaleY + offsetY;
      const bw = orig.width * scaleX;
      const bh = orig.height * scaleY;

      if (clickX >= bx && clickX <= bx + bw && clickY >= by && clickY <= by + bh) {
        setSelectedDetection(visibleDetections[i].index);
        setFocusTarget(box);
        return;
      }
    }

    setSelectedDetection(null);
    setFocusTarget(null);
    setFocusMode(false);
  }, [visibleDetections, imageSize, modelToOriginal]);

  const loadModels = async () => {
    try {
      const dir = await invoke<string>("get_models_directory");
      setModelsDir(dir);
      const result = await invoke<string[]>("list_models_in_directory", { directory: dir });
      setModels(result);
      if (result.length > 0) setSelectedModel(result[0]);
    } catch (e) {
      console.error("Failed to load models:", e);
      setModels([]);
    }
  };

  const handleSelectImage = async () => {
    try {
      setError(null);
      const selected = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "bmp"] }],
      });

      if (selected && typeof selected === "string") {
        setSelectedImage(selected);
        setDetections([]);
        setSelectedDetection(null);
        setFocusMode(false);
        setFocusTarget(null);
        setAnimationPhase("idle");
        setRevealedCount(0);
        setThumbnails(new Map());

        try {
          const base64 = await fileToBase64(selected);
          setImagePreview(base64);

          const img = new window.Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
              resolve();
            };
            img.onerror = reject;
            img.src = base64;
          });
        } catch (e) {
          setError(`Failed to load image: ${e}`);
          notif.error(`Failed to load image: ${e}`);
        }
      }
    } catch (e) {
      setError(`Failed to open file dialog: ${e}`);
      notif.error(`Failed to open file dialog: ${e}`);
    }
  };

  const handleStartDetection = async () => {
    if (!selectedImage || !selectedModel) {
      setError("Please select an image and a model first");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setAnimationPhase("detecting");
    setRevealedCount(0);

    try {
      const modelPath = `${modelsDir}\\${selectedModel}`;
      const result = await invoke<DetectionResult>("run_detection", {
        imagePath: selectedImage,
        modelPath: modelPath,
        confidenceThreshold: confidenceThreshold / 100,
        nmsThreshold: nmsThreshold / 100,
      });

      const infoList: DetectionInfo[] = result.detections
        .sort((a, b) => b.confidence - a.confidence)
        .map((det, idx) => ({
          index: idx + 1,
          label: det.class_name,
          confidence: det.confidence,
          original_box: det,
        }));

      setDetections(infoList);
      setProcessingTime(result.processing_time_ms);
      setAnimationPhase("revealing");
      setRevealedCount(0);
      notif.success(`Detection complete: ${infoList.length} objects found in ${(result.processing_time_ms / 1000).toFixed(2)}s`);
    } catch (e) {
      setError(`Detection failed: ${e}`);
      notif.error(`Detection failed: ${e}`);
      setAnimationPhase("idle");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedImage || detections.length === 0) return;
    try {
      const boxes = visibleDetections.map((d) => d.original_box);
      const csv = await invoke<string>("export_detection_csv", {
        imagePath: selectedImage,
        detections: boxes,
        processingTimeMs: processingTime,
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `detection_results_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notif.success("CSV exported successfully");
    } catch (e) {
      notif.error("Failed to export CSV");
    }
  };

  const handleFocusToggle = () => {
    if (focusMode) {
      setFocusMode(false);
      setFocusTarget(null);
    } else if (selectedDetection !== null) {
      const det = visibleDetections.find(d => d.index === selectedDetection);
      if (det) {
        setFocusMode(true);
        setFocusTarget(det.original_box);
      }
    }
  };

  const handleResetView = () => {
    setSelectedDetection(null);
    setFocusMode(false);
    setFocusTarget(null);
    setHiddenClasses(new Set());
  };

  const toggleClassVisibility = (classId: number) => {
    setHiddenClasses(prev => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const fileName = selectedImage ? selectedImage.split("\\").pop()?.split("/").pop() : null;

  return (
    <div className="flex h-full gap-3 p-3">
      {/* Left Panel - IMAGE INPUT */}
      <div className="w-[260px] shrink-0 glass-panel p-4 flex flex-col gap-4 overflow-y-auto">
        <div>
          <h2 style={{ color: "var(--text-1)" }} className="text-[13px] font-bold tracking-wider uppercase">Image Input</h2>
        </div>

        {/* Image preview card */}
        <div className="glass-card p-2.5">
          <div className="flex items-center gap-3">
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0"
                style={{ border: "1px solid var(--border-2)" }} />
            ) : (
              <div className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }}>
                <Image size={18} style={{ color: "var(--text-5)" }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p style={{ color: "var(--text-1)" }} className="text-[11px] font-semibold truncate">
                {fileName || "No image"}
              </p>
              {imageSize && (
                <p style={{ color: "var(--text-4)" }} className="text-[9px] mt-0.5">
                  {imageSize.w} × {imageSize.h}
                </p>
              )}
              <button onClick={handleSelectImage}
                className="mt-1.5 text-[9px] font-semibold px-2.5 py-1 rounded-md transition-all"
                style={{ color: "#4FC3F7", background: "#4FC3F715", border: "1px solid #4FC3F730" }}>
                Change Image
              </button>
            </div>
          </div>
        </div>

        {/* Model */}
        <div>
          <span style={{ color: "var(--text-4)" }} className="text-[10px] font-bold tracking-widest uppercase mb-2 block">Model</span>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="glass-input text-[11px]">
            <option value="">No Model</option>
            {models.map((m) => (
              <option key={m} value={m}>{m.replace(/_/g, " ").replace(/-/g, " ").replace(/\.[^/.]+$/, "")}</option>
            ))}
          </select>
        </div>

        <button onClick={handleSelectImage}
          className="btn-glass flex items-center justify-center gap-2 text-[11px] py-2">
          <Microscope size={13} /> Select Image
        </button>

        <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

        {/* Sliders */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ color: "var(--text-4)" }} className="text-[10px] font-bold tracking-widest uppercase">Confidence</span>
              <span style={{ color: "#4FC3F7" }} className="text-[11px] font-bold">{confidenceThreshold}%</span>
            </div>
            <input type="range" min="0" max="100" value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ color: "var(--text-4)" }} className="text-[10px] font-bold tracking-widest uppercase">NMS Threshold</span>
              <span style={{ color: "#4FC3F7" }} className="text-[11px] font-bold">{nmsThreshold}%</span>
            </div>
            <input type="range" min="0" max="100" value={nmsThreshold}
              onChange={(e) => setNmsThreshold(Number(e.target.value))} />
          </div>
        </div>

        <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

        {/* Class filter */}
        {uniqueClasses.length > 0 && (
          <div>
            <button onClick={() => setClassFilterOpen(!classFilterOpen)} className="w-full flex items-center justify-between py-1">
              <span style={{ color: "var(--text-4)" }} className="text-[10px] font-bold tracking-widest uppercase">
                Class Filter ({uniqueClasses.length})
              </span>
              {classFilterOpen ? <ChevronUp size={12} style={{ color: "var(--text-4)" }} /> : <ChevronDown size={12} style={{ color: "var(--text-4)" }} />}
            </button>
            {classFilterOpen && (
              <div className="space-y-1 mt-2">
                {uniqueClasses.map(([id, name]) => {
                  const isHidden = hiddenClasses.has(id);
                  const count = detections.filter(d => d.original_box.class_id === id).length;
                  return (
                    <button key={id} onClick={() => toggleClassVisibility(id)}
                      className="w-full flex items-center gap-2 p-1.5 rounded-lg transition-all text-[11px]"
                      style={{
                        background: isHidden ? "transparent" : "#4FC3F710",
                        border: `1px solid ${isHidden ? "var(--border-2)" : "#4FC3F730"}`,
                        color: isHidden ? "var(--text-5)" : "var(--text-2)",
                      }}>
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ background: isHidden ? "var(--text-5)" : BOX_COLOR }} />
                      <span className="flex-1 text-left">{name}</span>
                      <span className="text-[9px]" style={{ color: "var(--text-5)" }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

        {/* Action buttons */}
        <div className="mt-auto space-y-2.5">
          <button onClick={handleStartDetection}
            disabled={!selectedImage || !selectedModel || isProcessing}
            className="btn-accent w-full flex items-center justify-center gap-2.5 text-[12px] font-bold py-3 rounded-xl"
            style={{ letterSpacing: "0.05em" }}>
            {isProcessing ? (
              <><div className="spinner" /> Processing...</>
            ) : (
              <><Play size={15} fill="currentColor" /> START ANALYSIS</>
            )}
          </button>
          <div className="flex gap-2">
            <button onClick={handleResetView}
              className="btn-glass flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold py-2">
              <RotateCcw size={12} /> RESET
            </button>
            <button onClick={handleFocusToggle} disabled={selectedDetection === null}
              className="btn-glass flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold py-2">
              <Crosshair size={12} /> FOCUS
            </button>
          </div>
        </div>
      </div>

      {/* Center + Right */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Viewport */}
        <div className="flex-1 glass-panel p-3 flex flex-col min-h-0">
          {error && (
            <div className="mb-2 p-2.5 rounded-xl flex items-center gap-2 text-[11px]"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.9)" }}>
              <AlertCircle size={13} />{error}
            </div>
          )}

          <div className="flex-1 relative rounded-xl overflow-hidden flex items-center justify-center min-h-0"
            style={{ background: "rgba(0,0,0,0.35)" }}>

            {imagePreview ? (
              <div ref={containerRef} className="relative w-full h-full flex items-center justify-center p-4">
                <img
                  ref={imgRef}
                  src={imagePreview}
                  alt="Selected"
                  className="max-w-full max-h-full object-contain animate-fade-in"
                  style={{ display: "block" }}
                />
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="absolute inset-0 w-full h-full cursor-crosshair"
                  style={{
                    pointerEvents: detections.length > 0 ? "auto" : "none",
                  }}
                />
              </div>
            ) : (
              <div className="text-center" style={{ color: "var(--text-4)" }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)" }}>
                  <Target size={28} className="opacity-20" />
                </div>
                <p className="text-[12px] font-semibold">Select an image to begin</p>
                <p style={{ color: "var(--text-5)" }} className="text-[10px] mt-1">Click a detected box to inspect</p>
              </div>
            )}

            {/* Processing overlay */}
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 animate-fade-in"
                style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
                <div className="spinner-lg" />
                <p style={{ color: "var(--text-2)" }} className="text-[13px] font-semibold">Analyzing tissue...</p>
                <p style={{ color: "var(--text-4)" }} className="text-[10px]">Running YOLO inference</p>
              </div>
            )}

            {/* Circular count indicator - top right */}
            {detections.length > 0 && !isProcessing && (
              <div className="absolute top-4 right-4 animate-fade-in">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="#4FC3F715" strokeWidth="3" />
                    <circle cx="32" cy="32" r="28" fill="none" stroke="#4FC3F7" strokeWidth="3"
                      strokeDasharray={`${(visibleDetections.length / Math.max(detections.length, 1)) * 175.9} 175.9`}
                      strokeLinecap="round"
                      transform="rotate(-90 32 32)"
                      style={{ transition: "stroke-dasharray 0.6s ease" }} />
                  </svg>
                  <div className="text-center leading-none">
                    <p className="text-[13px] font-bold" style={{ color: "#fff" }}>
                      {visibleDetections.length}/{detections.length}
                    </p>
                    <p className="text-[7px] font-semibold tracking-wider uppercase" style={{ color: "var(--text-4)" }}>
                      objects
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom status bar */}
        {detections.length > 0 && (
          <div className="glass-panel px-4 py-2 flex items-center justify-center gap-4 text-[11px] animate-slide-up">
            <span style={{ color: "var(--text-3)" }}>
              Total time: <span className="font-semibold" style={{ color: "var(--text-1)" }}>{(processingTime / 1000).toFixed(2)}s</span>
            </span>
            <span style={{ color: "var(--text-5)" }}>|</span>
            <span style={{ color: "var(--text-3)" }}>
              Objects: <span className="font-semibold" style={{ color: "var(--text-1)" }}>{detections.length}</span>
            </span>
            <span style={{ color: "var(--text-5)" }}>|</span>
            <span style={{ color: "var(--text-3)" }}>
              Confidence: <span className="font-semibold" style={{ color: "#4FC3F7" }}>{avgConfidence.toFixed(1)}%</span>
            </span>
          </div>
        )}
      </div>

      {/* Right Panel - DETECTION RESULTS */}
      {detections.length > 0 && (
        <div className="w-[280px] shrink-0 glass-panel p-3 flex flex-col overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ color: "var(--text-1)" }} className="text-[13px] font-bold tracking-wider uppercase">Detection Results</h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: "#4FC3F7", background: "#4FC3F715" }}>
              {visibleDetections.length}
            </span>
          </div>

          {/* Table header */}
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1 text-[9px] font-bold tracking-widest uppercase"
            style={{ color: "var(--text-5)", borderBottom: "1px solid var(--border-2)" }}>
            <span className="w-6 text-center">ID</span>
            <span className="flex-1">Class</span>
            <span className="w-14 text-right">Conf.</span>
            <span className="w-16 text-right">Dim</span>
          </div>

          {/* Scrollable results list */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
            {visibleDetections.map((det) => {
              const isSelected = selectedDetection === det.index;
              const thumb = thumbnails.get(det.index);
              return (
                <div key={det.index}
                  onClick={() => { setSelectedDetection(det.index); setFocusTarget(det.original_box); }}
                  className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all duration-150"
                  style={{
                    background: isSelected ? "#4FC3F712" : "transparent",
                    border: `1px solid ${isSelected ? "#4FC3F730" : "transparent"}`,
                  }}>
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0"
                    style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }}>
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image size={12} style={{ color: "var(--text-5)" }} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold" style={{ color: "var(--text-1)" }}>
                        {det.index}
                      </span>
                      <span className="text-[10px] font-semibold truncate" style={{ color: "var(--text-2)" }}>
                        {det.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-bold" style={{ color: "#4FC3F7" }}>
                        {(det.confidence * 100).toFixed(1)}%
                      </span>
                      <span className="text-[9px]" style={{ color: "var(--text-5)" }}>
                        {(() => {
                          const orig = modelToOriginal(det.original_box);
                          return `${orig.width.toFixed(0)}×${orig.height.toFixed(0)}`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export button */}
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-2)" }}>
            <button onClick={handleExportCsv}
              className="btn-glass w-full flex items-center justify-center gap-2 text-[11px] font-semibold py-2">
              <Download size={12} /> EXPORT DETECTIONS (CSV)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import {
  Plus, Trash2, Undo2, ZoomIn, ZoomOut, Maximize,
  FileImage, FolderOpen, Save, ChevronLeft, ChevronRight, MousePointer2,
  Circle, Minus, Square, Dot, PenLine, Sun,
  Play, Brain, Target, Download, Upload, Loader2, Layers,
  Terminal, Activity
} from "lucide-react";

interface Point { x: number; y: number; }
interface LabelmeShape {
  label: string;
  points: number[][];
  group_id: number | null;
  description: string;
  shape_type: string;
  flags: Record<string, boolean>;
  mask: string | null;
  id: string;
  color: string;
  visible: boolean;
}
interface ImageItem { path: string; name: string; width: number; height: number; }
interface TrainingClass { id: number; name: string; color: string; }
type Tool = "pointer" | "polygon" | "rectangle" | "circle" | "point" | "line" | "linestrip" | "edit";
type DragMode = "none" | "vertex" | "edge" | "body" | "create" | "pan";
type Tab = "annotate" | "train" | "predict";

const SHAPE_COLORS = [
  "#e6194b","#3cb44b","#4363d8","#f58231","#911eb4","#42d4f4","#f032e6",
  "#bfef45","#469990","#dcbeff","#9a6324","#800000","#aaffc3","#808000",
];

const formLabel: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--text-3)" };
const formInput: React.CSSProperties = { padding: "6px 8px", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)", fontSize: 12 };
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 };
const secondaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 12 };

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function getShapeColor(label: string, classes: TrainingClass[]): string {
  const cls = classes.find(c => c.name === label);
  if (cls && cls.color !== "transparent") return cls.color;
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0;
  return SHAPE_COLORS[Math.abs(hash) % SHAPE_COLORS.length];
}

export default function Trainable() {
  // Main Tab selection (3 distinct tabs)
  const [tab, setTab] = useState<Tab>("annotate");

  // Dataset & Image Navigation
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selImgIdx, setSelImgIdx] = useState(-1);

  // Canvas & Annotation state
  const [tool, setTool] = useState<Tool>("pointer");
  const [shapes, setShapes] = useState<LabelmeShape[]>([]);
  const [selShapeIdx, setSelShapeIdx] = useState(-1);
  const [selVertexIdx, setSelVertexIdx] = useState(-1);
  const [creatingPoints, setCreatingPoints] = useState<Point[]>([]);
  const [dragInfo, setDragInfo] = useState<{ mode: DragMode; startPt: Point; startOffset?: Point; shapeIdx?: number; vertexIdx?: number; edgeIdx?: number; origPoints?: number[][] }>({ mode: "none", startPt: { x: 0, y: 0 } });

  // Class Management
  const [classes, setClasses] = useState<TrainingClass[]>([
    { id: 0, name: "_background_", color: "#000000" },
    { id: 1, name: "person", color: "#e6194b" },
    { id: 2, name: "car", color: "#3cb44b" },
    { id: 3, name: "cell", color: "#4363d8" },
    { id: 4, name: "tissue", color: "#f58231" },
  ]);
  const [selLabel, setSelLabel] = useState("cell");
  const [newClassName, setNewClassName] = useState("");
  const [showNewClass, setShowNewClass] = useState(false);

  // View Settings
  const [zoom, setZoom] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [showBrightnessDlg, setShowBrightnessDlg] = useState(false);
  const [_undoStack, setUndoStack] = useState<LabelmeShape[][]>([]);

  // Export Settings (within Tab 1)
  const [showExportModal, setShowExportModal] = useState(false);
  const [expFormat, setExpFormat] = useState<"yolo" | "pytorch">("yolo");
  const [expSettings, setExpSettings] = useState({ project_name: "dataset", epochs: 50, batch_size: 16, image_size: 640 });

  // ================= TAB 2: Model Training & Live Analytics =================
  const [detectionArch, setDetectionArch] = useState<"yolox" | "ssd">("yolox");
  const [yoloxSettings, setYoloxSettings] = useState({
    model_size: "yolox-nano",
    epochs: 50,
    batch_size: 4,
    learning_rate: 0.001,
    optimizer: "adam",
    weight_decay: 0.0001,
    image_size: 640,
    output_dir: "",
  });
  const [isTraining, setIsTraining] = useState(false);
  const [trainStatusMsg, setTrainStatusMsg] = useState("");
  const [lossHistory, setLossHistory] = useState<number[]>([]);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [totalEpochs, setTotalEpochs] = useState(0);
  const [trainLogs, setTrainLogs] = useState<string[]>([]);

  // ================= TAB 3: Model Execution & Testing =================
  const [predModelPath, setPredModelPath] = useState("");
  const [confThreshold, setConfThreshold] = useState(0.30);
  const [nmsThreshold, setNmsThreshold] = useState(0.45);
  const [isInferring, setIsInferring] = useState(false);
  const [detectedBoxes, setDetectedBoxes] = useState<Array<{ class_name: string; confidence: number; x1: number; y1: number; x2: number; y2: number }>>([]);
  const [inferStatusMsg, setInferStatusMsg] = useState("");

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const inferCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  const sel = selImgIdx >= 0 && selImgIdx < images.length ? images[selImgIdx] : null;

  // Real-Time Event Listener for Training Progress (Tauri Event Stream)
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    listen<{ epoch: number; total_epochs: number; loss: number; message: string }>("training-progress", (event) => {
      const { epoch, total_epochs, loss, message } = event.payload;
      setCurrentEpoch(epoch);
      setTotalEpochs(total_epochs);
      setLossHistory(prev => [...prev, loss]);
      setTrainLogs(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${message}`]);
    }).then(unlisten => {
      unlistenFn = unlisten;
    }).catch(err => console.error("Event listener error:", err));

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  // Auto-scroll terminal log window
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [trainLogs]);

  const toImageCoords = useCallback((clientX: number, clientY: number): Point => {
    const cv = canvasRef.current;
    if (!cv) return { x: 0, y: 0 };
    const rect = cv.getBoundingClientRect();
    const scale = zoom / 100;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  }, [zoom]);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-49), shapes.map(s => ({ ...s, points: s.points.map(p => [...p]) }))]);
  }, [shapes]);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop()!;
      setShapes(last);
      return next;
    });
  }, []);

  const loadImg = useCallback(async (path: string) => {
    try {
      const dataUrl = await invoke<string>("load_trainable_image", { path });
      const img = new window.Image();
      img.onload = () => {
        imgRef.current = img;
        drawCanvas();
      };
      img.src = dataUrl;
    } catch (e) {
      console.error("Failed to load image:", e);
    }
  }, []);

  const loadLabelsForImage = useCallback(async (imagePath: string) => {
    try {
      const labelPath = await invoke<string>("get_label_file_path", { imagePath });
      const exists = await invoke<boolean>("check_label_exists", { imagePath });
      if (!exists) { setShapes([]); return; }
      const file = await invoke<{ shapes: Array<{ label: string; points: number[][]; group_id: number | null; description: string | null; shape_type: string; flags: Record<string, boolean> | null; mask: string | null }> }>("load_labelme_json", { path: labelPath });
      const loaded: LabelmeShape[] = (file.shapes || []).map(s => ({
        label: s.label,
        points: s.points,
        group_id: s.group_id,
        description: s.description || "",
        shape_type: s.shape_type,
        flags: s.flags || {},
        mask: s.mask,
        id: generateId(),
        color: getShapeColor(s.label, classes),
        visible: true,
      }));
      setShapes(loaded);
      setSelShapeIdx(-1);
      setSelVertexIdx(-1);
    } catch {
      setShapes([]);
    }
  }, [classes]);

  const openImages = async () => {
    const files = await open({ multiple: true, filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "tiff"] }] });
    if (!files) return;
    const paths = Array.isArray(files) ? files : [files];
    const newImgs: ImageItem[] = paths.map(p => ({
      path: p,
      name: p.split(/[\\/]/).pop() || "unknown",
      width: 0,
      height: 0,
    }));
    setImages(newImgs);
    if (newImgs.length > 0) {
      setSelImgIdx(0);
      loadImg(newImgs[0].path);
      loadLabelsForImage(newImgs[0].path);
    }
  };

  const openDir = async () => {
    const dir = await open({ directory: true });
    if (!dir) return;
    try {
      const files = await invoke<string[]>("open_directory", { path: dir });
      const newImgs: ImageItem[] = files.map(p => ({
        path: p,
        name: p.split(/[\\/]/).pop() || "unknown",
        width: 0,
        height: 0,
      }));
      setImages(newImgs);
      if (newImgs.length > 0) {
        setSelImgIdx(0);
        loadImg(newImgs[0].path);
        loadLabelsForImage(newImgs[0].path);
      }
    } catch (e) {
      console.error("Error opening directory:", e);
    }
  };

  const navigateImage = (dir: number) => {
    if (images.length === 0) return;
    const newIdx = (selImgIdx + dir + images.length) % images.length;
    setSelImgIdx(newIdx);
    loadImg(images[newIdx].path);
    loadLabelsForImage(images[newIdx].path);
  };

  const saveLabels = async () => {
    if (!sel) return;
    try {
      const labelPath = await invoke<string>("get_label_file_path", { imagePath: sel.path });
      const exportShapes = shapes.map(s => ({
        label: s.label,
        points: s.points,
        group_id: s.group_id,
        description: s.description || null,
        shape_type: s.shape_type,
        flags: s.flags,
        mask: s.mask,
      }));
      await invoke("save_labelme_json", {
        path: labelPath,
        shapes: exportShapes,
        imagePath: sel.name,
        imageWidth: imgRef.current?.width || 640,
        imageHeight: imgRef.current?.height || 640,
      });
      setTrainStatusMsg("Labels saved successfully!");
    } catch (e: any) {
      setTrainStatusMsg(`Save failed: ${e}`);
    }
  };

  const drawCanvas = useCallback(() => {
    const cv = canvasRef.current;
    const ov = overlayRef.current;
    const img = imgRef.current;
    if (!cv || !ov || !img) return;

    cv.width = img.width;
    cv.height = img.height;
    ov.width = img.width;
    ov.height = img.height;

    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.drawImage(img, 0, 0);

    const octx = ov.getContext("2d");
    if (!octx) return;
    octx.clearRect(0, 0, ov.width, ov.height);

    shapes.forEach((s, idx) => {
      if (!s.visible) return;
      const isSel = idx === selShapeIdx;
      octx.strokeStyle = isSel ? "#ffffff" : s.color;
      octx.fillStyle = s.color + "33";
      octx.lineWidth = isSel ? 3 : 2;

      if (s.shape_type === "polygon" && s.points.length >= 3) {
        octx.beginPath();
        octx.moveTo(s.points[0][0], s.points[0][1]);
        for (let i = 1; i < s.points.length; i++) octx.lineTo(s.points[i][0], s.points[i][1]);
        octx.closePath();
        octx.fill();
        octx.stroke();
      } else if (s.shape_type === "rectangle" && s.points.length >= 2) {
        const x1 = Math.min(s.points[0][0], s.points[1][0]);
        const y1 = Math.min(s.points[0][1], s.points[1][1]);
        const w = Math.abs(s.points[1][0] - s.points[0][0]);
        const h = Math.abs(s.points[1][1] - s.points[0][1]);
        octx.fillRect(x1, y1, w, h);
        octx.strokeRect(x1, y1, w, h);
      } else if (s.shape_type === "circle" && s.points.length >= 2) {
        const r = Math.hypot(s.points[1][0] - s.points[0][0], s.points[1][1] - s.points[0][1]);
        octx.beginPath();
        octx.arc(s.points[0][0], s.points[0][1], r, 0, Math.PI * 2);
        octx.fill();
        octx.stroke();
      }

      if (isSel) {
        s.points.forEach((p, vIdx) => {
          octx.fillStyle = vIdx === selVertexIdx ? "#ffff00" : "#ffffff";
          octx.fillRect(p[0] - 4, p[1] - 4, 8, 8);
          octx.strokeRect(p[0] - 4, p[1] - 4, 8, 8);
        });
      }
    });

    if (creatingPoints.length > 0) {
      octx.strokeStyle = "#00ff00";
      octx.fillStyle = "#00ff0044";
      octx.lineWidth = 2;
      octx.beginPath();
      octx.moveTo(creatingPoints[0].x, creatingPoints[0].y);
      for (let i = 1; i < creatingPoints.length; i++) octx.lineTo(creatingPoints[i].x, creatingPoints[i].y);
      if (tool === "polygon" && creatingPoints.length > 2) octx.closePath();
      octx.stroke();
      creatingPoints.forEach(p => {
        octx.fillRect(p.x - 3, p.y - 3, 6, 6);
      });
    }
  }, [brightness, contrast, shapes, selShapeIdx, selVertexIdx, creatingPoints, tool]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const drawInferenceOverlay = useCallback(() => {
    const cv = inferCanvasRef.current;
    const img = imgRef.current;
    if (!cv || !img) return;

    cv.width = img.width;
    cv.height = img.height;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);

    detectedBoxes.forEach(b => {
      const color = getShapeColor(b.class_name, classes);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);

      ctx.fillStyle = color;
      const labelText = `${b.class_name} ${(b.confidence * 100).toFixed(1)}%`;
      ctx.font = "bold 13px sans-serif";
      const textWidth = ctx.measureText(labelText).width;
      ctx.fillRect(b.x1, Math.max(0, b.y1 - 22), textWidth + 10, 22);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(labelText, b.x1 + 5, Math.max(15, b.y1 - 6));
    });
  }, [detectedBoxes, classes]);

  useEffect(() => {
    if (tab === "predict") drawInferenceOverlay();
  }, [tab, drawInferenceOverlay]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const pt = toImageCoords(e.clientX, e.clientY);
    pushUndo();

    if (tool === "rectangle") {
      setCreatingPoints([pt, pt]);
      setDragInfo({ mode: "create", startPt: pt });
    } else if (tool === "polygon") {
      setCreatingPoints(prev => [...prev, pt]);
    } else if (tool === "pointer" || tool === "edit") {
      let foundShape = -1, foundVertex = -1;
      shapes.forEach((s, sIdx) => {
        s.points.forEach((vp, vIdx) => {
          if (Math.hypot(vp[0] - pt.x, vp[1] - pt.y) < 10) {
            foundShape = sIdx;
            foundVertex = vIdx;
          }
        });
      });

      if (foundShape >= 0) {
        setSelShapeIdx(foundShape);
        setSelVertexIdx(foundVertex);
        setDragInfo({ mode: "vertex", startPt: pt, shapeIdx: foundShape, vertexIdx: foundVertex });
      } else {
        shapes.forEach((s, sIdx) => {
          if (s.shape_type === "rectangle" && s.points.length >= 2) {
            const x1 = Math.min(s.points[0][0], s.points[1][0]);
            const x2 = Math.max(s.points[0][0], s.points[1][0]);
            const y1 = Math.min(s.points[0][1], s.points[1][1]);
            const y2 = Math.max(s.points[0][1], s.points[1][1]);
            if (pt.x >= x1 && pt.x <= x2 && pt.y >= y1 && pt.y <= y2) {
              foundShape = sIdx;
            }
          }
        });
        setSelShapeIdx(foundShape);
        setSelVertexIdx(-1);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const pt = toImageCoords(e.clientX, e.clientY);
    if (dragInfo.mode === "create" && tool === "rectangle" && creatingPoints.length >= 2) {
      setCreatingPoints([creatingPoints[0], pt]);
    } else if (dragInfo.mode === "vertex" && dragInfo.shapeIdx !== undefined && dragInfo.vertexIdx !== undefined) {
      setShapes(prev => prev.map((s, idx) => {
        if (idx !== dragInfo.shapeIdx) return s;
        const newPts = s.points.map((p, vIdx) => vIdx === dragInfo.vertexIdx ? [pt.x, pt.y] : p);
        return { ...s, points: newPts };
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    if (dragInfo.mode === "create" && tool === "rectangle" && creatingPoints.length >= 2) {
      const newShape: LabelmeShape = {
        label: selLabel,
        points: [[creatingPoints[0].x, creatingPoints[0].y], [creatingPoints[1].x, creatingPoints[1].y]],
        group_id: null,
        description: "",
        shape_type: "rectangle",
        flags: {},
        mask: null,
        id: generateId(),
        color: getShapeColor(selLabel, classes),
        visible: true,
      };
      setShapes(prev => [...prev, newShape]);
      setCreatingPoints([]);
    }
    setDragInfo({ mode: "none", startPt: { x: 0, y: 0 } });
  };

  const handleCanvasDoubleClick = () => {
    if (tool === "polygon" && creatingPoints.length >= 3) {
      const newShape: LabelmeShape = {
        label: selLabel,
        points: creatingPoints.map(p => [p.x, p.y]),
        group_id: null,
        description: "",
        shape_type: "polygon",
        flags: {},
        mask: null,
        id: generateId(),
        color: getShapeColor(selLabel, classes),
        visible: true,
      };
      setShapes(prev => [...prev, newShape]);
      setCreatingPoints([]);
    }
  };

  const deleteShape = () => {
    if (selShapeIdx >= 0 && selShapeIdx < shapes.length) {
      pushUndo();
      setShapes(prev => prev.filter((_, idx) => idx !== selShapeIdx));
      setSelShapeIdx(-1);
    }
  };

  const addNewClass = () => {
    if (!newClassName.trim()) return;
    const newId = classes.length;
    const color = SHAPE_COLORS[newId % SHAPE_COLORS.length];
    setClasses(prev => [...prev, { id: newId, name: newClassName.trim(), color }]);
    setSelLabel(newClassName.trim());
    setNewClassName("");
    setShowNewClass(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* Top Application Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Brain size={22} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.5 }}>TissueAI Deep Vision Studio</span>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--accent)20", color: "var(--accent)", fontWeight: 600 }}>Burn Framework Engine</span>
        </div>

        {/* 3 Main Independent Tabs */}
        <div style={{ display: "flex", background: "var(--bg-tertiary)", padding: 3, borderRadius: 8, gap: 2 }}>
          {([
            { id: "annotate", label: "1. Data Labeling & Annotation", icon: <PenLine size={15} /> },
            { id: "train", label: "2. Model Training & Live Analytics", icon: <Activity size={15} /> },
            { id: "predict", label: "3. Model Execution & Testing", icon: <Target size={15} /> },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: tab === t.id ? "var(--accent)" : "transparent",
                color: tab === t.id ? "#ffffff" : "var(--text-secondary)",
                transition: "all 0.15s ease",
              }}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
          {images.length > 0 ? `${images.length} Image(s) Loaded` : "No Images"}
        </div>
      </div>

      {/* ================= TAB 1: DATA LABELING & ANNOTATION SUITE ================= */}
      {tab === "annotate" && (
        <div style={{ display: "flex", flex: 1, flexDirection: "column", overflow: "hidden" }}>
          {/* Top Canvas Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexWrap: "wrap" }}>
            <button onClick={openImages} style={secondaryBtn}><FolderOpen size={14} /> Open Images</button>
            <button onClick={openDir} style={secondaryBtn}><FolderOpen size={14} /> Open Dir</button>
            <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />

            <button onClick={() => navigateImage(-1)} style={secondaryBtn}><ChevronLeft size={14} /> Prev</button>
            <button onClick={() => navigateImage(1)} style={secondaryBtn}>Next <ChevronRight size={14} /></button>
            <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />

            <button onClick={saveLabels} style={primaryBtn}><Save size={14} /> Save LabelMe JSON</button>
            <button onClick={deleteShape} disabled={selShapeIdx < 0} style={secondaryBtn}><Trash2 size={14} /> Delete</button>
            <button onClick={undo} style={secondaryBtn}><Undo2 size={14} /> Undo</button>

            {/* Zoom Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
              <button onClick={() => setZoom(z => Math.max(10, z - 10))} style={secondaryBtn} title="Zoom Out"><ZoomOut size={14} /></button>
              <span style={{ fontSize: 11, minWidth: 36, textAlign: "center" }}>{zoom}%</span>
              <button onClick={() => setZoom(z => Math.min(500, z + 10))} style={secondaryBtn} title="Zoom In"><ZoomIn size={14} /></button>
              <button onClick={() => setZoom(100)} style={secondaryBtn} title="Reset Zoom"><Maximize size={14} /></button>
            </div>

            <button onClick={() => setShowBrightnessDlg(!showBrightnessDlg)} style={secondaryBtn}><Sun size={14} /> B/C</button>
            <button onClick={() => setShowExportModal(true)} style={{ ...secondaryBtn, marginLeft: "auto" }}><Download size={14} /> Export Dataset</button>
          </div>

          {/* Brightness / Contrast Modal */}
          {showBrightnessDlg && (
            <div style={{ position: "absolute", top: 90, right: 200, zIndex: 100, padding: 12, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, width: 220, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>Adjust Brightness & Contrast</div>
              <label style={formLabel}>
                Brightness: <strong>{brightness}%</strong>
                <input type="range" min="30" max="200" value={brightness} onChange={e => setBrightness(+e.target.value)} />
              </label>
              <label style={formLabel}>
                Contrast: <strong>{contrast}%</strong>
                <input type="range" min="30" max="200" value={contrast} onChange={e => setContrast(+e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button onClick={() => { setBrightness(100); setContrast(100); }} style={{ ...secondaryBtn, flex: 1 }}>Reset</button>
                <button onClick={() => setShowBrightnessDlg(false)} style={{ ...primaryBtn, flex: 1 }}>Done</button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* Left Tools & Tool Selector */}
            <div style={{ width: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", borderRight: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              {(["pointer", "rectangle", "polygon", "circle", "point", "line", "edit"] as Tool[]).map(t => (
                <button key={t} onClick={() => setTool(t)}
                  style={{
                    width: 44, height: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    borderRadius: 6, border: "none", cursor: "pointer", fontSize: 9, gap: 2,
                    background: tool === t ? "var(--accent)" : "transparent",
                    color: tool === t ? "#fff" : "var(--text-secondary)",
                  }}
                  title={t.toUpperCase()}>
                  {t === "pointer" ? <MousePointer2 size={16} /> : t === "rectangle" ? <Square size={16} /> : t === "polygon" ? <PenLine size={16} /> : t === "circle" ? <Circle size={16} /> : t === "point" ? <Dot size={16} /> : t === "line" ? <Minus size={16} /> : <Layers size={16} />}
                  <span>{t}</span>
                </button>
              ))}
            </div>

            {/* Interactive Image Canvas */}
            <div ref={containerRef} style={{ flex: 1, overflow: "auto", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0d0e" }}>
              {sel ? (
                <div style={{ position: "relative", transform: `scale(${zoom / 100})`, transformOrigin: "center center" }}>
                  <canvas ref={canvasRef} style={{ display: "block" }} />
                  <canvas ref={overlayRef}
                    style={{ position: "absolute", top: 0, left: 0, cursor: tool === "pointer" ? "default" : "crosshair" }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onDoubleClick={handleCanvasDoubleClick}
                  />
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-3)", padding: 40 }}>
                  <FileImage size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <div style={{ fontSize: 14 }}>Open an image or directory to start labeling</div>
                </div>
              )}
            </div>

            {/* Right Sidebar: Class Manager & Shape List */}
            <div style={{ width: 280, display: "flex", flexDirection: "column", borderLeft: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              {/* Active Class Selection */}
              <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Class Palette</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {classes.map(c => (
                    <button key={c.id} onClick={() => setSelLabel(c.name)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 12,
                        border: selLabel === c.name ? `2px solid ${c.color}` : "1px solid var(--border)",
                        background: selLabel === c.name ? c.color + "25" : "var(--bg-primary)",
                        color: "var(--text-primary)", cursor: "pointer", fontSize: 11, fontWeight: selLabel === c.name ? 600 : 400,
                      }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                      {c.name}
                    </button>
                  ))}
                  {showNewClass ? (
                    <div style={{ display: "flex", gap: 2 }}>
                      <input value={newClassName} onChange={e => setNewClassName(e.target.value)} onKeyDown={e => e.key === "Enter" && addNewClass()}
                        placeholder="Class..." style={{ width: 80, padding: "2px 6px", fontSize: 11, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)" }} autoFocus />
                      <button onClick={addNewClass} style={{ fontSize: 10, padding: "2px 6px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>OK</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowNewClass(true)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 12, border: "1px dashed var(--border)", background: "transparent", color: "var(--text-3)", cursor: "pointer", fontSize: 11 }}>
                      <Plus size={12} /> New
                    </button>
                  )}
                </div>
              </div>

              {/* Shape List Manager */}
              <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Annotations ({shapes.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {shapes.map((s, idx) => (
                    <div key={s.id} onClick={() => setSelShapeIdx(idx)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6,
                        background: idx === selShapeIdx ? "var(--accent)20" : "var(--bg-tertiary)",
                        border: idx === selShapeIdx ? "1px solid var(--accent)" : "1px solid transparent",
                        cursor: "pointer", fontSize: 12,
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />
                        <span style={{ fontWeight: 600 }}>{s.label}</span>
                        <span style={{ fontSize: 10, color: "var(--text-3)" }}>({s.shape_type})</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setShapes(prev => prev.filter((_, i) => i !== idx)); }} style={{ border: "none", background: "transparent", color: "var(--text-3)", cursor: "pointer" }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: MODEL TRAINING & REAL-TIME ANALYTICS ================= */}
      {tab === "train" && (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left Column: Hyperparameters & Training Controls */}
          <div style={{ width: 360, padding: 20, borderRight: "1px solid var(--border)", background: "var(--bg-secondary)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Brain size={18} style={{ color: "var(--accent)" }} /> Object Detection Training Setup
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)" }}>Configure deep learning model architecture and hyperparameters using Burn framework.</p>
            </div>

            {/* Architecture Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={formLabel}>Model Architecture
                <select value={detectionArch} onChange={e => setDetectionArch(e.target.value as "yolox" | "ssd")} style={formInput}>
                  <option value="yolox">YOLOX (Darknet Backbone + FPN + Decoupled Head)</option>
                  <option value="ssd">SSD (Single Shot MultiBox Detector + VGG16)</option>
                </select>
              </label>
            </div>

            {detectionArch === "yolox" && (
              <label style={formLabel}>Model Scale Variant
                <select value={yoloxSettings.model_size} onChange={e => setYoloxSettings(p => ({ ...p, model_size: e.target.value }))} style={formInput}>
                  <option value="yolox-nano">YOLOX-Nano (3.9M params - Fast)</option>
                  <option value="yolox-tiny">YOLOX-Tiny (5.1M params)</option>
                  <option value="yolox-s">YOLOX-S (9.1M params - Balanced)</option>
                  <option value="yolox-m">YOLOX-M (25.3M params)</option>
                  <option value="yolox-l">YOLOX-L (54.2M params - Accurate)</option>
                </select>
              </label>
            )}

            {/* Hyperparameters Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={formLabel}>Epochs
                <input type="number" value={yoloxSettings.epochs} onChange={e => setYoloxSettings(p => ({ ...p, epochs: Math.max(1, +e.target.value) }))} style={formInput} />
              </label>
              <label style={formLabel}>Batch Size
                <input type="number" value={yoloxSettings.batch_size} onChange={e => setYoloxSettings(p => ({ ...p, batch_size: Math.max(1, +e.target.value) }))} style={formInput} />
              </label>
              <label style={formLabel}>Learning Rate
                <input type="number" value={yoloxSettings.learning_rate} step={0.0001} onChange={e => setYoloxSettings(p => ({ ...p, learning_rate: +e.target.value }))} style={formInput} />
              </label>
              <label style={formLabel}>Optimizer
                <select value={yoloxSettings.optimizer} onChange={e => setYoloxSettings(p => ({ ...p, optimizer: e.target.value }))} style={formInput}>
                  <option value="adam">Adam</option>
                  <option value="adamw">AdamW</option>
                  <option value="sgd">SGD with Momentum</option>
                </select>
              </label>
            </div>

            <label style={formLabel}>Output Directory
              <input value={yoloxSettings.output_dir} onChange={e => setYoloxSettings(p => ({ ...p, output_dir: e.target.value }))} placeholder="Auto (models/detection)" style={formInput} />
            </label>

            {/* Dataset Summary Card */}
            <div style={{ padding: 12, background: "var(--bg-tertiary)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Dataset Status</div>
              <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>Images Count:</span> <strong>{images.length}</strong>
              </div>
              <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span>Active Classes:</span> <strong>{classes.filter(c => c.name !== "_background_").length}</strong>
              </div>
            </div>

            {/* Start Training Button */}
            <button onClick={async () => {
              if (images.length === 0 && !sel) {
                setTrainStatusMsg("Error: Please load at least one annotated image first.");
                return;
              }
              setIsTraining(true);
              setLossHistory([]);
              setTrainLogs([]);
              setTrainStatusMsg(`Starting ${detectionArch.toUpperCase()} Burn training...`);

              try {
                const image_paths = images.length > 0 ? images.map(img => img.path) : (sel ? [sel.path] : []);
                const output_dir = yoloxSettings.output_dir.trim() || "models/detection";

                if (detectionArch === "yolox") {
                  const annotations = await Promise.all(image_paths.map(async (p, idx) => {
                    let imgShapes = shapes;
                    if (idx !== selImgIdx) {
                      try {
                        const lblPath = await invoke<string>("get_label_file_path", { imagePath: p });
                        const f = await invoke<any>("load_labelme_json", { path: lblPath });
                        if (f && f.shapes) imgShapes = f.shapes;
                      } catch { imgShapes = []; }
                    }
                    const curImg = images[idx] || sel;
                    const imgW = curImg?.width || 640;
                    const imgH = curImg?.height || 640;

                    return imgShapes.map(s => {
                      const xs = s.points.map(pt => pt[0]);
                      const ys = s.points.map(pt => pt[1]);
                      const x_min = Math.min(...xs), x_max = Math.max(...xs);
                      const y_min = Math.min(...ys), y_max = Math.max(...ys);
                      const w = Math.max(1, x_max - x_min), h = Math.max(1, y_max - y_min);
                      const cx = x_min + w / 2, cy = y_min + h / 2;
                      const cIdx = classes.findIndex(c => c.name === s.label);
                      return {
                        class_id: cIdx >= 0 ? cIdx : 0,
                        x_center: cx / imgW,
                        y_center: cy / imgH,
                        width: w / imgW,
                        height: h / imgH,
                      };
                    });
                  }));

                  const classTuples = classes.map(c => [c.id, c.name]);
                  const res = await invoke<{ message: string; loss_history: number[]; model_path: string }>("train_yolox_model", {
                    request: {
                      image_paths,
                      annotations,
                      classes: classTuples,
                      epochs: yoloxSettings.epochs,
                      batch_size: yoloxSettings.batch_size,
                      learning_rate: yoloxSettings.learning_rate,
                      model_size: yoloxSettings.model_size,
                      output_dir,
                    }
                  });
                  setTrainStatusMsg(res.message);
                  setPredModelPath(res.model_path);
                } else {
                  const annotations = await Promise.all(image_paths.map(async (p, idx) => {
                    let imgShapes = shapes;
                    if (idx !== selImgIdx) {
                      try {
                        const lblPath = await invoke<string>("get_label_file_path", { imagePath: p });
                        const f = await invoke<any>("load_labelme_json", { path: lblPath });
                        if (f && f.shapes) imgShapes = f.shapes;
                      } catch { imgShapes = []; }
                    }

                    return imgShapes.map(s => {
                      const xs = s.points.map(pt => pt[0]);
                      const ys = s.points.map(pt => pt[1]);
                      const cIdx = classes.findIndex(c => c.name === s.label);
                      return {
                        class_id: cIdx >= 0 ? cIdx : 0,
                        x1: Math.min(...xs),
                        y1: Math.min(...ys),
                        x2: Math.max(...xs),
                        y2: Math.max(...ys),
                      };
                    });
                  }));

                  const classNames = classes.map(c => c.name);
                  const res = await invoke<{ message: string; loss_history: number[]; model_path: string }>("train_ssd_model", {
                    request: {
                      image_paths,
                      annotations,
                      classes: classNames,
                      epochs: yoloxSettings.epochs,
                      batch_size: yoloxSettings.batch_size,
                      learning_rate: yoloxSettings.learning_rate,
                      output_dir,
                    }
                  });
                  setTrainStatusMsg(res.message);
                  setPredModelPath(res.model_path);
                }
              } catch (e: any) { setTrainStatusMsg(`Error: ${e}`); }
              setIsTraining(false);
            }} disabled={isTraining} style={{ ...primaryBtn, padding: "12px 20px", fontSize: 13, justifyContent: "center" }}>
              {isTraining ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {isTraining ? `Training ${detectionArch.toUpperCase()}...` : `⚡ Start Training ${detectionArch.toUpperCase()}`}
            </button>

            {trainStatusMsg && (
              <div style={{ padding: 10, background: "var(--bg-tertiary)", borderRadius: 6, fontSize: 12, border: "1px solid var(--border)" }}>
                {trainStatusMsg}
              </div>
            )}
          </div>

          {/* Right Column: Real-Time Analytics & Live Graph */}
          <div style={{ flex: 1, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, background: "var(--bg-primary)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Real-Time Live Training Analytics</h3>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Live stream of epoch loss curve and execution metrics via Tauri event stream</span>
              </div>
              {isTraining && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--accent)20", color: "var(--accent)", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                  <Loader2 size={14} className="animate-spin" /> Training Active...
                </div>
              )}
            </div>

            {/* Live Animated Progress Bar */}
            {totalEpochs > 0 && (
              <div style={{ padding: 12, background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  <span>Epoch Progress</span>
                  <span>{currentEpoch} / {totalEpochs} ({Math.round((currentEpoch / totalEpochs) * 100)}%)</span>
                </div>
                <div style={{ width: "100%", height: 8, background: "var(--bg-tertiary)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(currentEpoch / totalEpochs) * 100}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s ease" }} />
                </div>
              </div>
            )}

            {/* Real-Time SVG Loss Graph */}
            <div style={{ padding: 16, background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Activity size={16} style={{ color: "var(--accent)" }} /> Live Loss Curve
                </span>
                {lossHistory.length > 0 && (
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>Latest Loss: <strong>{lossHistory[lossHistory.length - 1].toFixed(6)}</strong></span>
                )}
              </div>

              {lossHistory.length > 0 ? (
                <svg width="100%" height={160} viewBox={`0 0 ${Math.max(10, lossHistory.length)} 100`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
                  <line x1="0" y1="20" x2={lossHistory.length} y2="20" stroke="var(--border)" strokeDasharray="2" />
                  <line x1="0" y1="50" x2={lossHistory.length} y2="50" stroke="var(--border)" strokeDasharray="2" />
                  <line x1="0" y1="80" x2={lossHistory.length} y2="80" stroke="var(--border)" strokeDasharray="2" />

                  <polyline
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    points={lossHistory.map((l, i) => {
                      const maxL = Math.max(...lossHistory, 1.0);
                      const minL = Math.min(...lossHistory, 0.0);
                      const norm = maxL === minL ? 50 : 10 + (1 - (l - minL) / (maxL - minL)) * 80;
                      return `${i},${norm}`;
                    }).join(" ")}
                  />
                </svg>
              ) : (
                <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: 12, border: "1px dashed var(--border)", borderRadius: 6 }}>
                  No training data yet. Click "Start Training" to begin.
                </div>
              )}
            </div>

            {/* Live Terminal Log Console */}
            <div style={{ flex: 1, padding: 12, background: "#0e1013", borderRadius: 8, border: "1px solid var(--border)", display: "flex", flexDirection: "column", fontFamily: "Consolas, monospace" }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Terminal size={14} /> Training Event Log Stream
              </div>
              <div ref={logTerminalRef} style={{ flex: 1, minHeight: 120, maxHeight: 200, overflowY: "auto", fontSize: 11, color: "#00ff66", display: "flex", flexDirection: "column", gap: 2 }}>
                {trainLogs.length > 0 ? (
                  trainLogs.map((log, i) => <div key={i}>{log}</div>)
                ) : (
                  <div style={{ color: "#666" }}>Ready... Engine initialized.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: MODEL EXECUTION & TESTING ================= */}
      {tab === "predict" && (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left Column: Model Loader & Threshold Controls */}
          <div style={{ width: 320, padding: 20, borderRight: "1px solid var(--border)", background: "var(--bg-secondary)", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Target size={18} style={{ color: "var(--accent)" }} /> Model Execution & Inference
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)" }}>Load trained Burn framework model weights and run object detection inference.</p>
            </div>

            {/* Load Model Weight Button */}
            <button onClick={async () => {
              const file = await open({ filters: [{ name: "Burn Model", extensions: ["bin", "gz", "json"] }] });
              if (file && typeof file === "string") {
                setPredModelPath(file);
                setInferStatusMsg(`Loaded model: ${file.split(/[\\/]/).pop()}`);
              }
            }} style={secondaryBtn}>
              <Upload size={14} /> Load Trained Model Weights
            </button>

            {predModelPath && (
              <div style={{ fontSize: 11, padding: 8, background: "var(--bg-tertiary)", borderRadius: 6, color: "var(--text-secondary)", wordBreak: "break-all" }}>
                <strong>Active Model:</strong> {predModelPath.split(/[\\/]/).pop()}
              </div>
            )}

            {/* Inference Sliders */}
            <label style={formLabel}>
              Confidence Threshold: <strong>{(confThreshold * 100).toFixed(0)}%</strong>
              <input type="range" min="0.05" max="0.95" step="0.05" value={confThreshold} onChange={e => setConfThreshold(+e.target.value)} style={{ width: "100%" }} />
            </label>

            <label style={formLabel}>
              NMS IoU Threshold: <strong>{(nmsThreshold * 100).toFixed(0)}%</strong>
              <input type="range" min="0.10" max="0.90" step="0.05" value={nmsThreshold} onChange={e => setNmsThreshold(+e.target.value)} style={{ width: "100%" }} />
            </label>

            {/* Run Detection Button */}
            <button onClick={async () => {
              if (!sel) {
                setInferStatusMsg("Error: Please select an image in Tab 1 first.");
                return;
              }
              setIsInferring(true);
              setInferStatusMsg("Running Burn object detection inference...");
              try {
                const classNames = classes.map(c => c.name);
                const res = await invoke<Array<{ class_id: number; class_name: string; confidence: number; x1: number; y1: number; x2: number; y2: number }>>("predict_ssd", {
                  imagePath: sel.path,
                  classes: classNames,
                  confidenceThreshold: confThreshold,
                  nmsThreshold: nmsThreshold,
                });
                setDetectedBoxes(res);
                setInferStatusMsg(`Inference Complete! Detected ${res.length} bounding box(es).`);
              } catch (e: any) {
                setInferStatusMsg(`Detection Error: ${e}`);
              }
              setIsInferring(false);
            }} disabled={isInferring || !sel} style={{ ...primaryBtn, padding: "12px 20px", fontSize: 13, justifyContent: "center" }}>
              {isInferring ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
              {isInferring ? "Detecting..." : "🎯 Run Detection on Current Image"}
            </button>

            {inferStatusMsg && (
              <div style={{ padding: 10, background: "var(--bg-tertiary)", borderRadius: 6, fontSize: 12, border: "1px solid var(--border)" }}>
                {inferStatusMsg}
              </div>
            )}
          </div>

          {/* Right Column: Visual Inference Canvas & Detection Results */}
          <div style={{ flex: 1, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Inference Visualization Canvas</h3>
              {detectedBoxes.length > 0 && (
                <span style={{ fontSize: 12, padding: "4px 8px", background: "var(--accent)20", color: "var(--accent)", borderRadius: 12, fontWeight: 600 }}>
                  {detectedBoxes.length} Object(s) Detected
                </span>
              )}
            </div>

            {/* Inference Canvas with Bounding Boxes */}
            <div style={{ position: "relative", minHeight: 300, background: "#0c0d0e", borderRadius: 8, border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {sel ? (
                <canvas ref={inferCanvasRef} style={{ maxWidth: "100%", maxHeight: 400, display: "block" }} />
              ) : (
                <div style={{ color: "var(--text-3)", fontSize: 12 }}>No active image selected</div>
              )}
            </div>

            {/* Detections Data Table */}
            {detectedBoxes.length > 0 && (
              <div style={{ padding: 16, background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Detection Results Details</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-3)" }}>
                      <th style={{ padding: "6px 8px" }}>#</th>
                      <th style={{ padding: "6px 8px" }}>Class</th>
                      <th style={{ padding: "6px 8px" }}>Confidence</th>
                      <th style={{ padding: "6px 8px" }}>Bounding Box [X1, Y1, X2, Y2]</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detectedBoxes.map((b, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "6px 8px" }}>{idx + 1}</td>
                        <td style={{ padding: "6px 8px", fontWeight: 600, color: getShapeColor(b.class_name, classes) }}>{b.class_name || `Class ${b.x1}`}</td>
                        <td style={{ padding: "6px 8px" }}>{(b.confidence * 100).toFixed(1)}%</td>
                        <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>[{Math.round(b.x1)}, {Math.round(b.y1)}, {Math.round(b.x2)}, {Math.round(b.y2)}]</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Dataset Modal (within Tab 1) */}
      {showExportModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ width: 400, padding: 20, background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Export Dataset</h3>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Export annotations in YOLO or PyTorch format for external training.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["yolo", "pytorch"] as const).map(f => (
                <button key={f} onClick={() => setExpFormat(f)} style={{
                  flex: 1, padding: "8px", borderRadius: 6, border: expFormat === f ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: expFormat === f ? "var(--accent)20" : "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                }}>{f.toUpperCase()}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <label style={formLabel}>Project Name
                <input value={expSettings.project_name} onChange={e => setExpSettings(p => ({ ...p, project_name: e.target.value }))} style={formInput} />
              </label>
              <label style={formLabel}>Image Resolution
                <input type="number" value={expSettings.image_size} onChange={e => setExpSettings(p => ({ ...p, image_size: +e.target.value }))} style={formInput} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => {
                if (!sel) return;
                try {
                  const dir = await open({ directory: true });
                  if (!dir) return;
                  const cmd = expFormat === "yolo" ? "export_yolo" : "export_pytorch";
                  await invoke(cmd, {
                    imagePath: sel.path,
                    annotations: shapes.map(s => ({ label: s.label, points: s.points, shape_type: s.shape_type })),
                    classes: classes.map(c => c.name),
                    outputDir: dir,
                    settings: expSettings,
                  });
                  setTrainStatusMsg("Dataset exported successfully!");
                  setShowExportModal(false);
                } catch (e: any) { setTrainStatusMsg(`Export Error: ${e}`); }
              }} style={primaryBtn}><Download size={14} /> Export Dataset</button>
              <button onClick={() => setShowExportModal(false)} style={secondaryBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

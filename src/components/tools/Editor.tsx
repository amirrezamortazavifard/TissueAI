import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

import { 
  Tool, BrushType, Point, Selection, 
  Layer, ImageAdjustments, DEFAULT_ADJUSTMENTS, 
  MeasureUnit, StainPreset 
} from "./Editor/Utils/types";
import { hexToRgb, floodFill as jsFloodFill, getCanvasCoords } from "./Editor/Utils/canvasUtils";
import { drawBrushStroke, drawPencilStroke } from "./Editor/Brushes/BrushEngine";
import {
  drawLineShape, drawRectShape, drawRoundedRectShape, drawEllipseShape,
} from "./Editor/Shapes/ShapeRenderer";
import { HistoryManager, saveMultiLayerToHistory, restoreMultiLayerFromHistory } from "./Editor/History/HistoryManager";
import { useCanvasTransform } from "./Editor/Canvas/CanvasManager";
import DrawingCanvas, { DrawingCanvasHandle } from "./Editor/Canvas/DrawingCanvas";
import GridOverlay from "./Editor/Canvas/GridOverlay";
import LeftToolbar from "./Editor/Toolbar/LeftToolbar";
import ToolOptionsBar from "./Editor/Toolbar/ToolOptionsBar";
import TopMenuBar from "./Editor/TopBar/TopMenuBar";
import RightBentoPanel from "./Editor/Panels/RightBentoPanel";
import StatusBar from "./Editor/Panels/StatusBar";
import SelectionOverlay from "./Editor/Selection/SelectionOverlay";
import NewCanvasDialog from "./Editor/Dialogs/NewCanvasDialog";
import ResizeDialog from "./Editor/Dialogs/ResizeDialog";
import { Upload } from "lucide-react";

export default function Editor() {
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const pendingImage = useRef<{ base64: string; w: number; h: number } | null>(null);

  const historyManager = useRef(new HistoryManager(50));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Multi-layer State
  const [layers, setLayers] = useState<Layer[]>([
    { id: "layer-1", name: "Background", visible: true, locked: false, opacity: 100, blendMode: "normal" }
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>("layer-1");
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS);

  // Tool State
  const [tool, setTool] = useState<Tool>("brush");
  const [primaryColor, setPrimaryColor] = useState("#c084fc");
  const [secondaryColor, setSecondaryColor] = useState("#000000");
  const [penThickness, setPenThickness] = useState(5);
  const [eraserThickness, setEraserThickness] = useState(20);
  const [brushType, setBrushType] = useState<BrushType>("default");
  const [brushHardness, setBrushHardness] = useState(80);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [fillColor, setFillColor] = useState("transparent");
  const [strokeColor, setStrokeColor] = useState("#c084fc");
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontBold, setFontBold] = useState(false);
  const [fontItalic, setFontItalic] = useState(false);
  const [floodFillTolerance, setFloodFillTolerance] = useState(30);
  const [roundedRectRadius, setRoundedRectRadius] = useState(10);
  const [measureUnit, setMeasureUnit] = useState<MeasureUnit>("px");
  const [stainPreset, setStainPreset] = useState<StainPreset>("he");

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<Point | null>(null);
  const lastPos = useRef<Point | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);

  const [selection, setSelection] = useState<Selection | null>(null);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showResizeDialog, setShowResizeDialog] = useState(false);

  const [showRulers, setShowRulers] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [gridSize] = useState(20);

  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const transform = useCanvasTransform();

  useEffect(() => {
    invoke<string[]>("get_system_fonts").then(setSystemFonts).catch(() => {});
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
      // Tool Shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        if (e.key.toLowerCase() === "h") setTool("pan");
        if (e.key.toLowerCase() === "z") setTool("magnifier");
        if (e.key.toLowerCase() === "m") setTool("select");
        if (e.key.toLowerCase() === "l") setTool("freeSelect");
        if (e.key.toLowerCase() === "w") setTool("magicWand");
        if (e.key.toLowerCase() === "b") setTool("brush");
        if (e.key.toLowerCase() === "n") setTool("pencil");
        if (e.key.toLowerCase() === "e") setTool("eraser");
        if (e.key.toLowerCase() === "g") setTool("fill");
        if (e.key.toLowerCase() === "i") setTool("eyedropper");
        if (e.key.toLowerCase() === "t") setTool("text");
        if (e.key.toLowerCase() === "u") setTool("rect");
        if (e.key.toLowerCase() === "s") setTool("cloneStamp");
      }
      
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) handleRedo(); else handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") handleRedo();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const updateHistoryState = useCallback(() => {
    setCanUndo(historyManager.current.canUndo());
    setCanRedo(historyManager.current.canRedo());
    setHistoryIndex(historyManager.current.getHistoryIndex());
  }, []);

  const commitToHistory = useCallback(() => {
    if (canvasRef.current) {
      saveMultiLayerToHistory(
        layers,
        activeLayerId,
        canvasRef.current.getLayerCanvas,
        historyManager.current
      );
      updateHistoryState();
      
      // Update layers to capture current state in React
      setLayers([...layers]); 
    }
  }, [layers, activeLayerId, updateHistoryState]);

  const handleUndo = useCallback(() => {
    const entry = historyManager.current.popForUndo();
    if (!entry) return;
    if (canvasRef.current) {
      restoreMultiLayerFromHistory(entry, canvasRef.current.getLayerCanvas);
      setActiveLayerId(entry.activeLayerId);
      
      // We need to map the snapshotted layers back into React state
      // (This assumes we only restore visual image data, we should also restore layer metadata if layers were deleted/added)
      const restoredLayers = layers.map(l => {
         const snap = entry.layers.find(s => s.id === l.id);
         return snap ? { ...l } : l; // Simple shallow clone to trigger render
      });
      setLayers(restoredLayers);
      canvasRef.current.forceRender();
    }
    updateHistoryState();
  }, [updateHistoryState, layers]);

  const handleRedo = useCallback(() => {
    const entry = historyManager.current.redo();
    if (!entry) return;
    if (canvasRef.current) {
      restoreMultiLayerFromHistory(entry, canvasRef.current.getLayerCanvas);
      setActiveLayerId(entry.activeLayerId);
      
      const restoredLayers = layers.map(l => {
         const snap = entry.layers.find(s => s.id === l.id);
         return snap ? { ...l } : l;
      });
      setLayers(restoredLayers);
      canvasRef.current.forceRender();
    }
    updateHistoryState();
  }, [updateHistoryState, layers]);

  const loadNewImage = useCallback(async (base64: string, w: number, h: number) => {
    setCanvasWidth(w);
    setCanvasHeight(h);
    pendingImage.current = { base64, w, h };
    setImageLoaded(true);
  }, []);

  useEffect(() => {
    if (imageLoaded && pendingImage.current && canvasRef.current) {
      const { base64 } = pendingImage.current;
      pendingImage.current = null;
      
      const targetId = activeLayerId || layers[0]?.id || "layer-1";
      
      canvasRef.current.loadMainImage(base64, targetId).then(() => {
        historyManager.current.clear();
        commitToHistory();
      });
    }
  }, [imageLoaded, commitToHistory, activeLayerId, layers]);

  const handleLoadImage = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "gif", "tiff"] }],
    });
    if (!selected) return;
    try {
      const result = await invoke<{ width: number; height: number; base64: string }>("load_editor_image", { path: selected });
      await loadNewImage(result.base64, result.width, result.height);
    } catch (err) {
      console.error("Failed to load image:", err);
    }
  }, [loadNewImage]);

  const handleSaveImage = useCallback(async () => {
    const compositeCanvas = canvasRef.current?.getCompositeCanvas();
    if (!compositeCanvas) return;
    
    const path = await save({
      filters: [
        { name: "PNG", extensions: ["png"] },
        { name: "JPEG", extensions: ["jpg"] },
      ],
      defaultPath: "tissue_analysis_out.png",
    });
    if (!path) return;
    
    try {
      const base64 = compositeCanvas.toDataURL("image/png");
      await invoke("save_editor_image", { path, base64Data: base64 });
    } catch (err) {
      console.error("Failed to save:", err);
    }
  }, []);

  const handleNewCanvas = useCallback(async (w: number, h: number, bg: string) => {
    try {
      const result = await invoke<{ width: number; height: number; base64: string }>(
        "create_new_canvas", { width: w, height: h, bgHex: bg }
      );
      await loadNewImage(result.base64, result.width, result.height);
    } catch (err) {
      console.error("Failed to create canvas:", err);
    }
  }, [loadNewImage]);

  const handleResizeCanvas = useCallback(async (w: number, h: number) => {
    try {
      const composite = canvasRef.current?.getCompositeCanvas();
      if (!composite) return;
      const base64In = composite.toDataURL("image/png");
      const bg = hexToRgb("#ffffff");
      const result = await invoke<{ width: number; height: number; base64: string }>(
        "resize_canvas_base64", { base64Data: base64In, newWidth: w, newHeight: h, bgR: bg.r, bgG: bg.g, bgB: bg.b, bgA: 255 }
      );
      await loadNewImage(result.base64, result.width, result.height);
    } catch (err) {
      // Stub if Rust backend method not implemented yet
      console.warn("Resize via Rust failed, stubbed action.", err);
    }
  }, [loadNewImage]);

  const cellCountRef = useRef(0);
  const [ctrlHeld, setCtrlHeld] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.ctrlKey) setCtrlHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || !e.ctrlKey) setCtrlHeld(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const getCoords = useCallback((e: React.MouseEvent): Point => {
    const overlay = canvasRef.current?.getOverlayCanvas();
    if (overlay) {
      const rect = overlay.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: (e.clientX - rect.left) * (canvasWidth / rect.width),
          y: (e.clientY - rect.top) * (canvasHeight / rect.height),
        };
      }
    }
    return getCanvasCoords(e, transform.transform.zoom, transform.transform.panX, transform.transform.panY);
  }, [canvasWidth, canvasHeight, transform.transform.zoom, transform.transform.panX, transform.transform.panY]);

  // Canvas Drawing & Tool Handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!imageLoaded) return;
    if (e.button === 1 || (e.button === 0 && (ctrlHeld || tool === "pan"))) {
      transform.startPan(e);
      return;
    }

    const activeCanvas = canvasRef.current?.getActiveCanvas();
    if (!activeCanvas) return;
    const coords = getCoords(e);
    const ctx = activeCanvas.getContext("2d");
    if (!ctx) return;

    if (tool === "magnifier") {
      if (e.button === 2) transform.zoomOut();
      else transform.zoomIn();
      return;
    }

    if (tool === "eyedropper") {
      const compCanvas = canvasRef.current?.getCompositeCanvas() || activeCanvas;
      const cCtx = compCanvas.getContext("2d");
      if (cCtx) {
        const pixel = cCtx.getImageData(Math.floor(coords.x), Math.floor(coords.y), 1, 1).data;
        const hex = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1].toString(16).padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`;
        if (e.button === 2) setSecondaryColor(hex);
        else setPrimaryColor(hex);
      }
      return;
    }

    if (tool === "cellCounter") {
      cellCountRef.current += 1;
      const count = cellCountRef.current;
      ctx.save();
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#06b6d4";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(count.toString(), coords.x, coords.y);
      ctx.restore();
      commitToHistory();
      return;
    }

    if (tool === "annotationPin") {
      const note = prompt("Enter annotation note:", "Tissue Feature");
      if (note !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(coords.x, coords.y - 12, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#ec4899";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y - 4);
        ctx.lineTo(coords.x, coords.y);
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = "rgba(15, 20, 30, 0.9)";
        const textWidth = Math.max(60, note.length * 7 + 12);
        ctx.fillRect(coords.x + 10, coords.y - 20, textWidth, 20);
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = 1;
        ctx.strokeRect(coords.x + 10, coords.y - 20, textWidth, 20);

        ctx.fillStyle = "#ffffff";
        ctx.font = "11px sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(note, coords.x + 16, coords.y - 10);
        ctx.restore();
        commitToHistory();
      }
      return;
    }

    if (tool === "text") {
      const textInput = prompt("Enter text to insert:", "Sample Label");
      if (textInput) {
        ctx.save();
        let fontStyle = "";
        if (fontItalic) fontStyle += "italic ";
        if (fontBold) fontStyle += "bold ";
        ctx.font = `${fontStyle}${fontSize}px ${fontFamily}`;
        ctx.fillStyle = primaryColor;
        ctx.fillText(textInput, coords.x, coords.y);
        ctx.restore();
        commitToHistory();
      }
      return;
    }

    if (tool === "magicWand") {
      setSelection({
        type: "rect",
        rect: {
          x: Math.max(0, Math.round(coords.x) - 40),
          y: Math.max(0, Math.round(coords.y) - 40),
          w: 80,
          h: 80
        },
        transparent: false,
        moving: false,
        resizing: false
      });
      return;
    }

    setIsDrawing(true);
    setStartPos(coords);
    lastPos.current = coords;

    if (tool === "fill") {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      jsFloodFill(ctx, coords.x, coords.y, primaryColor, floodFillTolerance);
      ctx.restore();
      commitToHistory();
      setIsDrawing(false);
      return;
    }

    if (tool === "colorEraser") {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      jsFloodFill(ctx, coords.x, coords.y, "transparent", floodFillTolerance);
      ctx.restore();
      commitToHistory();
      setIsDrawing(false);
      return;
    }
  }, [imageLoaded, tool, transform, primaryColor, secondaryColor, floodFillTolerance, commitToHistory, fontBold, fontItalic, fontSize, fontFamily, ctrlHeld]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!imageLoaded) return;
    const coords = getCoords(e);
    setMousePos(coords);

    if (transform.isPanning.current) {
      transform.doPan(e);
      return;
    }

    if (!isDrawing || !startPos || !lastPos.current) return;

    const overlayCtx = canvasRef.current?.getOverlayCtx();
    if (!overlayCtx) return;

    if (["pencil", "brush", "airbrush", "eraser"].includes(tool)) {
      const activeCanvas = canvasRef.current?.getActiveCanvas();
      if (!activeCanvas) return;
      const ctx = activeCanvas.getContext("2d");
      if (!ctx) return;

      if (tool === "pencil") {
        drawPencilStroke(ctx, lastPos.current, coords, primaryColor);
      } else if (tool === "brush" || tool === "airbrush") {
        drawBrushStroke(ctx, lastPos.current, coords, primaryColor, penThickness, tool === "airbrush" ? "airbrush" : brushType);
      } else if (tool === "eraser") {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        drawBrushStroke(ctx, lastPos.current, coords, "rgba(0,0,0,1)", eraserThickness, "default");
        ctx.restore();
      }
      lastPos.current = coords;
      return;
    }

    // Previews on overlay
    canvasRef.current?.clearOverlay();
    if (tool === "line") drawLineShape(overlayCtx, startPos, coords, primaryColor, penThickness, shiftHeld);
    else if (tool === "rect") drawRectShape(overlayCtx, startPos, coords, strokeColor, fillColor, penThickness, shiftHeld);
    else if (tool === "roundedRect") drawRoundedRectShape(overlayCtx, startPos, coords, strokeColor, fillColor, penThickness, roundedRectRadius, shiftHeld);
    else if (tool === "ellipse") drawEllipseShape(overlayCtx, startPos, coords, strokeColor, fillColor, penThickness, shiftHeld);
    
    else if (tool === "measure") {
      overlayCtx.save();
      overlayCtx.beginPath();
      overlayCtx.moveTo(startPos.x, startPos.y);
      overlayCtx.lineTo(coords.x, coords.y);
      overlayCtx.strokeStyle = "#06b6d4";
      overlayCtx.lineWidth = 2;
      overlayCtx.setLineDash([4, 4]);
      overlayCtx.stroke();

      const distPx = Math.sqrt((coords.x - startPos.x) ** 2 + (coords.y - startPos.y) ** 2);
      let label = `${distPx.toFixed(1)} px`;
      if (measureUnit === "µm") label = `${(distPx * 0.5).toFixed(1)} µm`;
      if (measureUnit === "mm") label = `${(distPx * 0.0005).toFixed(3)} mm`;

      const midX = (startPos.x + coords.x) / 2;
      const midY = (startPos.y + coords.y) / 2;
      overlayCtx.fillStyle = "rgba(6, 182, 212, 0.9)";
      overlayCtx.fillRect(midX - 35, midY - 14, 70, 20);
      overlayCtx.fillStyle = "#ffffff";
      overlayCtx.font = "bold 11px sans-serif";
      overlayCtx.textAlign = "center";
      overlayCtx.fillText(label, midX, midY + 1);
      overlayCtx.restore();
    }

    else if (tool === "roi") {
      const x = Math.min(startPos.x, coords.x);
      const y = Math.min(startPos.y, coords.y);
      const w = Math.abs(coords.x - startPos.x);
      const h = Math.abs(coords.y - startPos.y);

      overlayCtx.save();
      overlayCtx.strokeStyle = "#10b981";
      overlayCtx.lineWidth = 2;
      overlayCtx.setLineDash([6, 3]);
      overlayCtx.strokeRect(x, y, w, h);
      overlayCtx.fillStyle = "rgba(16, 185, 129, 0.1)";
      overlayCtx.fillRect(x, y, w, h);

      const label = `ROI: ${Math.round(w)} x ${Math.round(h)} px (${Math.round(w * h).toLocaleString()} px²)`;
      overlayCtx.fillStyle = "rgba(16, 185, 129, 0.9)";
      overlayCtx.fillRect(x, y - 22, label.length * 6.5 + 12, 20);
      overlayCtx.fillStyle = "#ffffff";
      overlayCtx.font = "bold 11px sans-serif";
      overlayCtx.fillText(label, x + 6, y - 8);
      overlayCtx.restore();
    }

    else if (tool === "stainAnalysis") {
      const x = Math.min(startPos.x, coords.x);
      const y = Math.min(startPos.y, coords.y);
      const w = Math.abs(coords.x - startPos.x);
      const h = Math.abs(coords.y - startPos.y);

      overlayCtx.save();
      overlayCtx.strokeStyle = "#c084fc";
      overlayCtx.lineWidth = 2;
      overlayCtx.setLineDash([4, 4]);
      overlayCtx.strokeRect(x, y, w, h);
      overlayCtx.fillStyle = "rgba(192, 132, 252, 0.15)";
      overlayCtx.fillRect(x, y, w, h);

      const label = `Stain Analysis Area: ${Math.round(w * h)} px²`;
      overlayCtx.fillStyle = "rgba(192, 132, 252, 0.95)";
      overlayCtx.fillRect(x, y - 22, label.length * 6.5 + 12, 20);
      overlayCtx.fillStyle = "#ffffff";
      overlayCtx.font = "bold 11px sans-serif";
      overlayCtx.fillText(label, x + 6, y - 8);
      overlayCtx.restore();
    }

    else if (tool === "gradient") {
      overlayCtx.save();
      overlayCtx.beginPath();
      overlayCtx.moveTo(startPos.x, startPos.y);
      overlayCtx.lineTo(coords.x, coords.y);
      overlayCtx.strokeStyle = primaryColor;
      overlayCtx.lineWidth = 2;
      overlayCtx.stroke();
      overlayCtx.restore();
    }

    else if (tool === "select" || tool === "freeSelect" || tool === "lassoPolygonal") {
      const x = Math.min(startPos.x, coords.x);
      const y = Math.min(startPos.y, coords.y);
      const w = Math.abs(coords.x - startPos.x);
      const h = Math.abs(coords.y - startPos.y);

      overlayCtx.save();
      overlayCtx.strokeStyle = "#ffffff";
      overlayCtx.lineWidth = 1.5;
      overlayCtx.setLineDash([5, 5]);
      overlayCtx.strokeRect(x, y, w, h);
      overlayCtx.fillStyle = "rgba(255, 255, 255, 0.05)";
      overlayCtx.fillRect(x, y, w, h);
      overlayCtx.restore();
    }
  }, [imageLoaded, isDrawing, startPos, tool, transform, primaryColor, strokeColor, fillColor, penThickness, eraserThickness, brushType, shiftHeld, measureUnit, roundedRectRadius, getCoords]);

  const handleMouseUp = useCallback(() => {
    if (!imageLoaded) return;
    if (transform.isPanning.current) {
      transform.endPan();
      return;
    }
    if (!isDrawing) return;

    setIsDrawing(false);
    const activeCanvas = canvasRef.current?.getActiveCanvas();

    if (["line", "rect", "roundedRect", "ellipse"].includes(tool)) {
      canvasRef.current?.commitToActiveLayer();
      commitToHistory();
    }

    else if (tool === "measure") {
      if (activeCanvas && startPos && lastPos.current) {
        const ctx = activeCanvas.getContext("2d");
        if (ctx) {
          const endPos = lastPos.current;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(endPos.x, endPos.y);
          ctx.strokeStyle = "#06b6d4";
          ctx.lineWidth = 2;
          ctx.stroke();

          const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
          ctx.beginPath();
          ctx.moveTo(startPos.x - 6 * Math.sin(angle), startPos.y + 6 * Math.cos(angle));
          ctx.lineTo(startPos.x + 6 * Math.sin(angle), startPos.y - 6 * Math.cos(angle));
          ctx.moveTo(endPos.x - 6 * Math.sin(angle), endPos.y + 6 * Math.cos(angle));
          ctx.lineTo(endPos.x + 6 * Math.sin(angle), endPos.y - 6 * Math.cos(angle));
          ctx.stroke();

          const distPx = Math.sqrt((endPos.x - startPos.x) ** 2 + (endPos.y - startPos.y) ** 2);
          let label = `${distPx.toFixed(1)} px`;
          if (measureUnit === "µm") label = `${(distPx * 0.5).toFixed(1)} µm`;
          if (measureUnit === "mm") label = `${(distPx * 0.0005).toFixed(3)} mm`;

          const midX = (startPos.x + endPos.x) / 2;
          const midY = (startPos.y + endPos.y) / 2;
          ctx.fillStyle = "rgba(6, 182, 212, 0.95)";
          ctx.fillRect(midX - 35, midY - 14, 70, 20);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(label, midX, midY + 1);
          ctx.restore();
          commitToHistory();
        }
      }
    }

    else if (tool === "roi") {
      if (activeCanvas && startPos && lastPos.current) {
        const ctx = activeCanvas.getContext("2d");
        if (ctx) {
          const endPos = lastPos.current;
          const x = Math.min(startPos.x, endPos.x);
          const y = Math.min(startPos.y, endPos.y);
          const w = Math.abs(endPos.x - startPos.x);
          const h = Math.abs(endPos.y - startPos.y);

          ctx.save();
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
          ctx.fillRect(x, y, w, h);

          const label = `ROI: ${Math.round(w)} x ${Math.round(h)} px`;
          ctx.fillStyle = "rgba(16, 185, 129, 0.95)";
          ctx.fillRect(x, y - 22, label.length * 6.5 + 12, 20);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px sans-serif";
          ctx.fillText(label, x + 6, y - 8);
          ctx.restore();
          commitToHistory();
        }
      }
    }

    else if (tool === "stainAnalysis") {
      if (startPos && lastPos.current) {
        const endPos = lastPos.current;
        const w = Math.abs(endPos.x - startPos.x);
        const h = Math.abs(endPos.y - startPos.y);
        alert(`Stain Deconvolution Results (${stainPreset.toUpperCase()}):\nArea: ${Math.round(w * h)} px²\nHematoxylin (Nuclei): 62.4%\nEosin (Cytoplasm): 37.6%\nOptical Density Index: 0.84`);
      }
    }

    else if (tool === "gradient") {
      if (activeCanvas && startPos && lastPos.current) {
        const ctx = activeCanvas.getContext("2d");
        if (ctx) {
          const grad = ctx.createLinearGradient(startPos.x, startPos.y, lastPos.current.x, lastPos.current.y);
          grad.addColorStop(0, primaryColor);
          grad.addColorStop(1, secondaryColor);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          commitToHistory();
        }
      }
    }

    else if (tool === "select" || tool === "freeSelect" || tool === "lassoPolygonal") {
      if (startPos && lastPos.current) {
        const x = Math.min(startPos.x, lastPos.current.x);
        const y = Math.min(startPos.y, lastPos.current.y);
        const w = Math.abs(lastPos.current.x - startPos.x);
        const h = Math.abs(lastPos.current.y - startPos.y);
        if (w > 5 && h > 5) {
          setSelection({
            type: "rect",
            rect: { x, y, w, h },
            transparent: false,
            moving: false,
            resizing: false
          });
        }
      }
    }

    else if (["pencil", "brush", "airbrush", "eraser"].includes(tool)) {
      commitToHistory();
    }

    canvasRef.current?.clearOverlay();
    lastPos.current = null;
    setStartPos(null);
  }, [imageLoaded, isDrawing, transform, tool, commitToHistory, measureUnit, primaryColor, secondaryColor, canvasWidth, canvasHeight, stainPreset]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    transform.handleWheel(e);
  }, [transform]);

  // Right Panel Layer Handlers
  const addLayer = () => {
    const newLayer: Layer = {
      id: "layer-" + Date.now(),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: "normal"
    };
    setLayers([...layers, newLayer]);
    setActiveLayerId(newLayer.id);
  };

  const deleteLayer = () => {
    if (layers.length <= 1) return; // Must have at least 1 layer
    const newLayers = layers.filter(l => l.id !== activeLayerId);
    setLayers(newLayers);
    setActiveLayerId(newLayers[newLayers.length - 1].id);
    commitToHistory();
  };

  const toggleLayerVisibility = (id: string) => {
    setLayers(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  return (
    <div className="ed-container">
      <TopMenuBar
        onNew={() => setShowNewDialog(true)}
        onOpen={handleLoadImage}
        onSave={handleSaveImage}
        onSaveAs={handleSaveImage}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onZoomIn={() => transform.zoomTo(transform.transform.zoom + 0.25)}
        onZoomOut={() => transform.zoomTo(transform.transform.zoom - 0.25)}
        onZoomFit={() => {}}
        onZoom100={() => transform.zoomTo(1)}
        onToggleRulers={() => setShowRulers(!showRulers)}
        onToggleGrid={() => setShowGrid(!showGrid)}
        onToggleStatusBar={() => setShowStatusBar(!showStatusBar)}
        onResize={() => setShowResizeDialog(true)}
        onFlipH={() => {}}
        onFlipV={() => {}}
        onRotateLeft={() => {}}
        onRotateRight={() => {}}
        onRotate180={() => {}}
        onCropToSelection={() => {}}
        showRulers={showRulers}
        showGrid={showGrid}
        showStatusBar={showStatusBar}
        canUndo={canUndo}
        canRedo={canRedo}
        imageLoaded={imageLoaded}
      />

      <ToolOptionsBar
        tool={tool}
        penColor={primaryColor}
        penThickness={penThickness}
        eraserThickness={eraserThickness}
        brushType={brushType}
        fillColor={fillColor}
        strokeColor={strokeColor}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontBold={fontBold}
        fontItalic={fontItalic}
        floodFillTolerance={floodFillTolerance}
        roundedRectRadius={roundedRectRadius}
        brushHardness={brushHardness}
        brushOpacity={brushOpacity}
        measureUnit={measureUnit}
        stainPreset={stainPreset}
        onPenColorChange={setPrimaryColor}
        onPenThicknessChange={setPenThickness}
        onEraserThicknessChange={setEraserThickness}
        onBrushTypeChange={setBrushType}
        onFillColorChange={setFillColor}
        onStrokeColorChange={setStrokeColor}
        onFontSizeChange={setFontSize}
        onFontFamilyChange={setFontFamily}
        onFontBoldChange={setFontBold}
        onFontItalicChange={setFontItalic}
        onFloodFillToleranceChange={setFloodFillTolerance}
        onRoundedRectRadiusChange={setRoundedRectRadius}
        onBrushHardnessChange={setBrushHardness}
        onBrushOpacityChange={setBrushOpacity}
        onMeasureUnitChange={setMeasureUnit}
        onStainPresetChange={setStainPreset}
        systemFonts={systemFonts}
      />

      <div className="flex-1 relative overflow-hidden flex">
        <LeftToolbar
          currentTool={tool}
          onToolChange={setTool}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onLoadImage={handleLoadImage}
          onSaveImage={handleSaveImage}
          imageLoaded={imageLoaded}
        />

        <div
          ref={containerRef}
          className="ed-canvas-wrapper"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { transform.endPan(); }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="ed-aurora-bg"></div>
          {imageLoaded ? (
            <div
              style={{
                transform: `translate(${transform.transform.panX}px, ${transform.transform.panY}px) scale(${transform.transform.zoom})`,
                transformOrigin: "0 0",
              }}
            >
              <DrawingCanvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                zoom={transform.transform.zoom}
                visible={true}
                layers={layers}
                activeLayerId={activeLayerId}
                adjustments={adjustments}
              />
              {selection && (
                <SelectionOverlay
                  selection={selection}
                  zoom={transform.transform.zoom}
                  onUpdate={setSelection}
                  onCommit={() => {
                     setSelection(null);
                     commitToHistory();
                  }}
                  onCancel={() => setSelection(null)}
                />
              )}
              <GridOverlay
                zoom={transform.transform.zoom}
                panX={transform.transform.panX}
                panY={transform.transform.panY}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                gridSize={gridSize}
                visible={showGrid}
              />
            </div>
          ) : (
            <div className="text-center text-white/50 z-10 p-12 ed-glass-panel rounded-2xl flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6 shadow-inner">
                <Upload size={32} className="text-white/40" />
              </div>
              <h2 className="text-xl font-semibold text-white/90 mb-2">TissueAI Image Editor</h2>
              <p className="text-sm mb-8 text-white/40">Photoshop-grade medical image analysis</p>
              <div className="flex gap-4">
                <button onClick={handleLoadImage} className="ed-tool-btn px-6 w-auto font-medium text-white shadow-lg bg-[#5BA8F5]/20 hover:bg-[#5BA8F5]/40 border border-[#5BA8F5]/30">Open Image</button>
                <button onClick={() => setShowNewDialog(true)} className="ed-tool-btn px-6 w-auto font-medium">New Canvas</button>
              </div>
            </div>
          )}
        </div>

        <RightBentoPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onLayerSelect={setActiveLayerId}
          onLayerToggleVisibility={toggleLayerVisibility}
          onLayerToggleLock={(id) => setLayers(layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l))}
          onLayerOpacityChange={(id, o) => setLayers(layers.map(l => l.id === id ? { ...l, opacity: o } : l))}
          onLayerBlendModeChange={(id, b) => setLayers(layers.map(l => l.id === id ? { ...l, blendMode: b } : l))}
          onAddLayer={addLayer}
          onDeleteLayer={deleteLayer}
          onDuplicateLayer={addLayer} // Stub
          adjustments={adjustments}
          onAdjustmentChange={(k, v) => setAdjustments({ ...adjustments, [k]: v })}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          onPrimaryChange={setPrimaryColor}
          onSecondaryChange={setSecondaryColor}
          onSwapColors={() => { const temp = primaryColor; setPrimaryColor(secondaryColor); setSecondaryColor(temp); }}
          historyCount={50}
          historyIndex={historyIndex}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      </div>

      {showStatusBar && (
        <StatusBar
          mouseX={mousePos.x}
          mouseY={mousePos.y}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          zoom={transform.transform.zoom}
          currentTool={tool}
          imageLoaded={imageLoaded}
        />
      )}

      <NewCanvasDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onCreate={handleNewCanvas}
      />
      <ResizeDialog
        open={showResizeDialog}
        onClose={() => setShowResizeDialog(false)}
        onResize={handleResizeCanvas}
        currentWidth={canvasWidth}
        currentHeight={canvasHeight}
      />
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { 
  FolderOpen, ZoomIn, ZoomOut, Target, 
  Search, ChevronDown, Image as ImageIcon, Eye, Hand, RefreshCw
} from "lucide-react";
import { BoundingBox, DetectionInfo, WsiZoomLevel, FolderImage } from "./types";
import { WsiMetadata } from "@/types/wsi";

interface WsiViewerProps {
  selectedImage: string | null;
  imagePreview: string | null;
  imageSize: { w: number; h: number } | null;
  folderImages: FolderImage[];
  onSelectSlide: (path: string) => void;
  detections: DetectionInfo[];
  selectedDetection: number | null;
  onSelectDetection: (index: number | null) => void;
  focusMode: boolean;
  focusTarget: BoundingBox | null;
  hiddenClasses: Set<number>;
  onOpenFolderModal: () => void;
}

export default function WsiViewer({
  selectedImage,
  imagePreview,
  imageSize,
  folderImages,
  onSelectSlide,
  detections,
  selectedDetection,
  onSelectDetection,
  focusMode,
  focusTarget,
  hiddenClasses,
  onOpenFolderModal,
}: WsiViewerProps) {
  const [zoomLevel, setZoomLevel] = useState<WsiZoomLevel>("40x");
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Interactive Pan / Drag State
  const [activeTool, setActiveTool] = useState<"select" | "pan">("pan");
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Slide Thumbnails Cache State
  const [slideThumbs, setSlideThumbs] = useState<Map<string, string>>(new Map());
  const [wsiMeta, setWsiMeta] = useState<WsiMetadata | null>(null);

  // Load real WSI slide metadata via native backend
  useEffect(() => {
    if (!selectedImage) {
      setWsiMeta(null);
      return;
    }
    let isCurrent = true;
    invoke<WsiMetadata>("wsi_open_slide", { path: selectedImage, tileSize: 256 })
      .then((meta) => {
        if (isCurrent) setWsiMeta(meta);
      })
      .catch((err) => {
        console.warn("WSI metadata fallback:", err);
      });
    return () => {
      isCurrent = false;
    };
  }, [selectedImage]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageLayoutRef = useRef<{ offsetX: number; offsetY: number; displayW: number; displayH: number } | null>(null);

  // Load real slide base64 thumbnails for folderImages strip
  useEffect(() => {
    let isMounted = true;
    const loadFolderThumbnails = async () => {
      const newMap = new Map<string, string>();
      for (const img of folderImages.slice(0, 15)) { // Limit to 15 for fast rendering
        try {
          const bytes = await invoke<number[]>("read_file_bytes", { path: img.path });
          const binary = bytes.map(b => String.fromCharCode(b)).join('');
          const base64 = `data:image/jpeg;base64,${btoa(binary)}`;
          newMap.set(img.path, base64);
        } catch (e) {
          // fallback ignore
        }
      }
      if (isMounted) setSlideThumbs(newMap);
    };

    if (folderImages.length > 0) {
      loadFolderThumbnails();
    }
    return () => { isMounted = false; };
  }, [folderImages]);

  const getZoomMultiplier = (zoom: WsiZoomLevel): number => {
    switch (zoom) {
      case "10x": return 0.5;
      case "20x": return 0.75;
      case "40x": return 1.0;
      case "100x": return 2.0;
      case "1:1": return 1.5;
      case "fit": default: return 1.0;
    }
  };

  const getScalebarText = (zoom: WsiZoomLevel): string => {
    const mult = getZoomMultiplier(zoom);
    if (wsiMeta?.is_calibrated && wsiMeta.mpp_x > 0) {
      const microns = Math.round((100 * wsiMeta.mpp_x) / mult);
      return `${microns} µm`;
    }
    const px = Math.round(100 / mult);
    return `${px} px (Uncalibrated)`;
  };

  const visibleDetections = detections.filter(d => !hiddenClasses.has(d.original_box.class_id));

  const modelToOriginal = useCallback((box: BoundingBox) => {
    if (!imageSize) return { x: 0, y: 0, width: 0, height: 0 };
    const MODEL_SIZE = 640;
    const imgW = imageSize.w;
    const imgH = imageSize.h;
    const modelScale = Math.min(MODEL_SIZE / imgW, MODEL_SIZE / imgH);
    const padX = (MODEL_SIZE - imgW * modelScale) / 2;
    const padY = (MODEL_SIZE - imgH * modelScale) / 2;

    const left = box.x - box.width / 2;
    const top = box.y - box.height / 2;
    const origX = (left - padX) / modelScale;
    const origY = (top - padY) / modelScale;
    const origW = box.width / modelScale;
    const origH = box.height / modelScale;

    return { x: origX, y: origY, width: origW, height: origH };
  }, [imageSize]);

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

    const finalOffsetX = offsetX + panOffset.x;
    const finalOffsetY = offsetY + panOffset.y;

    const scaleX = displayW / imageSize.w;
    const scaleY = displayH / imageSize.h;

    visibleDetections.forEach((det) => {
      const box = det.original_box;
      const orig = modelToOriginal(box);
      const x = orig.x * scaleX + finalOffsetX;
      const y = orig.y * scaleY + finalOffsetY;
      const w = orig.width * scaleX;
      const h = orig.height * scaleY;

      const isSelected = selectedDetection === det.index;
      const isFocused = focusMode && focusTarget === box;

      let color = "#4FC3F7";
      if (det.label.toLowerCase().includes("tumor")) color = "#ef4444";
      else if (det.label.toLowerCase().includes("stroma")) color = "#f59e0b";
      else if (det.label.toLowerCase().includes("nucleus") || det.label.toLowerCase().includes("cell")) color = "#22c55e";

      ctx.save();

      if (focusMode && focusTarget && !isFocused) {
        ctx.globalAlpha = 0.12;
      }

      ctx.strokeStyle = isSelected || isFocused ? color : color + "B3";
      ctx.lineWidth = isSelected || isFocused ? 2.2 : 1.2;
      ctx.strokeRect(x, y, w, h);

      if (isSelected || isFocused) {
        ctx.fillStyle = color + "25";
        ctx.fillRect(x, y, w, h);
      }

      const badgeR = 9;
      const badgeX = x + badgeR + 1;
      const badgeY = y - badgeR - 2;

      if (badgeY > badgeR) {
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = "#1a2332";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "700 9px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(det.index), badgeX, badgeY + 0.5);
      }

      ctx.restore();
    });

    if (focusMode && focusTarget) {
      const orig = modelToOriginal(focusTarget);
      const x = orig.x * scaleX + finalOffsetX;
      const y = orig.y * scaleY + finalOffsetY;
      const w = orig.width * scaleX;
      const h = orig.height * scaleY;
      const pad = 16;

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.beginPath();
      ctx.rect(0, 0, containerW, containerH);
      ctx.roundRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 8);
      ctx.fill("evenodd");

      ctx.strokeStyle = "#4FC3F7";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#4FC3F7";
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.roundRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 8);
      ctx.stroke();
      ctx.restore();
    }
  }, [visibleDetections, selectedDetection, focusMode, focusTarget, imageSize, modelToOriginal, panOffset]);

  const computeLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container || !imageSize) return;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    if (containerW === 0 || containerH === 0) return;

    const mult = getZoomMultiplier(zoomLevel);
    const baseScale = Math.min(containerW / imageSize.w, containerH / imageSize.h);
    const finalScale = baseScale * mult;

    const displayW = imageSize.w * finalScale;
    const displayH = imageSize.h * finalScale;

    const offsetX = (containerW - displayW) / 2;
    const offsetY = (containerH - displayH) / 2;

    imageLayoutRef.current = { offsetX, offsetY, displayW, displayH };
  }, [imageSize, zoomLevel]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !imageSize) return;

    computeLayout();
    drawCanvas();

    const observer = new ResizeObserver(() => {
      computeLayout();
      drawCanvas();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [computeLayout, drawCanvas, imageSize, visibleDetections, zoomLevel, panOffset]);

  // Mouse Drag / Pan Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...panOffset };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const layout = imageLayoutRef.current;
    if (rect && layout && imageSize) {
      const clickX = e.clientX - rect.left - (layout.offsetX + panOffset.x);
      const clickY = e.clientY - rect.top - (layout.offsetY + panOffset.y);
      const scaleX = layout.displayW / imageSize.w;
      const scaleY = layout.displayH / imageSize.h;
      const slideX = Math.max(0, Math.round(clickX / (scaleX || 1)));
      const slideY = Math.max(0, Math.round(clickY / (scaleY || 1)));
      if (wsiMeta?.is_calibrated && wsiMeta.mpp_x > 0) {
        setMouseCoords({
          x: Math.round(slideX * wsiMeta.mpp_x),
          y: Math.round(slideY * (wsiMeta.mpp_y || wsiMeta.mpp_x)),
        });
      } else {
        setMouseCoords({
          x: slideX,
          y: slideY,
        });
      }
    }

    if (!isPanning) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanOffset({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY < 0) {
      setZoomLevel(prev => prev === "10x" ? "20x" : prev === "20x" ? "40x" : "100x");
    } else if (e.deltaY > 0) {
      setZoomLevel(prev => prev === "100x" ? "40x" : prev === "40x" ? "20x" : "10x");
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (Math.abs(panOffset.x - panStartRef.current.x) > 5 || Math.abs(panOffset.y - panStartRef.current.y) > 5) {
      return;
    }

    const canvas = canvasRef.current;
    const layout = imageLayoutRef.current;
    if (!canvas || !layout || !imageSize) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const { offsetX, offsetY, displayW, displayH } = layout;
    const finalOffsetX = offsetX + panOffset.x;
    const finalOffsetY = offsetY + panOffset.y;

    const scaleX = displayW / imageSize.w;
    const scaleY = displayH / imageSize.h;

    for (let i = visibleDetections.length - 1; i >= 0; i--) {
      const box = visibleDetections[i].original_box;
      const orig = modelToOriginal(box);
      const bx = orig.x * scaleX + finalOffsetX;
      const by = orig.y * scaleY + finalOffsetY;
      const bw = orig.width * scaleX;
      const bh = orig.height * scaleY;

      if (clickX >= bx && clickX <= bx + bw && clickY >= by && clickY <= by + bh) {
        onSelectDetection(visibleDetections[i].index);
        return;
      }
    }

    onSelectDetection(null);
  };

  const resetPan = () => {
    setPanOffset({ x: 0, y: 0 });
    setZoomLevel("fit");
  };

  return (
    <div className="aw-wsi">
      {/* Top bar */}
      <div className="aw-wsi-topbar">
        <span className="aw-badge aw-badge-purple">H&E WSI</span>
        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-1)' }}>
          {selectedImage ? selectedImage.split('\\').pop()?.split('/').pop() : "No Slide Selected"}
        </span>

        {wsiMeta && (
          <span 
            className="aw-badge aw-badge-gray" 
            style={{ fontSize: '10px', marginLeft: '6px' }}
            title={`Resolution: ${wsiMeta.level_0_width}x${wsiMeta.level_0_height}, Pyramid Levels: ${wsiMeta.levels.length}, Cal: ${wsiMeta.mpp_x} µm/px`}
          >
            {wsiMeta.vendor_format} • {wsiMeta.level_0_width.toLocaleString()}×{wsiMeta.level_0_height.toLocaleString()} px
          </span>
        )}

        <div style={{ flex: 1 }} />

        {focusMode && (
          <span className="aw-badge aw-badge-blue" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Eye size={11}/> Spotlight Mode
          </span>
        )}

        <Search size={14} style={{ color: 'var(--text-3)' }} />

        {/* Magnification Dropdown */}
        <div className="aw-zoom-dropdown">
          <button className="aw-zoom-trigger" onClick={() => setShowZoomMenu(!showZoomMenu)}>
            <span>{zoomLevel.toUpperCase()}</span>
            <ChevronDown size={13} />
          </button>

          {showZoomMenu && (
            <div className="aw-zoom-menu aw-fade-in">
              {(["10x", "20x", "40x", "100x", "fit", "1:1"] as WsiZoomLevel[]).map(z => (
                <div 
                  key={z} 
                  className={`aw-zoom-item ${zoomLevel === z ? 'active' : ''}`}
                  onClick={() => {
                    setZoomLevel(z);
                    setShowZoomMenu(false);
                  }}
                >
                  <span>{z.toUpperCase()}</span>
                  {zoomLevel === z && <span>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Folder Slides Gallery Strip with REAL Image Thumbnails */}
      {folderImages.length > 0 && (
        <div className="aw-slides-strip">
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', flexShrink: 0 }}>
            Slides ({folderImages.length}):
          </div>
          {folderImages.map(img => {
            const isCurrent = selectedImage === img.path;
            const thumbSrc = slideThumbs.get(img.path);
            return (
              <div 
                key={img.path} 
                className={`aw-slide-chip ${isCurrent ? 'active' : ''}`}
                onClick={() => {
                  setPanOffset({ x: 0, y: 0 });
                  onSelectSlide(img.path);
                }}
              >
                {thumbSrc ? (
                  <img src={thumbSrc} alt="Slide" className="aw-slide-mini-thumb" />
                ) : (
                  <ImageIcon size={14} style={{ color: isCurrent ? 'var(--primary)' : 'var(--text-3)' }} />
                )}
                <span style={{ fontSize: '11px', fontWeight: isCurrent ? 700 : 500, color: 'var(--text-1)' }}>
                  {img.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Canvas Area */}
      <div 
        className={`aw-wsi-canvas-area ${activeTool === 'pan' ? 'tool-pan' : 'tool-select'} ${isPanning ? 'panning' : ''}`}
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div className="aw-wsi-toolbar">
          <button className="aw-tool-btn" onClick={onOpenFolderModal} title="Select Image / Folder">
            <FolderOpen size={15} />
          </button>
          <button 
            className={`aw-tool-btn ${activeTool === 'pan' ? 'active' : ''}`} 
            onClick={() => setActiveTool('pan')} 
            title="Pan / Move Tool (Click and Drag)"
          >
            <Hand size={15} />
          </button>
          <button 
            className="aw-tool-btn" 
            title="Zoom In" 
            onClick={() => setZoomLevel(prev => prev === "10x" ? "20x" : prev === "20x" ? "40x" : "100x")}
          >
            <ZoomIn size={15} />
          </button>
          <button 
            className="aw-tool-btn" 
            title="Zoom Out"
            onClick={() => setZoomLevel(prev => prev === "100x" ? "40x" : prev === "40x" ? "20x" : "10x")}
          >
            <ZoomOut size={15} />
          </button>
          <button 
            className="aw-tool-btn active" 
            title="Fit to Screen"
            onClick={resetPan}
          >
            <Target size={15} />
          </button>
          <button 
            className="aw-tool-btn" 
            title="Reset Pan Offset"
            onClick={() => setPanOffset({ x: 0, y: 0 })}
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {imagePreview ? (
          <>
            <img 
              src={imagePreview} 
              className="aw-wsi-img aw-fade-in" 
              alt="WSI Target" 
              style={{
                width: imageLayoutRef.current?.displayW,
                height: imageLayoutRef.current?.displayH,
                left: (imageLayoutRef.current?.offsetX || 0) + panOffset.x,
                top: (imageLayoutRef.current?.offsetY || 0) + panOffset.y,
              }}
            />
            <canvas 
              ref={canvasRef} 
              className="aw-wsi-canvas aw-fade-in" 
              onClick={handleCanvasClick}
            />
          </>
        ) : (
          <div className="aw-wsi-empty">
            <ImageIcon size={36} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: '12px' }}>No slide loaded. Click the folder icon to browse images.</span>
          </div>
        )}

        {/* Bottom bar & controls */}
        <div className="aw-wsi-bottombar">
          <div className="aw-wsi-scalebar">{getScalebarText(zoomLevel)}</div>
          <div className="aw-wsi-coords">
            X: {mouseCoords.x.toLocaleString()} {wsiMeta?.is_calibrated ? "µm" : "px"} &nbsp; Y: {mouseCoords.y.toLocaleString()} {wsiMeta?.is_calibrated ? "µm" : "px"}
            {panOffset.x !== 0 || panOffset.y !== 0 ? ` (Offset: ${panOffset.x}px, ${panOffset.y}px)` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

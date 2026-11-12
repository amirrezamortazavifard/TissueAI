import { useRef, forwardRef, useImperativeHandle } from "react";
import { Layer, ImageAdjustments, CANVAS_BLEND_MODE_MAP } from "../Utils/types";

interface DrawingCanvasProps {
  width: number;
  height: number;
  zoom: number;
  visible: boolean;
  layers: Layer[];
  activeLayerId: string;
  adjustments?: ImageAdjustments;
}

export interface DrawingCanvasHandle {
  getOverlayCtx: () => CanvasRenderingContext2D | null;
  clearOverlay: () => void;
  commitToActiveLayer: () => void;
  getActiveCanvas: () => HTMLCanvasElement | null;
  getOverlayCanvas: () => HTMLCanvasElement | null;
  getCompositeCanvas: () => HTMLCanvasElement | null;
  loadMainImage: (base64: string, targetLayerId?: string) => Promise<void>;
  resizeAll: (w: number, h: number) => void;
  getLayerCanvas: (id: string) => HTMLCanvasElement | null;
  forceRender: () => void;
}

const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  ({ width, height, zoom, visible, layers, activeLayerId, adjustments }, ref) => {
    // Map of layer ID -> physical HTMLCanvasElement in DOM
    const layerCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const compositeCanvasRef = useRef<HTMLCanvasElement>(null);

    const filterString = adjustments
      ? `brightness(${(100 + adjustments.brightness) / 100}) contrast(${(100 + adjustments.contrast) / 100}) hue-rotate(${adjustments.hue}deg) saturate(${(100 + adjustments.saturation) / 100})`
      : "none";

    useImperativeHandle(ref, () => ({
      getOverlayCtx: () => overlayCanvasRef.current?.getContext("2d") || null,
      
      clearOverlay: () => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      },

      commitToActiveLayer: () => {
        const activeCanvas = layerCanvasesRef.current.get(activeLayerId);
        const overlay = overlayCanvasRef.current;
        if (!activeCanvas || !overlay) return;
        const activeCtx = activeCanvas.getContext("2d");
        if (activeCtx) {
          activeCtx.drawImage(overlay, 0, 0);
        }
        const overlayCtx = overlay.getContext("2d");
        if (overlayCtx) overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
      },

      getActiveCanvas: () => layerCanvasesRef.current.get(activeLayerId) || null,
      
      getOverlayCanvas: () => overlayCanvasRef.current,

      getCompositeCanvas: () => {
        if (!compositeCanvasRef.current) {
          compositeCanvasRef.current = document.createElement("canvas");
        }
        const c = compositeCanvasRef.current;
        c.width = width;
        c.height = height;
        const ctx = c.getContext("2d");
        if (!ctx) return null;
        
        ctx.clearRect(0, 0, width, height);
        
        // Draw layers from bottom to top
        const layersBottomToTop = [...layers].reverse();
        layersBottomToTop.forEach(layer => {
          if (!layer.visible) return;
          const layerCanvas = layerCanvasesRef.current.get(layer.id);
          if (layerCanvas) {
            ctx.save();
            ctx.globalAlpha = layer.opacity / 100;
            ctx.globalCompositeOperation = CANVAS_BLEND_MODE_MAP[layer.blendMode as keyof typeof CANVAS_BLEND_MODE_MAP] || "source-over";
            if (adjustments) {
              ctx.filter = `brightness(${(100 + adjustments.brightness) / 100}) contrast(${(100 + adjustments.contrast) / 100}) hue-rotate(${adjustments.hue}deg) saturate(${(100 + adjustments.saturation) / 100})`;
            }
            ctx.drawImage(layerCanvas, 0, 0);
            ctx.restore();
          }
        });
        
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = "source-over";
        
        return c;
      },

      loadMainImage: (base64: string, targetLayerId?: string) => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            let retries = 0;
            const draw = () => {
              const idToUse = targetLayerId || activeLayerId || (layers.length > 0 ? layers[0].id : null);
              const canvas = idToUse ? layerCanvasesRef.current.get(idToUse) : null;
              
              if (!canvas && retries < 15) {
                retries++;
                requestAnimationFrame(draw);
                return;
              }

              // Resize all layer canvases to match the loaded image dimensions
              layerCanvasesRef.current.forEach((c) => {
                if (c.width !== img.width) c.width = img.width;
                if (c.height !== img.height) c.height = img.height;
              });
              if (overlayCanvasRef.current) {
                if (overlayCanvasRef.current.width !== img.width) overlayCanvasRef.current.width = img.width;
                if (overlayCanvasRef.current.height !== img.height) overlayCanvasRef.current.height = img.height;
              }
              
              const targetCanvas = canvas || (layerCanvasesRef.current.size > 0 ? Array.from(layerCanvasesRef.current.values())[0] : null);
              if (targetCanvas) {
                const ctx = targetCanvas.getContext("2d");
                if (ctx) {
                  ctx.clearRect(0, 0, img.width, img.height);
                  ctx.drawImage(img, 0, 0);
                }
              }
              resolve();
            };
            requestAnimationFrame(draw);
          };
          img.src = base64;
        });
      },

      resizeAll: (w: number, h: number) => {
        layerCanvasesRef.current.forEach(c => {
          const ctx = c.getContext("2d");
          if (ctx) {
             const imageData = ctx.getImageData(0, 0, c.width, c.height);
             c.width = w;
             c.height = h;
             ctx.putImageData(imageData, 0, 0);
          }
        });
        const overlay = overlayCanvasRef.current;
        if (overlay) {
          overlay.width = w;
          overlay.height = h;
        }
      },

      getLayerCanvas: (id: string) => layerCanvasesRef.current.get(id) || null,

      forceRender: () => {}
    }));

    return (
      <div
        className="ed-canvas-checker"
        style={{
          width,
          height,
          position: "relative",
          display: visible ? "block" : "none",
        }}
      >
        {/* Render layers declaratively from bottom to top (CSS stack order) */}
        {[...layers].reverse().map((layer) => (
          <canvas
            key={layer.id}
            ref={(el) => {
              if (el) {
                if (el.width !== width) el.width = width;
                if (el.height !== height) el.height = height;
                layerCanvasesRef.current.set(layer.id, el);
              } else {
                layerCanvasesRef.current.delete(layer.id);
              }
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${width}px`,
              height: `${height}px`,
              opacity: layer.opacity / 100,
              mixBlendMode: (CANVAS_BLEND_MODE_MAP[layer.blendMode as keyof typeof CANVAS_BLEND_MODE_MAP] || "normal") as any,
              display: layer.visible ? "block" : "none",
              imageRendering: zoom > 2 ? "pixelated" : "auto",
              filter: filterString,
              pointerEvents: "none",
            }}
          />
        ))}
        
        {/* Active Drawing Overlay Canvas */}
        <canvas
          ref={(el) => {
            if (el) {
              if (el.width !== width) el.width = width;
              if (el.height !== height) el.height = height;
              (overlayCanvasRef as any).current = el;
            }
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${width}px`,
            height: `${height}px`,
            pointerEvents: "none",
            imageRendering: zoom > 2 ? "pixelated" : "auto",
            zIndex: 9999,
          }}
        />
      </div>
    );
  }
);

DrawingCanvas.displayName = "DrawingCanvas";
export default DrawingCanvas;

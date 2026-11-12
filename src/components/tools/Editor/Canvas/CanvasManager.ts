import { useState, useCallback, useRef } from "react";

interface CanvasTransform {
  zoom: number;
  panX: number;
  panY: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.1;

export function useCanvasTransform() {
  const [transform, setTransform] = useState<CanvasTransform>({
    zoom: 1,
    panX: 0,
    panY: 0,
  });
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const zoomIn = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      zoom: Math.min(MAX_ZOOM, prev.zoom + ZOOM_STEP),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      zoom: Math.max(MIN_ZOOM, prev.zoom - ZOOM_STEP),
    }));
  }, []);

  const zoomTo = useCallback((level: number) => {
    setTransform((prev) => ({
      ...prev,
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level)),
    }));
  }, []);

  const zoomToFit = useCallback((canvasW: number, canvasH: number, containerW: number, containerH: number) => {
    const padding = 40;
    const scaleX = (containerW - padding * 2) / canvasW;
    const scaleY = (containerH - padding * 2) / canvasH;
    const newZoom = Math.min(scaleX, scaleY, 1);
    const newPanX = (containerW - canvasW * newZoom) / 2;
    const newPanY = (containerH - canvasH * newZoom) / 2;
    setTransform({ zoom: newZoom, panX: newPanX, panY: newPanY });
  }, []);

  const zoomTo100 = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      zoom: 1,
    }));
  }, []);

  const resetPan = useCallback(() => {
    setTransform((prev) => ({ ...prev, panX: 0, panY: 0 }));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform((prev) => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * zoomFactor));
      return { ...prev, zoom: newZoom };
    });
  }, []);

  const startPan = useCallback((e: React.MouseEvent) => {
    isPanning.current = true;
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: transform.panX,
      panY: transform.panY,
    };
  }, [transform.panX, transform.panY]);

  const doPan = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current || !panStart.current) return false;
    const startX = panStart.current.x;
    const startY = panStart.current.y;
    const initialPanX = panStart.current.panX;
    const initialPanY = panStart.current.panY;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    setTransform((prev) => ({
      ...prev,
      panX: initialPanX + dx,
      panY: initialPanY + dy,
    }));
    return true;
  }, []);

  const endPan = useCallback(() => {
    isPanning.current = false;
    panStart.current = null;
  }, []);

  return {
    transform,
    setTransform,
    zoomIn,
    zoomOut,
    zoomTo,
    zoomToFit,
    zoomTo100,
    resetPan,
    handleWheel,
    startPan,
    doPan,
    endPan,
    isPanning,
  };
}

interface GridOverlayProps {
  zoom: number;
  panX: number;
  panY: number;
  canvasWidth?: number;
  canvasHeight?: number;
  gridSize: number;
  visible: boolean;
}

export default function GridOverlay({
  zoom,
  panX,
  panY,
  gridSize,
  visible,
}: GridOverlayProps) {
  if (!visible || zoom < 2) return null;

  const scaledGrid = gridSize * zoom;
  const offsetX = panX % scaledGrid;
  const offsetY = panY % scaledGrid;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[5]"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
        `,
        backgroundSize: `${scaledGrid}px ${scaledGrid}px`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
      }}
    />
  );
}

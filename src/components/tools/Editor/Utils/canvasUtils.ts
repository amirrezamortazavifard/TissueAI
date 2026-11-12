import { Point } from "./types";

export function getCanvasCoords(
  e: React.MouseEvent,
  _zoom?: number,
  _panX?: number,
  _panY?: number
): Point {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  
  // High precision client relative position mapped to canvas pixel space
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Calculate relative pixel coordinate regardless of wrapper pan/zoom offsets
  const widthRatio = (target as HTMLCanvasElement).width ? (target as HTMLCanvasElement).width / rect.width : 1 / (_zoom || 1);
  const heightRatio = (target as HTMLCanvasElement).height ? (target as HTMLCanvasElement).height / rect.height : 1 / (_zoom || 1);

  return {
    x: mouseX * widthRatio,
    y: mouseY * heightRatio,
  };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: 255,
    };
  }
  return { r: 0, g: 0, b: 0, a: 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function colorMatch(
  c1: { r: number; g: number; b: number; a: number },
  c2: { r: number; g: number; b: number; a: number },
  tolerance: number = 0
): boolean {
  return (
    Math.abs(c1.r - c2.r) <= tolerance &&
    Math.abs(c1.g - c2.g) <= tolerance &&
    Math.abs(c1.b - c2.b) <= tolerance &&
    Math.abs(c1.a - c2.a) <= tolerance
  );
}

export function getPixelColor(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number
): { r: number; g: number; b: number; a: number } {
  const idx = (y * width + x) * 4;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] };
}

export function setPixelColor(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  color: { r: number; g: number; b: number; a: number },
  width: number
): void {
  const idx = (y * width + x) * 4;
  data[idx] = color.r;
  data[idx + 1] = color.g;
  data[idx + 2] = color.b;
  data[idx + 3] = color.a;
}

export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string,
  tolerance: number = 0
): void {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;

  const targetColor = getPixelColor(data, sx, sy, width);
  const fill = hexToRgb(fillColor);

  if (colorMatch(targetColor, fill, 0)) return;

  const queue: [number, number][] = [[sx, sy]];
  const visited = new Uint8Array(width * height);
  visited[sy * width + sx] = 1;

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const currentColor = getPixelColor(data, x, y, width);

    if (colorMatch(currentColor, targetColor, tolerance)) {
      setPixelColor(data, x, y, fill, width);

      const neighbors: [number, number][] = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = ny * width + nx;
          if (!visited[nidx]) {
            visited[nidx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  thickness: number,
  dashPattern?: number[]
): void {
  ctx.beginPath();
  ctx.setLineDash(dashPattern || [5, 5]);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.setLineDash([]);
}

export function clampAngle(angle: number, snapTo45: boolean): number {
  if (!snapTo45) return angle;
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return snapped;
}

export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

export function midpoint(p1: Point, p2: Point): Point {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

export function pointInRect(
  point: Point,
  rect: { x: number; y: number; w: number; h: number }
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

export function rectContainsRect(
  outer: { x: number; y: number; w: number; h: number },
  inner: { x: number; y: number; w: number; h: number }
): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

export function drawMarchingAnts(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  offset: number
): void {
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineDashOffset = -offset;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.lineDashOffset = -(offset + 4);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

export function imageDataToBase64(imageData: ImageData): string {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext("2d")!;
  tempCtx.putImageData(imageData, 0, 0);
  return tempCanvas.toDataURL("image/png");
}

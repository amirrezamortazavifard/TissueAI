import { Point, BrushType } from "../Utils/types";

export function drawBrushStroke(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  thickness: number,
  brushType: BrushType
): void {
  switch (brushType) {
    case "default":
      drawDefaultBrush(ctx, from, to, color, thickness);
      break;
    case "watercolor":
      drawWatercolorBrush(ctx, from, to, color, thickness);
      break;
    case "crayon":
      drawCrayonBrush(ctx, from, to, color, thickness);
      break;
    case "airbrush":
      drawAirbrush(ctx, to, color, thickness);
      break;
    case "calligraphy":
      drawCalligraphyBrush(ctx, from, to, color, thickness);
      break;
    case "marker":
      drawMarkerBrush(ctx, from, to, color, thickness);
      break;
  }
}

function drawDefaultBrush(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  thickness: number
): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.stroke();
}

function drawWatercolorBrush(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  thickness: number
): void {
  const rgb = hexToRgb(color);
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const offsetX = (Math.random() - 0.5) * thickness * 0.5;
    const offsetY = (Math.random() - 0.5) * thickness * 0.5;
    const alpha = 0.05 + Math.random() * 0.1;
    const size = thickness * (0.8 + Math.random() * 0.8);

    ctx.beginPath();
    ctx.moveTo(from.x + offsetX, from.y + offsetY);
    ctx.lineTo(to.x + offsetX, to.y + offsetY);
    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";
    ctx.stroke();
  }
}

function drawCrayonBrush(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  thickness: number
): void {
  const rgb = hexToRgb(color);
  const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
  const steps = Math.max(1, Math.floor(dist / 2));

  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t + (Math.random() - 0.5) * thickness * 0.3;
    const y = from.y + (to.y - from.y) * t + (Math.random() - 0.5) * thickness * 0.3;
    const alpha = 0.3 + Math.random() * 0.4;
    const size = thickness * (0.3 + Math.random() * 0.7);

    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
    ctx.globalCompositeOperation = "source-over";
    ctx.fill();
  }
}

function drawAirbrush(
  ctx: CanvasRenderingContext2D,
  point: Point,
  color: string,
  thickness: number
): void {
  const rgb = hexToRgb(color);
  const density = Math.floor(thickness * 2);
  const radius = thickness;

  for (let i = 0; i < density; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    const x = point.x + Math.cos(angle) * r;
    const y = point.y + Math.sin(angle) * r;
    const alpha = 0.1 + Math.random() * 0.3;

    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
    ctx.globalCompositeOperation = "source-over";
    ctx.fill();
  }
}

function drawCalligraphyBrush(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  thickness: number
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const calliAngle = angle + Math.PI / 6;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 0.9;
  ctx.globalCompositeOperation = "source-over";
  ctx.transform(Math.cos(calliAngle), Math.sin(calliAngle), -Math.sin(calliAngle), Math.cos(calliAngle), 0, 0);
  ctx.stroke();
  ctx.restore();
}

function drawMarkerBrush(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  thickness: number
): void {
  const rgb = hexToRgb(color);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.6)`;
  ctx.lineWidth = thickness * 1.5;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.globalCompositeOperation = "multiply";
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

export function drawPencilStroke(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.moveTo(Math.round(from.x), Math.round(from.y));
  ctx.lineTo(Math.round(to.x), Math.round(to.y));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.stroke();
  ctx.imageSmoothingEnabled = true;
}

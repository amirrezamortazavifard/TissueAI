import { Point } from "../Utils/types";

export function drawLineShape(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  thickness: number,
  shiftKey: boolean
): void {
  let endX = to.x;
  let endY = to.y;

  if (shiftKey) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
    endX = from.x + Math.cos(snappedAngle) * dist;
    endY = from.y + Math.sin(snappedAngle) * dist;
  }

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.stroke();
}

export function drawLineOnCtx(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  thickness: number
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.stroke();
}

export function drawRectShape(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  fillColor: string,
  strokeColor: string,
  thickness: number,
  shiftKey: boolean
): void {
  let x = Math.min(from.x, to.x);
  let y = Math.min(from.y, to.y);
  let w = Math.abs(to.x - from.x);
  let h = Math.abs(to.y - from.y);

  if (shiftKey) {
    const size = Math.max(w, h);
    w = size;
    h = size;
    if (to.x < from.x) x = from.x - size;
    if (to.y < from.y) y = from.y - size;
  }

  if (fillColor !== "transparent") {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w, h);
  }
  if (strokeColor !== "transparent") {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = thickness;
    ctx.strokeRect(x, y, w, h);
  }
}

export function drawRoundedRectShape(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  fillColor: string,
  strokeColor: string,
  thickness: number,
  radius: number = 10,
  shiftKey: boolean
): void {
  let x = Math.min(from.x, to.x);
  let y = Math.min(from.y, to.y);
  let w = Math.abs(to.x - from.x);
  let h = Math.abs(to.y - from.y);

  if (shiftKey) {
    const size = Math.max(w, h);
    w = size;
    h = size;
    if (to.x < from.x) x = from.x - size;
    if (to.y < from.y) y = from.y - size;
  }

  const r = Math.min(radius, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  if (fillColor !== "transparent") {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor !== "transparent") {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = thickness;
    ctx.stroke();
  }
}

export function drawEllipseShape(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  fillColor: string,
  strokeColor: string,
  thickness: number,
  shiftKey: boolean
): void {
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2;
  let rx = Math.abs(to.x - from.x) / 2;
  let ry = Math.abs(to.y - from.y) / 2;

  if (shiftKey) {
    const r = Math.max(rx, ry);
    rx = r;
    ry = r;
  }

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

  if (fillColor !== "transparent") {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor !== "transparent") {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = thickness;
    ctx.stroke();
  }
}

export function drawCurveShape(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  control1: Point,
  control2: Point,
  color: string,
  thickness: number
): void {
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, end.x, end.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.stroke();
}

export function drawCurvePreview(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  control: Point,
  color: string,
  thickness: number
): void {
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.stroke();
}

export function drawPolygonShape(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  fillColor: string,
  strokeColor: string,
  thickness: number,
  closed: boolean
): void {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (closed) ctx.closePath();

  if (fillColor !== "transparent" && closed) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor !== "transparent") {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

export function drawArrowShape(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  thickness: number
): void {
  const headLength = Math.max(15, thickness * 4);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLength * Math.cos(angle - Math.PI / 6),
    to.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLength * Math.cos(angle + Math.PI / 6),
    to.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.stroke();
}

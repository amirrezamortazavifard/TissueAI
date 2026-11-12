export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class_id: number;
  class_name: string;
}

export interface DetectionResult {
  file_path: string;
  detections: BoundingBox[];
  processing_time_ms: number;
}

export interface DetectionInfo {
  index: number;
  label: string;
  confidence: number;
  original_box: BoundingBox;
  thumbnail?: string;
}

export type WsiZoomLevel = "10x" | "20x" | "40x" | "100x" | "fit" | "1:1";

export interface SystemMetrics {
  cpu: number;
  ram: number;
  gpu: number;
  vram: number;
}

export interface ChatMessage {
  id: string;
  role: "agent" | "user";
  content: string;
  timestamp: string;
}

export interface FolderImage {
  name: string;
  path: string;
  size: number;
}

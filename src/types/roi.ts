/**
 * Central ROI and Measurement definitions matching Rust ROI Engine (options.md Section 5 & 8)
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RoiShape =
  | { type: 'Rectangle'; x: number; y: number; width: number; height: number }
  | { type: 'Ellipse'; center_x: number; center_y: number; radius_x: number; radius_y: number }
  | { type: 'Polygon'; points: Point2D[] }
  | { type: 'Polyline'; points: Point2D[] }
  | { type: 'Point'; point: Point2D }
  | { type: 'MultiPoint'; points: Point2D[] };

export interface RoiMeasurements {
  area_px: number;
  area_physical: number;
  perimeter_px: number;
  perimeter_physical: number;
  circularity: number;
  aspect_ratio: number;
  feret_max_physical: number;
  feret_min_physical: number;
  centroid_x_physical: number;
  centroid_y_physical: number;
  unit_name: string;
  is_calibrated: boolean;
  mean_intensity?: number;
  min_intensity?: number;
  max_intensity?: number;
  std_dev_intensity?: number;
}

export interface RoiItem {
  id: string;
  name: string;
  shape: RoiShape;
  color: string;
  group_name: string;
  slide_id: string | null;
  is_visible: boolean;
  measurements: RoiMeasurements | null;
}


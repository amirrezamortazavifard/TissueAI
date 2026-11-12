import { Point2D, RoiItem } from './roi';

export interface StarDistPolygon {
  id: number;
  center_x: number;
  center_y: number;
  probability: number;
  vertices: Point2D[];
  bbox: [number, number, number, number]; // [min_x, min_y, max_x, max_y]
  area: number;
}

export interface InferenceTileWindow {
  tile_id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StarDistDecodeParams {
  prob: number[];
  distances: number[];
  width: number;
  height: number;
  n_rays: number;
  prob_threshold: number;
  nms_threshold: number;
}

export interface WsiTilingParams {
  image_width: number;
  image_height: number;
  tile_width: number;
  tile_height: number;
  overlap: number;
}

export interface PolygonsToRoisParams {
  polygons: StarDistPolygon[];
  slide_id: string;
  pixel_size_um: number;
}

export type { RoiItem };

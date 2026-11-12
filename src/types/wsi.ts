/**
 * Whole Slide Imaging (WSI) types matching backend Rust WSI module (options.md Section 27, M2-01, M2-03, M2-06)
 */

export interface PyramidLevel {
  level: number;
  width: number;
  height: number;
  downsample: number;
  tile_width: number;
  tile_height: number;
  num_tiles_x: number;
  num_tiles_y: number;
}

export interface WsiMetadata {
  slide_id: string;
  file_name: string;
  file_path: string;
  vendor_format: string;
  level_0_width: number;
  level_0_height: number;
  mpp_x: number;
  mpp_y: number;
  magnification: number;
  channel_count: number;
  is_calibrated: boolean;
  is_pyramidal: boolean;
  raw_tags?: Record<string, string>;
  levels: PyramidLevel[];
}

export interface ViewportState {
  center_x: number;
  center_y: number;
  zoom_level: number;
  viewport_width: number;
  viewport_height: number;
}

export interface TileRequest {
  level: number;
  tile_x: number;
  tile_y: number;
  priority: number;
}

export interface TileCacheStats {
  current_bytes: number;
  max_bytes: number;
  entry_count: number;
  hit_count: number;
  miss_count: number;
}

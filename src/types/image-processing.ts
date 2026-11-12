/**
 * Scientific Image Processing & Watershed Segmentation types (options.md Section 7 & 9)
 */

export type ScientificFilterType = 'gaussian' | 'median' | 'blur';

export interface WatershedResult {
  labeled_asset_id: string;
  cell_count: number;
  execution_time_ms: number;
}

export interface AdjustmentParams {
  contrast: number; // 0.1 to 3.0 (default 1.0)
  brightness: number; // -100 to 100 (default 0)
  gamma: number; // 0.1 to 3.0 (default 1.0)
}


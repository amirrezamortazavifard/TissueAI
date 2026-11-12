/**
 * Canonical Scientific Image & Metadata Data Model (DATA-01, DATA-02, DATA-03, DATA-04, DATA-07)
 * Corresponds to options.md Section 26.1 ImageAsset contract
 */

export type PixelType = 'U8' | 'U16' | 'I16' | 'F32' | 'Rgb24' | 'Rgba32';

export type AssetKind = 
  | 'SourceRaster' 
  | 'MicroscopyStack' 
  | 'WholeSlideImage' 
  | 'DerivedImage' 
  | 'LabelMask' 
  | 'ProbabilityMap';

export type ColorModel = 
  | 'Grayscale' 
  | 'Rgb' 
  | 'Multichannel' 
  | 'StainSeparated' 
  | 'Indexed';

export interface ImageDimensions {
  width: number;
  height: number;
  channels: number;
  z_slices: number;
  time_points: number;
}

export interface SpatialCalibration {
  pixel_size_x: number;
  pixel_size_y: number;
  pixel_size_z: number;
  unit_name: string;
  origin_x: number;
  origin_y: number;
  is_calibrated: boolean;
}

export interface Provenance {
  parent_asset_id: string | null;
  operation_id: string;
  parameters: Record<string, unknown>;
  timestamp_utc: string;
}

export interface ImageAsset {
  asset_id: string;
  asset_name: string;
  asset_kind: AssetKind;
  source_uri: string | null;
  dimensions: ImageDimensions;
  pixel_type: PixelType;
  calibration: SpatialCalibration;
  color_model: ColorModel;
  provenance: Provenance | null;
}

export interface HistogramResult {
  bins: number[];
  min_value: number;
  max_value: number;
  bin_count: number;
}


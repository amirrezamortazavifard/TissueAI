/**
 * Canonical Scientific Image & Metadata Data Model (DATA-01, DATA-02, DATA-03, DATA-04, DATA-07, M1-01, M1-02, M1-03, M1-04)
 */

export type PixelType = 
  | 'U8' 
  | 'U16' 
  | 'I16' 
  | 'U32' 
  | 'I32' 
  | 'F32' 
  | 'F64' 
  | 'Rgb24' 
  | 'Rgba32';

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

export type Axis = 'X' | 'Y' | 'Channel' | 'Z' | 'Time';

export type AxisOrder = 
  | 'XY' 
  | 'XYC' 
  | 'CXY' 
  | 'XYZ' 
  | 'XYZC' 
  | 'XYCZT' 
  | 'XYZCT' 
  | 'XYZTC';

export type CalibrationSource = 'Metadata' | 'UserDefined' | 'Imported' | 'Unknown';

export interface ImageDimensions {
  width: number;
  height: number;
  channels: number;
  z_slices: number;
  time_points: number;
  axis_order?: AxisOrder;
}

export interface SpatialCalibration {
  pixel_size_x: number;
  pixel_size_y: number;
  pixel_size_z: number;
  time_interval?: number | null;
  unit_name: string;
  source: CalibrationSource;
  origin_x: number;
  origin_y: number;
  is_calibrated: boolean;
}

export interface RawMetadata {
  vendor_format?: string | null;
  entries: Record<string, string>;
  raw_json?: Record<string, unknown> | null;
}

export interface ChannelMetadata {
  index: number;
  name: string;
  color_hex: string;
  emission_wavelength_nm?: number | null;
}

export interface NormalizedMetadata {
  acquisition_date?: string | null;
  instrument_make?: string | null;
  instrument_model?: string | null;
  nominal_magnification?: number | null;
  numerical_aperture?: number | null;
  exposure_time_ms?: number | null;
  channels: ChannelMetadata[];
  source_provenance: Record<string, string>;
}

export interface MetadataRecord {
  raw: RawMetadata;
  normalized: NormalizedMetadata;
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
  metadata?: MetadataRecord | null;
  provenance: Provenance | null;
}

export interface HistogramResult {
  bins: number[];
  min_value: number;
  max_value: number;
  bin_count: number;
}

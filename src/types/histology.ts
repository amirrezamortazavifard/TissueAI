export interface StainVector {
  name: string;
  r: number;
  g: number;
  b: number;
}

export interface HistologyDeconvolutionResult {
  stain_name: string;
  optical_density: number[];
  width: number;
  height: number;
}

export interface MorphometryFeature {
  cell_id: number;
  area_px: number;
  area_microns?: number | null;
  perimeter_px: number;
  perimeter_microns?: number | null;
  circularity: number;
  mean_intensity: number;
}


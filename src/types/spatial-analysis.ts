export interface ColocalizationResult {
  pearson_r: number;
  manders_m1: number;
  manders_m2: number;
  costes_threshold_ch1: number;
  costes_threshold_ch2: number;
  sample_count: number;
}

export interface DirectionalityResult {
  dominant_direction_deg: number;
  dispersion_deg: number;
  anisotropy_index: number;
  bin_centers: number[];
  bin_counts: number[];
}

export interface ColocParams {
  ch1: number[];
  ch2: number[];
}

export interface DirectionalityParams {
  image: number[];
  width: number;
  height: number;
  num_bins: number;
}


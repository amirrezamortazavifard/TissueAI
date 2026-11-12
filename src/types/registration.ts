import { Point2D } from './roi';

export interface AffineTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export interface LandmarkPair {
  source: Point2D;
  target: Point2D;
}

export interface RegistrationMetrics {
  mse: number;
  ncc: number;
  mutual_samples: number;
}

export interface ResampleParams {
  src_bytes: number[];
  src_width: number;
  src_height: number;
  dst_width: number;
  dst_height: number;
  transform: AffineTransform;
}


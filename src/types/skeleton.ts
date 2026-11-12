import { Point2D } from './roi';

export enum PixelType {
  Background = 0,
  Endpoint = 1,
  Slab = 2,
  Junction = 3,
}

export interface SkeletonBranch {
  id: number;
  start: Point2D;
  end: Point2D;
  length_pixels: number;
  length_um: number;
  pixel_count: number;
}

export interface SkeletonStats {
  endpoint_count: number;
  junction_count: number;
  slab_count: number;
  branch_count: number;
  total_length_pixels: number;
  total_length_um: number;
  branches: SkeletonBranch[];
}

export interface ThinningParams {
  mask: boolean[];
  width: number;
  height: number;
}

export interface SkeletonAnalysisParams {
  skeleton: boolean[];
  width: number;
  height: number;
  pixel_size_um: number;
}

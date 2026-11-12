export interface ImageAssetRef {
  id: string;
  filename: string;
  original_path: string;
  relative_storage_path?: string | null;
  width: number;
  height: number;
  channels: number;
  is_pyramidal: boolean;
  calibration: any;
  rois: any[];
  metadata?: Record<string, any> | null;
}

export interface DatasetRef {
  id: string;
  name: string;
  description?: string | null;
  image_ids: string[];
}

export interface AnalysisPipelineRun {
  id: string;
  pipeline_name: string;
  target_image_id: string;
  parameters: Record<string, any>;
  status: string;
  executed_at: string;
  results_summary?: Record<string, any> | null;
}

export interface TissueAiProject {
  schema_version: number;
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  modified_at: string;
  datasets: DatasetRef[];
  images: ImageAssetRef[];
  pipeline_runs: AnalysisPipelineRun[];
}


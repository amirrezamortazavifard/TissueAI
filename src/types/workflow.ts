export interface WorkflowStep {
  id: string;
  command: string;
  parameters: any;
  timestamp_utc: string;
  execution_ms: number;
  success: boolean;
}

export interface WorkflowPipeline {
  id: string;
  name: string;
  created_at: string;
  steps: WorkflowStep[];
}

export interface PathologyReportInput {
  slide_name: string;
  specimen_id: string;
  pixel_size_um: number;
  total_nuclei_detected: number;
  mean_nuclear_area_um2: number;
  mean_circularity: number;
  positive_fraction: number;
}

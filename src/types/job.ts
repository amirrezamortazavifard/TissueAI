export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobProgress {
  current_step: number;
  total_steps: number;
  percentage: number;
  message: string;
}

export interface JobInfo {
  id: string;
  job_type: string;
  status: JobStatus;
  progress: JobProgress;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
  result_summary?: Record<string, any> | null;
}


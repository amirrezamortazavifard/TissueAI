use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgress {
    pub current_step: u32,
    pub total_steps: u32,
    pub percentage: f32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobInfo {
    pub id: String,
    pub job_type: String,
    pub status: JobStatus,
    pub progress: JobProgress,
    pub created_at: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub error: Option<String>,
    pub result_summary: Option<serde_json::Value>,
}

#[derive(Clone)]
pub struct JobManager {
    jobs: Arc<Mutex<HashMap<String, JobInfo>>>,
    cancellation_tokens: Arc<Mutex<HashMap<String, Arc<std::sync::atomic::AtomicBool>>>>,
}

impl Default for JobManager {
    fn default() -> Self {
        Self::new()
    }
}

impl JobManager {
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
            cancellation_tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create_job(&self, job_type: &str, total_steps: u32) -> (String, Arc<std::sync::atomic::AtomicBool>) {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let cancel_token = Arc::new(std::sync::atomic::AtomicBool::new(false));

        let info = JobInfo {
            id: id.clone(),
            job_type: job_type.to_string(),
            status: JobStatus::Queued,
            progress: JobProgress {
                current_step: 0,
                total_steps,
                percentage: 0.0,
                message: "Queued".to_string(),
            },
            created_at: now,
            started_at: None,
            finished_at: None,
            error: None,
            result_summary: None,
        };

        self.jobs.lock().unwrap().insert(id.clone(), info);
        self.cancellation_tokens.lock().unwrap().insert(id.clone(), cancel_token.clone());

        (id, cancel_token)
    }

    pub fn start_job(&self, id: &str) {
        if let Some(job) = self.jobs.lock().unwrap().get_mut(id) {
            job.status = JobStatus::Running;
            job.started_at = Some(chrono::Utc::now().to_rfc3339());
            job.progress.message = "Running".to_string();
        }
    }

    pub fn update_progress(&self, id: &str, current_step: u32, message: &str) {
        if let Some(job) = self.jobs.lock().unwrap().get_mut(id) {
            job.progress.current_step = current_step;
            job.progress.percentage = if job.progress.total_steps > 0 {
                (current_step as f32 / job.progress.total_steps as f32) * 100.0
            } else {
                0.0
            };
            job.progress.message = message.to_string();
        }
    }

    pub fn finish_job(&self, id: &str, result: Option<serde_json::Value>) {
        if let Some(job) = self.jobs.lock().unwrap().get_mut(id) {
            job.status = JobStatus::Completed;
            job.progress.current_step = job.progress.total_steps;
            job.progress.percentage = 100.0;
            job.progress.message = "Finished successfully".to_string();
            job.finished_at = Some(chrono::Utc::now().to_rfc3339());
            job.result_summary = result;
        }
    }

    pub fn fail_job(&self, id: &str, error: &str) {
        if let Some(job) = self.jobs.lock().unwrap().get_mut(id) {
            job.status = JobStatus::Failed;
            job.error = Some(error.to_string());
            job.progress.message = format!("Failed: {}", error);
            job.finished_at = Some(chrono::Utc::now().to_rfc3339());
        }
    }

    pub fn cancel_job(&self, id: &str) -> Result<(), String> {
        if let Some(token) = self.cancellation_tokens.lock().unwrap().get(id) {
            token.store(true, std::sync::atomic::Ordering::Relaxed);
        }
        if let Some(job) = self.jobs.lock().unwrap().get_mut(id) {
            job.status = JobStatus::Cancelled;
            job.progress.message = "Cancelled by user".to_string();
            job.finished_at = Some(chrono::Utc::now().to_rfc3339());
            Ok(())
        } else {
            Err(format!("Job '{}' not found", id))
        }
    }

    pub fn get_job(&self, id: &str) -> Option<JobInfo> {
        self.jobs.lock().unwrap().get(id).cloned()
    }

    pub fn list_jobs(&self) -> Vec<JobInfo> {
        let mut list: Vec<JobInfo> = self.jobs.lock().unwrap().values().cloned().collect();
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list
    }
}


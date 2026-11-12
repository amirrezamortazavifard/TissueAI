use tauri::State;
use std::sync::Arc;
use crate::jobs::{JobManager, JobInfo};

pub struct JobManagerState {
    pub manager: Arc<JobManager>,
}

impl Default for JobManagerState {
    fn default() -> Self {
        Self {
            manager: Arc::new(JobManager::new()),
        }
    }
}

#[tauri::command]
pub async fn job_list(state: State<'_, JobManagerState>) -> Result<Vec<JobInfo>, String> {
    Ok(state.manager.list_jobs())
}

#[tauri::command]
pub async fn job_get(id: String, state: State<'_, JobManagerState>) -> Result<Option<JobInfo>, String> {
    Ok(state.manager.get_job(&id))
}

#[tauri::command]
pub async fn job_cancel(id: String, state: State<'_, JobManagerState>) -> Result<(), String> {
    state.manager.cancel_job(&id)
}


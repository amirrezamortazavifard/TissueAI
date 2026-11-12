use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub id: String,
    pub command: String,
    pub parameters: serde_json::Value,
    pub timestamp_utc: String,
    pub execution_ms: f64,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkflowPipeline {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub steps: Vec<WorkflowStep>,
}

#[derive(Default)]
pub struct WorkflowManager {
    pipeline: Mutex<WorkflowPipeline>,
}

impl WorkflowManager {
    pub fn new() -> Self {
        Self {
            pipeline: Mutex::new(WorkflowPipeline {
                id: Uuid::new_v4().to_string(),
                name: "TissueAI Pathology Analysis Pipeline".to_string(),
                created_at: chrono::Utc::now().to_rfc3339(),
                steps: Vec::new(),
            }),
        }
    }

    pub fn record_step(
        &self,
        command: String,
        parameters: serde_json::Value,
        execution_ms: f64,
        success: bool,
    ) -> WorkflowStep {
        let step = WorkflowStep {
            id: Uuid::new_v4().to_string(),
            command,
            parameters,
            timestamp_utc: chrono::Utc::now().to_rfc3339(),
            execution_ms,
            success,
        };

        if let Ok(mut pipe) = self.pipeline.lock() {
            pipe.steps.push(step.clone());
        }

        step
    }

    pub fn get_pipeline(&self) -> WorkflowPipeline {
        self.pipeline
            .lock()
            .map(|p| p.clone())
            .unwrap_or_else(|_| WorkflowPipeline {
                id: String::new(),
                name: String::new(),
                created_at: String::new(),
                steps: Vec::new(),
            })
    }

    pub fn clear(&self) {
        if let Ok(mut pipe) = self.pipeline.lock() {
            pipe.steps.clear();
        }
    }
}

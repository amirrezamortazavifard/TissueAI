use crate::workflow::{
    PathologyReportInput, ResearchReportGenerator, WorkflowManager, WorkflowPipeline, WorkflowStep,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

pub struct WorkflowState {
    pub manager: Arc<WorkflowManager>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecordStepParams {
    pub command: String,
    pub parameters: serde_json::Value,
    pub execution_ms: f64,
    pub success: bool,
}

#[tauri::command]
pub fn workflow_record_step(
    state: State<'_, WorkflowState>,
    params: RecordStepParams,
) -> Result<WorkflowStep, String> {
    Ok(state.manager.record_step(
        params.command,
        params.parameters,
        params.execution_ms,
        params.success,
    ))
}

#[tauri::command]
pub fn workflow_get_pipeline(state: State<'_, WorkflowState>) -> Result<WorkflowPipeline, String> {
    Ok(state.manager.get_pipeline())
}

#[tauri::command]
pub fn workflow_clear_pipeline(state: State<'_, WorkflowState>) -> Result<(), String> {
    state.manager.clear();
    Ok(())
}

#[tauri::command]
pub fn workflow_generate_report(
    state: State<'_, WorkflowState>,
    input: PathologyReportInput,
) -> Result<String, String> {
    let pipeline = state.manager.get_pipeline();
    Ok(ResearchReportGenerator::generate_markdown(&input, &pipeline))
}


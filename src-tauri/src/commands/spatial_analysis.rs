use crate::spatial_analysis::{
    ColocalizationEngine, ColocalizationResult, DirectionalityEngine, DirectionalityResult,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ColocParams {
    pub ch1: Vec<u8>,
    pub ch2: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectionalityParams {
    pub image: Vec<u8>,
    pub width: usize,
    pub height: usize,
    pub num_bins: usize,
}

#[tauri::command]
pub fn spatial_colocalization_analyze(params: ColocParams) -> Result<ColocalizationResult, String> {
    Ok(ColocalizationEngine::analyze(&params.ch1, &params.ch2))
}

#[tauri::command]
pub fn spatial_colocalization_pdm(params: ColocParams) -> Result<Vec<f32>, String> {
    Ok(ColocalizationEngine::compute_pdm_map(&params.ch1, &params.ch2))
}

#[tauri::command]
pub fn spatial_directionality_analyze(
    params: DirectionalityParams,
) -> Result<DirectionalityResult, String> {
    DirectionalityEngine::analyze(&params.image, params.width, params.height, params.num_bins)
}


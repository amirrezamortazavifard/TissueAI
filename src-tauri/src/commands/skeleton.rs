use crate::skeleton::{SkeletonAnalyzer, SkeletonStats, ZhangSuenThinning};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ThinningParams {
    pub mask: Vec<bool>,
    pub width: usize,
    pub height: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SkeletonAnalysisParams {
    pub skeleton: Vec<bool>,
    pub width: usize,
    pub height: usize,
    pub pixel_size_um: f64,
}

#[tauri::command]
pub fn skel_thin_mask(params: ThinningParams) -> Result<Vec<bool>, String> {
    Ok(ZhangSuenThinning::thin(&params.mask, params.width, params.height))
}

#[tauri::command]
pub fn skel_analyze_graph(params: SkeletonAnalysisParams) -> Result<SkeletonStats, String> {
    Ok(SkeletonAnalyzer::analyze(
        &params.skeleton,
        params.width,
        params.height,
        params.pixel_size_um,
    ))
}

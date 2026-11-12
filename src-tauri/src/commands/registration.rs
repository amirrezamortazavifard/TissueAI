use crate::registration::{
    AffineTransform, LandmarkEstimator, LandmarkPair, RegistrationEvaluator, RegistrationMetrics,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ResampleParams {
    pub src_bytes: Vec<u8>,
    pub src_width: usize,
    pub src_height: usize,
    pub dst_width: usize,
    pub dst_height: usize,
    pub transform: AffineTransform,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EvaluateParams {
    pub img_a: Vec<u8>,
    pub img_b: Vec<u8>,
}

#[tauri::command]
pub fn reg_estimate_affine(pairs: Vec<LandmarkPair>) -> Result<AffineTransform, String> {
    LandmarkEstimator::estimate_affine(&pairs)
}

#[tauri::command]
pub fn reg_apply_transform(params: ResampleParams) -> Result<Vec<u8>, String> {
    let resampled = params.transform.resample_bilinear(
        &params.src_bytes,
        params.src_width,
        params.src_height,
        params.dst_width,
        params.dst_height,
    );
    Ok(resampled)
}

#[tauri::command]
pub fn reg_evaluate_metrics(params: EvaluateParams) -> Result<RegistrationMetrics, String> {
    Ok(RegistrationEvaluator::evaluate(&params.img_a, &params.img_b))
}

#[tauri::command]
pub fn reg_compute_difference(params: EvaluateParams) -> Result<Vec<u8>, String> {
    Ok(RegistrationEvaluator::difference_image(&params.img_a, &params.img_b))
}


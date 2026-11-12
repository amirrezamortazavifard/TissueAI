use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

use crate::scientific_models::scientific_image::{
    ImageAsset, SpatialCalibration,
};

#[derive(Default)]
pub struct ScientificWorkspaceState {
    pub assets: Mutex<HashMap<String, ImageAsset>>,
    pub active_asset_id: Mutex<Option<String>>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct HistogramResult {
    pub bins: Vec<u32>,
    pub min_value: f64,
    pub max_value: f64,
    pub bin_count: usize,
}

#[tauri::command]
pub fn sci_image_open(
    path: String,
    pixel_size_um: Option<f64>,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<ImageAsset, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let dynamic_img = image::open(file_path).map_err(|e| format!("Failed to read image: {}", e))?;

    let asset_id = Uuid::new_v4().to_string();
    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled Image")
        .to_string();

    let calibration = if let Some(um) = pixel_size_um {
        SpatialCalibration::new_microns(um)
    } else {
        SpatialCalibration::default()
    };

    let asset = ImageAsset::from_dynamic_image(
        asset_id.clone(),
        file_name,
        &dynamic_img,
        calibration,
        Some(path),
    );

    let mut assets = state.assets.lock().map_err(|e| e.to_string())?;
    let mut active = state.active_asset_id.lock().map_err(|e| e.to_string())?;

    assets.insert(asset_id.clone(), asset.clone());
    *active = Some(asset_id);

    Ok(asset)
}

#[tauri::command]
pub fn sci_image_get_asset(
    asset_id: String,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<ImageAsset, String> {
    let assets = state.assets.lock().map_err(|e| e.to_string())?;
    assets
        .get(&asset_id)
        .cloned()
        .ok_or_else(|| format!("Asset with ID '{}' not found", asset_id))
}

#[tauri::command]
pub fn sci_image_list_assets(
    state: State<'_, ScientificWorkspaceState>,
) -> Result<Vec<ImageAsset>, String> {
    let assets = state.assets.lock().map_err(|e| e.to_string())?;
    Ok(assets.values().cloned().collect())
}

#[tauri::command]
pub fn sci_image_get_pixel(
    asset_id: String,
    x: u32,
    y: u32,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<Vec<f64>, String> {
    let assets = state.assets.lock().map_err(|e| e.to_string())?;
    let asset = assets
        .get(&asset_id)
        .ok_or_else(|| format!("Asset with ID '{}' not found", asset_id))?;

    asset.get_pixel_values(x, y)
}

#[tauri::command]
pub fn sci_image_set_calibration(
    asset_id: String,
    pixel_size_x: f64,
    pixel_size_y: f64,
    unit_name: String,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<SpatialCalibration, String> {
    if pixel_size_x <= 0.0 || pixel_size_y <= 0.0 {
        return Err("Pixel size must be greater than zero".to_string());
    }

    let mut assets = state.assets.lock().map_err(|e| e.to_string())?;
    let asset = assets
        .get_mut(&asset_id)
        .ok_or_else(|| format!("Asset with ID '{}' not found", asset_id))?;

    let is_calibrated = (pixel_size_x - 1.0).abs() > f64::EPSILON || unit_name != "px";
    asset.calibration = SpatialCalibration {
        pixel_size_x,
        pixel_size_y,
        pixel_size_z: 1.0,
        unit_name,
        origin_x: 0.0,
        origin_y: 0.0,
        is_calibrated,
    };

    Ok(asset.calibration.clone())
}

#[tauri::command]
pub fn sci_image_get_histogram(
    asset_id: String,
    bin_count: Option<usize>,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<HistogramResult, String> {
    let assets = state.assets.lock().map_err(|e| e.to_string())?;
    let asset = assets
        .get(&asset_id)
        .ok_or_else(|| format!("Asset with ID '{}' not found", asset_id))?;

    let buffer = asset
        .buffer
        .as_ref()
        .ok_or_else(|| "Pixel buffer not loaded".to_string())?;

    let bins_requested = bin_count.unwrap_or(256).clamp(2, 65536);
    let (bins, min_val, max_val) = buffer.compute_histogram(bins_requested);

    Ok(HistogramResult {
        bins,
        min_value: min_val,
        max_value: max_val,
        bin_count: bins_requested,
    })
}

#[tauri::command]
pub fn sci_image_close_asset(
    asset_id: String,
    state: State<'_, ScientificWorkspaceState>,
) -> Result<bool, String> {
    let mut assets = state.assets.lock().map_err(|e| e.to_string())?;
    let mut active = state.active_asset_id.lock().map_err(|e| e.to_string())?;

    let removed = assets.remove(&asset_id).is_some();
    if *active == Some(asset_id) {
        *active = assets.keys().next().cloned();
    }

    Ok(removed)
}

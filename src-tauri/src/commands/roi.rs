use crate::roi::{
    BooleanEngine, BooleanOp, RoiItem, RoiManager, RoiMeasurements,
};
use crate::scientific_models::scientific_image::SpatialCalibration;
use std::path::Path;
use std::sync::Arc;
use tauri::State;

#[derive(Default)]
pub struct RoiState {
    pub manager: Arc<RoiManager>,
}

#[tauri::command]
pub fn roi_add(
    item: RoiItem,
    calibration: Option<SpatialCalibration>,
    state: State<'_, RoiState>,
) -> Result<RoiItem, String> {
    Ok(state.manager.add(item, calibration.as_ref()))
}

#[tauri::command]
pub fn roi_list(slide_id: Option<String>, state: State<'_, RoiState>) -> Result<Vec<RoiItem>, String> {
    Ok(state.manager.list(slide_id.as_deref()))
}

#[tauri::command]
pub fn roi_update(
    item: RoiItem,
    calibration: Option<SpatialCalibration>,
    state: State<'_, RoiState>,
) -> Result<RoiItem, String> {
    state
        .manager
        .update(item, calibration.as_ref())
        .ok_or_else(|| "Failed to update ROI item: not found".to_string())
}

#[tauri::command]
pub fn roi_delete(roi_id: String, state: State<'_, RoiState>) -> Result<bool, String> {
    Ok(state.manager.delete(&roi_id))
}

#[tauri::command]
pub fn roi_clear(slide_id: Option<String>, state: State<'_, RoiState>) -> Result<bool, String> {
    state.manager.clear(slide_id.as_deref());
    Ok(true)
}

#[tauri::command]
pub fn roi_measure(roi_id: String, state: State<'_, RoiState>) -> Result<RoiMeasurements, String> {
    let item = state
        .manager
        .get(&roi_id)
        .ok_or_else(|| format!("ROI with ID '{}' not found", roi_id))?;

    item.measurements
        .ok_or_else(|| "Measurements not computed".to_string())
}

#[tauri::command]
pub fn roi_measure_with_image(
    roi_id: String,
    asset_id: String,
    roi_state: State<'_, RoiState>,
    sci_state: State<'_, crate::commands::scientific_image::ScientificWorkspaceState>,
) -> Result<RoiMeasurements, String> {
    let mut item = roi_state
        .manager
        .get(&roi_id)
        .ok_or_else(|| format!("ROI with ID '{}' not found", roi_id))?;

    let assets = sci_state.assets.lock().map_err(|e| e.to_string())?;
    let asset = assets.get(&asset_id).ok_or_else(|| format!("Asset '{}' not found", asset_id))?;
    let buffer = asset.buffer.as_ref().ok_or_else(|| "Asset buffer not loaded".to_string())?;

    let intensity_bytes: Vec<u8> = match buffer {
        crate::scientific_models::scientific_image::TypedPixelBuffer::U8(v) => v.clone(),
        crate::scientific_models::scientific_image::TypedPixelBuffer::Rgb24(v) => {
            v.chunks_exact(3).map(|c| ((c[0] as u16 + c[1] as u16 + c[2] as u16) / 3) as u8).collect()
        }
        crate::scientific_models::scientific_image::TypedPixelBuffer::Rgba32(v) => {
            v.chunks_exact(4).map(|c| ((c[0] as u16 + c[1] as u16 + c[2] as u16) / 3) as u8).collect()
        }
        _ => return Err("Only U8/RGB/RGBA supported for intensity measurements".to_string()),
    };

    let measurements = crate::roi::measurement::MeasurementEngine::measure_with_intensity(
        &item.shape,
        &asset.calibration,
        Some(&intensity_bytes),
        asset.dimensions.width as usize,
        asset.dimensions.height as usize,
    );

    item.measurements = Some(measurements.clone());
    roi_state.manager.update(item, Some(&asset.calibration));

    Ok(measurements)
}

#[tauri::command]
pub fn roi_undo(state: State<'_, RoiState>) -> Result<bool, String> {
    Ok(state.manager.undo())
}

#[tauri::command]
pub fn roi_redo(state: State<'_, RoiState>) -> Result<bool, String> {
    Ok(state.manager.redo())
}

#[tauri::command]
pub fn roi_save_to_file(path: String, state: State<'_, RoiState>) -> Result<bool, String> {
    state
        .manager
        .save_to_path(Path::new(&path))
        .map(|_| true)
}

#[tauri::command]
pub fn roi_load_from_file(path: String, state: State<'_, RoiState>) -> Result<usize, String> {
    state.manager.load_from_path(Path::new(&path))
}

#[tauri::command]
pub fn roi_boolean_operation(
    roi_id_a: String,
    roi_id_b: String,
    operation: String,
    state: State<'_, RoiState>,
) -> Result<RoiItem, String> {
    let item_a = state
        .manager
        .get(&roi_id_a)
        .ok_or_else(|| format!("ROI A '{}' not found", roi_id_a))?;
    let item_b = state
        .manager
        .get(&roi_id_b)
        .ok_or_else(|| format!("ROI B '{}' not found", roi_id_b))?;

    let op = match operation.to_lowercase().as_str() {
        "union" | "or" => BooleanOp::Union,
        "intersection" | "and" => BooleanOp::Intersection,
        "difference" | "xor" | "subtract" => BooleanOp::Difference,
        _ => return Err(format!("Unsupported boolean operation: {}", operation)),
    };

    let result_shape = BooleanEngine::apply(&item_a.shape, &item_b.shape, op)?;
    let result_item = RoiItem {
        id: uuid::Uuid::new_v4().to_string(),
        name: format!("{}_{}_{}", item_a.name, operation, item_b.name),
        shape: result_shape,
        color: "#00E5FF".to_string(),
        group_name: "Boolean Operations".to_string(),
        slide_id: item_a.slide_id.clone(),
        parent_id: None,
        class_id: item_a.class_id.clone(),
        class_name: item_a.class_name.clone(),
        is_visible: true,
        is_locked: false,
        tags: vec!["boolean_operation".to_string()],
        notes: None,
        measurements: None,
    };

    Ok(state.manager.add(result_item, None))
}

#[tauri::command]
pub fn roi_export_geojson(
    slide_id: Option<String>,
    state: State<'_, RoiState>,
) -> Result<String, String> {
    state.manager.export_geojson(slide_id.as_deref())
}

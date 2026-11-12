use crate::roi::{
    BooleanEngine, BooleanOp, RoiItem, RoiManager, RoiMeasurements,
};
use std::sync::Arc;
use tauri::State;

#[derive(Default)]
pub struct RoiState {
    pub manager: Arc<RoiManager>,
}

#[tauri::command]
pub fn roi_add(item: RoiItem, state: State<'_, RoiState>) -> Result<RoiItem, String> {
    Ok(state.manager.add(item, None))
}

#[tauri::command]
pub fn roi_list(slide_id: Option<String>, state: State<'_, RoiState>) -> Result<Vec<RoiItem>, String> {
    Ok(state.manager.list(slide_id.as_deref()))
}

#[tauri::command]
pub fn roi_update(item: RoiItem, state: State<'_, RoiState>) -> Result<RoiItem, String> {
    state
        .manager
        .update(item, None)
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
        is_visible: true,
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


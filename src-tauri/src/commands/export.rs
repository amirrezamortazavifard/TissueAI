use std::path::PathBuf;
use tauri::State;
use crate::commands::roi::RoiState;
use crate::export::Exporter;

#[tauri::command]
pub async fn export_rois_ome_xml(
    slide_id: Option<String>,
    file_path: String,
    state: State<'_, RoiState>,
) -> Result<String, String> {
    let rois = state.manager.list(slide_id.as_deref());
    let xml = Exporter::export_ome_xml(&rois);
    Exporter::save_atomic(&PathBuf::from(&file_path), &xml)?;
    Ok(xml)
}

#[tauri::command]
pub async fn export_rois_csv(
    slide_id: Option<String>,
    file_path: String,
    state: State<'_, RoiState>,
) -> Result<String, String> {
    let rois = state.manager.list(slide_id.as_deref());
    let csv = Exporter::export_measurements_csv(&rois);
    Exporter::save_atomic(&PathBuf::from(&file_path), &csv)?;
    Ok(csv)
}


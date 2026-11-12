mod tools;
mod commands;
pub mod crypto;
pub mod hardware_id;
pub mod llm;
pub mod scientific_models;
pub mod wsi;
pub mod roi;
pub mod project;
pub mod histology;
pub mod jobs;
pub mod export;
pub mod image_processing;
pub mod ai_segmentation;
pub mod registration;
pub mod spatial_analysis;
pub mod skeleton;
pub mod workflow;
pub use llm::open_webui;

use commands::detection::{
    DetectionState, load_detection_model, run_detection, draw_bounding_boxes,
    get_detection_results, export_detection_csv, list_models_in_directory,
    get_models_directory, read_file_bytes,
};
use commands::color_analysis::{
    ColorAnalysisState, load_color_image, analyze_dominant_colors, analyze_region,
    analyze_with_seed_color, replace_color, remove_color, apply_isolation,
    undo_action, get_color_at_pixel, find_cluster_for_pixel,
    deconvolve_stains, find_objects_for_color, generate_heatmap,
    inpaint_artifact, inpaint_single_contour, get_image_as_base64,
    get_quantitative_results, export_color_csv,
};
use commands::editor::{
    EditorState, load_editor_image, get_editor_image_base64, get_pixel_color,
    flood_fill, crop_image, rotate_image, apply_scale_bar,
    undo_editor, redo_editor, save_editor_image, update_image_from_canvas,
    get_image_dimensions, flip_image, rotate_90, resize_image, resize_canvas,
    create_new_canvas, get_system_fonts,
};
use commands::three_d::{save_scene, load_scene};
use commands::multi_slide::{
    MultiSlideState, run_batch_detection, export_batch_csv, get_batch_image_preview,
};
use commands::trainable::{
    get_feature_count, extract_features_from_image, train_segmentation_model,
    save_trained_model, load_trained_model, predict_with_model,
    export_yolo, export_pytorch, train_yolox_model, load_trainable_image,
    save_labelme_json, load_labelme_json, open_directory, get_label_file_path, check_label_exists,
    train_ssd_model, predict_ssd,
};
use commands::segmentation::{
    SegmentationState,
    calculate_scale_calibration, get_calibration_grid_data, update_grid_settings,
    apply_threshold, apply_auto_threshold, apply_morphology, re_analyze_mask,
    create_threshold_overlay,
    generate_contour, smooth_smart_mask, calculate_smart_area, colorize_smart_mask,
    calculate_polygon_area, calculate_measurement_distance, compute_sobel, find_edge_near,
    init_segmentation_projects, create_segmentation_project, save_segmentation_project,
    load_segmentation_project, list_segmentation_projects, export_threshold_csv,
    get_segmentation_data_path, get_current_calibration,
};

use commands::workspace::{list_directory, read_image_base64};
use commands::scientific_image::{
    ScientificWorkspaceState, sci_image_open, sci_image_get_asset, sci_image_list_assets,
    sci_image_get_pixel, sci_image_set_calibration, sci_image_get_histogram, sci_image_close_asset,
};
use commands::wsi::{
    WsiState, wsi_open_slide, wsi_get_slide_info, wsi_get_tile,
    wsi_get_thumbnail, wsi_compute_visible_tiles, wsi_read_region, wsi_close_slide,
    wsi_get_cache_stats,
};
use commands::roi::{
    RoiState, roi_add, roi_list, roi_update, roi_delete, roi_clear,
    roi_measure, roi_boolean_operation, roi_export_geojson,
    roi_undo, roi_redo, roi_save_to_file, roi_load_from_file,
};
use commands::project::{
    ProjectState, project_create, project_open, project_save,
    project_get_current, project_add_image,
};
use commands::histology::{
    histo_detect_tissue, histo_deconvolve, histo_extract_morphometry,
};
use commands::jobs::{
    JobManagerState, job_list, job_get, job_cancel,
};
use commands::export::{
    export_rois_ome_xml, export_rois_csv,
};
use commands::image_processing::{
    proc_apply_filter, proc_apply_adjustments, proc_distance_transform,
    proc_watershed_segmentation, proc_apply_threshold,
};
use commands::ai_segmentation::{
    ai_stardist_decode, ai_wsi_plan_tiles, ai_stardist_to_rois,
};
use commands::registration::{
    reg_estimate_affine, reg_apply_transform, reg_evaluate_metrics, reg_compute_difference,
};
use commands::spatial_analysis::{
    spatial_colocalization_analyze, spatial_colocalization_pdm, spatial_directionality_analyze,
};
use commands::skeleton::{
    skel_thin_mask, skel_analyze_graph,
};
use commands::workflow::{
    WorkflowState, workflow_record_step, workflow_get_pipeline, workflow_clear_pipeline,
    workflow_generate_report,
};

use llm::config::AppConfig as LlmAppConfig;
use llm::hardware;
use llm::runtime;
use llm::server;
use llm::models;
use llm::huggingface;
use llm::web_server;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri::Manager;

// ── LLM App State ─────────────────────────────────────────────────────────────

pub struct LlmWebServerHandle {
    pub handle: Option<tokio::task::JoinHandle<()>>,
    pub port: u16,
    pub state: Option<Arc<web_server::WebServerState>>,
}

pub struct LlmAppState {
    pub config: Mutex<LlmAppConfig>,
    pub server: server::SharedServerState,
    pub http_client: reqwest::Client,
    pub downloads: Mutex<HashMap<String, bool>>,
    pub web_server: Mutex<Option<LlmWebServerHandle>>,
}

pub struct OpenWebUIState {
    pub manager: tokio::sync::Mutex<open_webui::OpenWebUIManager>,
}

// ── LLM Tauri Commands ──────────────────────────────────────────────────────

#[tauri::command]
async fn llm_get_lan_ip() -> Result<String, String> {
    let output = tokio::process::Command::new("powershell")
        .args([
            "-NoProfile", "-Command",
            "Get-NetIPAddress -AddressFamily IPv4 | \
             Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } | \
             ForEach-Object { $adapter = Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue; \
               if ($adapter -and $adapter.Status -eq 'Up' -and $adapter.Virtual -eq $false) { \
                 $_.IPAddress \
               } \
             }"
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run PowerShell: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let ips: Vec<&str> = stdout.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();

    if let Some(ip) = ips.iter().find(|ip| ip.starts_with("192.168.")) {
        return Ok(ip.to_string());
    }
    if let Some(ip) = ips.iter().find(|ip| ip.starts_with("10.")) {
        return Ok(ip.to_string());
    }
    if let Some(ip) = ips.first() {
        return Ok(ip.to_string());
    }
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| format!("Failed to detect LAN IP: {}", e))
}

#[tauri::command]
async fn llm_get_system_info(_state: tauri::State<'_, LlmAppState>) -> Result<hardware::SystemInfo, String> {
    hardware::get_system_info().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_suggest_model_config(model_size_mb: u64, _state: tauri::State<'_, LlmAppState>) -> Result<hardware::SuggestedConfig, String> {
    let system = hardware::get_system_info().map_err(|e| e.to_string())?;
    Ok(hardware::suggest_config(model_size_mb, &system))
}

#[tauri::command]
async fn llm_get_runtime_info(state: tauri::State<'_, LlmAppState>) -> Result<runtime::RuntimeInfo, String> {
    let config = state.config.lock().unwrap().clone();
    runtime::get_runtime_info(&config).map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_check_latest_release(state: tauri::State<'_, LlmAppState>) -> Result<runtime::ReleaseInfo, String> {
    let system = hardware::get_system_info().map_err(|e| e.to_string())?;
    let available_ids: Vec<String> = system.available_backends.iter().filter(|b| b.available).map(|b| b.id.clone()).collect();
    runtime::fetch_latest_release(&state.http_client, &available_ids).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_download_runtime(
    app: tauri::AppHandle,
    asset_name: String,
    state: tauri::State<'_, LlmAppState>,
) -> Result<(), String> {
    let system = hardware::get_system_info().map_err(|e| e.to_string())?;
    let available_ids: Vec<String> = system.available_backends.iter().filter(|b| b.available).map(|b| b.id.clone()).collect();
    let release = runtime::fetch_latest_release(&state.http_client, &available_ids).await.map_err(|e| e.to_string())?;
    let asset = release.available_assets.iter().find(|a| a.name == asset_name).cloned().ok_or_else(|| format!("Asset '{}' not found", asset_name))?;
    let tag_name = release.tag_name.clone();
    state.downloads.lock().unwrap().insert("runtime".to_string(), false);
    let result = runtime::download_runtime(&state.http_client, &asset, &tag_name, move |progress| { let _ = app.emit("download_progress", &progress); }).await;
    state.downloads.lock().unwrap().remove("runtime");
    match result {
        Ok(downloaded) => {
            let mut config = state.config.lock().unwrap();
            runtime::register_downloaded_runtime(&mut config, downloaded).map_err(|e| e.to_string())?;
            config.save().map_err(|e| e.to_string())
        }
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn llm_set_custom_runtime(path: String, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);
    let mut config = state.config.lock().unwrap();
    runtime::set_custom_runtime(&path, &mut config).map_err(|e| e.to_string())?;
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_scan_custom_runtime(path: String) -> Result<runtime::ScanResult, String> {
    let path = std::path::PathBuf::from(path);
    runtime::scan_for_builds(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_add_all_custom_runtime_binaries(builds: Vec<runtime::CustomBuild>, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    let mut first_new_index = None;
    for build in builds {
        let binary_path = build.binary_path;
        if config.custom_runtimes.iter().any(|c| c.binary_path == binary_path) { continue; }
        let index = config.custom_runtimes.len();
        if first_new_index.is_none() { first_new_index = Some(index); }
        config.custom_runtimes.push(llm::config::CustomRuntime { label: build.label, binary_path });
    }
    if let Some(idx) = first_new_index {
        config.active_runtime = llm::config::ActiveRuntime::Custom { index: idx };
    }
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_set_custom_runtime_binary(binary_path: String, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let binary_path = std::path::PathBuf::from(binary_path);
    let mut config = state.config.lock().unwrap();
    let label = binary_path.parent().and_then(|p| p.file_name()).map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "Custom".to_string());
    let index = config.custom_runtimes.len();
    if let Some(existing) = config.custom_runtimes.iter().position(|c| c.binary_path == binary_path) {
        config.active_runtime = llm::config::ActiveRuntime::Custom { index: existing };
    } else {
        config.custom_runtimes.push(llm::config::CustomRuntime { label, binary_path });
        config.active_runtime = llm::config::ActiveRuntime::Custom { index };
    }
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_set_active_runtime(runtime_type: String, id: usize, backend_id: Option<String>, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.active_runtime = match runtime_type.as_str() {
        "managed" => {
            let build = id as u32;
            let bid = backend_id.unwrap_or_default();
            llm::config::ActiveRuntime::Managed { build, backend_id: bid }
        }
        "custom" => {
            if id >= config.custom_runtimes.len() { return Err("Invalid index".to_string()); }
            llm::config::ActiveRuntime::Custom { index: id }
        }
        _ => return Err("Invalid runtime type".to_string()),
    };
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_delete_managed_runtime(build: u32, backend_id: Option<String>, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    runtime::delete_managed_runtime(build, &backend_id.unwrap_or_default(), &mut config).map_err(|e| e.to_string())?;
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_remove_custom_runtime(index: usize, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    if index >= config.custom_runtimes.len() { return Err("Invalid index".to_string()); }
    config.custom_runtimes.remove(index);
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_set_auto_delete_runtimes(enabled: bool, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.auto_delete_old_runtimes = enabled;
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_get_available_backends(_state: tauri::State<'_, LlmAppState>) -> Result<Vec<hardware::BackendInfo>, String> {
    let system = hardware::get_system_info().map_err(|e| e.to_string())?;
    Ok(system.available_backends)
}

#[tauri::command]
async fn llm_list_installed_models(state: tauri::State<'_, LlmAppState>) -> Result<Vec<models::ModelInfo>, String> {
    let config = state.config.lock().unwrap().clone();
    models::list_installed_models(&config).map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_get_recommended_models(state: tauri::State<'_, LlmAppState>) -> Result<Vec<models::RecommendedModel>, String> {
    let config = state.config.lock().unwrap().clone();
    models::get_recommended_models(&config).map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_get_known_owners(state: tauri::State<'_, LlmAppState>) -> Result<Vec<serde_json::Value>, String> {
    let config = state.config.lock().unwrap().clone();
    let effective = config.effective_owners();
    Ok(effective.iter().map(|id| {
        let desc = huggingface::KNOWN_GGUF_OWNERS.iter().find(|(k, _)| *k == id.as_str()).map(|(_, d)| *d).unwrap_or("User-added source");
        serde_json::json!({ "id": id, "description": desc })
    }).collect())
}

#[tauri::command]
async fn llm_get_preferred_owners(state: tauri::State<'_, LlmAppState>) -> Result<Vec<String>, String> {
    Ok(state.config.lock().unwrap().effective_owners())
}

#[tauri::command]
async fn llm_set_preferred_owners(owners: Vec<String>, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.preferred_owners = owners;
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_validate_hf_owner(owner: String, state: tauri::State<'_, LlmAppState>) -> Result<bool, String> {
    huggingface::validate_hf_gguf_author(&state.http_client, &owner).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_search_hf_models(query: String, owner: Option<String>, state: tauri::State<'_, LlmAppState>) -> Result<Vec<huggingface::HfModel>, String> {
    huggingface::search_models(&state.http_client, &query, owner.as_deref()).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_get_hf_repo_files(repo_id: String, state: tauri::State<'_, LlmAppState>) -> Result<Vec<huggingface::HfFile>, String> {
    huggingface::get_repo_files(&state.http_client, &repo_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_download_model(
    app: tauri::AppHandle,
    repo_id: String,
    filename: String,
    download_url: String,
    size_bytes: u64,
    split_parts: Option<Vec<huggingface::HfFilePart>>,
    companion_model: Option<String>,
    state: tauri::State<'_, LlmAppState>,
) -> Result<String, String> {
    let config = state.config.lock().unwrap().clone();
    let (is_split, parts) = match split_parts { Some(parts) if !parts.is_empty() => (true, parts), _ => (false, vec![]) };
    let is_mmproj = huggingface::is_mmproj_file(&filename);
    let save_filename = if is_mmproj { if let Some(ref model_name) = companion_model { models::prefixed_mmproj_filename(model_name, &filename) } else { filename.clone() } } else { filename.clone() };
    let file = huggingface::HfFile { filename: save_filename.clone(), size_bytes, quant: huggingface::extract_quant(&filename), download_url, is_split, split_parts: parts, is_mmproj };
    state.downloads.lock().unwrap().insert(filename.clone(), false);
    let result = models::download_model(&state.http_client, &repo_id, &file, &config, move |progress| { let _ = app.emit("download_progress", &progress); }).await;
    state.downloads.lock().unwrap().remove(&filename);
    result.map(|p| p.to_string_lossy().to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_delete_model(path: String, _state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    models::delete_model(&std::path::PathBuf::from(path)).map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_abort_download(filename: String, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let config = state.config.lock().unwrap().clone();
    models::abort_download(&filename, &config).map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_get_model_dirs(state: tauri::State<'_, LlmAppState>) -> Result<serde_json::Value, String> {
    let config = state.config.lock().unwrap().clone();
    let dirs: Vec<String> = config.all_model_dirs().iter().map(|p| p.to_string_lossy().to_string()).collect();
    let download_dir = config.models_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
    Ok(serde_json::json!({ "dirs": dirs, "download_dir": download_dir }))
}

#[tauri::command]
async fn llm_add_model_dir(path: String, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let path = std::path::PathBuf::from(&path);
    if !path.exists() { return Err(format!("Directory does not exist: {}", path.display())); }
    let mut config = state.config.lock().unwrap();
    if !config.model_dirs.contains(&path) { config.model_dirs.push(path); }
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_remove_model_dir(path: String, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let path = std::path::PathBuf::from(&path);
    let mut config = state.config.lock().unwrap();
    config.model_dirs.retain(|p| p != &path);
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_set_download_dir(path: String, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let path = std::path::PathBuf::from(&path);
    if !path.exists() { std::fs::create_dir_all(&path).map_err(|e| e.to_string())?; }
    let mut config = state.config.lock().unwrap();
    if !config.model_dirs.contains(&path) { config.model_dirs.push(path.clone()); }
    config.download_dir = Some(path);
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_start_server(
    app: tauri::AppHandle,
    mut config: server::ServerConfig,
    state: tauri::State<'_, LlmAppState>,
) -> Result<(), String> {
    let app_config = state.config.lock().unwrap().clone();
    let runtime_info = runtime::get_runtime_info(&app_config).map_err(|e| e.to_string())?;
    let server_binary = runtime_info.server_binary.ok_or_else(|| "Runtime not installed".to_string())?;
    let server_state = state.server.clone();
    server::migrate_extra_params(&mut config.extra_params);
    server::start_server(&server_binary, &config, server_state, move |line| { let _ = app.emit("server_log", &line); }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_stop_server(state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    server::stop_server(&state.server).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_get_server_status(state: tauri::State<'_, LlmAppState>) -> Result<server::ServerStatus, String> {
    Ok(state.server.lock().unwrap().status.clone())
}

#[tauri::command]
async fn llm_get_server_logs(state: tauri::State<'_, LlmAppState>) -> Result<Vec<String>, String> {
    Ok(state.server.lock().unwrap().log_lines.clone())
}

#[tauri::command]
async fn llm_suggest_server_config(model_path: String, model_size_mb: u64, _state: tauri::State<'_, LlmAppState>) -> Result<server::ServerConfig, String> {
    let system = hardware::get_system_info().map_err(|e| e.to_string())?;
    Ok(server::suggest_server_config(&model_path, model_size_mb, &system))
}

#[tauri::command]
async fn llm_open_chat_window(app: tauri::AppHandle, port: u16) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;
    let url = format!("http://127.0.0.1:{}", port);
    let webview_url = tauri::WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?);
    if let Some(win) = app.get_webview_window("chat") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, "chat", webview_url).title("Chat").inner_size(960.0, 760.0).min_inner_size(640.0, 480.0).resizable(true).build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn llm_get_config(state: tauri::State<'_, LlmAppState>) -> Result<LlmAppConfig, String> {
    Ok(state.config.lock().unwrap().clone())
}

#[tauri::command]
async fn llm_toggle_favorite_model(model_id: String, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    if let Some(pos) = config.favorite_models.iter().position(|id| id == &model_id) { config.favorite_models.remove(pos); } else { config.favorite_models.push(model_id); }
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_set_selected_model(model_path: Option<String>, state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.selected_model = model_path;
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_list_server_presets() -> Result<Vec<String>, String> {
    let dir = LlmAppConfig::presets_dir().map_err(|e| e.to_string())?;
    if !dir.exists() { return Ok(vec![]); }
    let mut names = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) { names.push(stem.to_string()); }
        }
    }
    names.sort();
    Ok(names)
}

#[tauri::command]
async fn llm_save_server_preset(name: String, config: server::ServerConfig) -> Result<(), String> {
    let dir = LlmAppConfig::presets_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.json", name));
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn llm_load_server_preset(name: String) -> Result<server::ServerConfig, String> {
    let dir = LlmAppConfig::presets_dir().map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.json", name));
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut config: server::ServerConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    server::migrate_extra_params(&mut config.extra_params);
    Ok(config)
}

#[tauri::command]
async fn llm_delete_server_preset(name: String) -> Result<(), String> {
    let dir = LlmAppConfig::presets_dir().map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.json", name));
    if path.exists() { std::fs::remove_file(&path).map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
async fn llm_start_web_server(port: u16, state: tauri::State<'_, LlmAppState>) -> Result<u16, String> {
    { let ws = state.web_server.lock().unwrap(); if ws.is_some() { return Err("Already running".to_string()); } }
    let data_dir = dirs::data_dir().ok_or("Cannot find data directory")?.join("tissueai").join("llm");
    let llama_port = { let ss = state.server.lock().unwrap(); match &ss.status { server::ServerStatus::Running { port, .. } => *port, _ => 8081 } };
    let config = web_server::WebServerConfig { port, llama_server_port: llama_port, data_dir };
    let (handle, actual_port, server_state) = web_server::start_web_server(config).await.map_err(|e| e.to_string())?;
    { let mut ws = state.web_server.lock().unwrap(); *ws = Some(LlmWebServerHandle { handle: Some(handle), port: actual_port, state: Some(server_state) }); }
    Ok(actual_port)
}

#[tauri::command]
async fn llm_stop_web_server(state: tauri::State<'_, LlmAppState>) -> Result<(), String> {
    let handle = { let mut ws = state.web_server.lock().unwrap(); ws.take() };
    if let Some(mut h) = handle { h.handle.take(); }
    Ok(())
}

#[tauri::command]
async fn llm_get_web_server_status(state: tauri::State<'_, LlmAppState>) -> Result<serde_json::Value, String> {
    let ws = state.web_server.lock().unwrap();
    match ws.as_ref() {
        Some(h) => Ok(serde_json::json!({ "running": true, "port": h.port })),
        None => Ok(serde_json::json!({ "running": false, "port": null })),
    }
}

#[tauri::command]
async fn llm_get_monitoring_stats(state: tauri::State<'_, LlmAppState>) -> Result<serde_json::Value, String> {
    let ws_state = {
        let ws = state.web_server.lock().unwrap();
        ws.as_ref().and_then(|h| h.state.clone()).ok_or("Web server not running")?
    };
    let sessions = ws_state.sessions.read().await;
    let activity = ws_state.user_activity.read().await;
    let active = ws_state.active_connections.read().await;
    let total_sessions = sessions.len();
    let total_messages: usize = sessions.values().map(|s| s.messages.len()).sum();
    let active_users: usize = activity.values().filter(|a| a.is_active).count();
    let total_tokens: u64 = activity.values().map(|a| a.total_tokens).sum();
    Ok(serde_json::json!({ "total_users": activity.len(), "active_users": active_users, "total_sessions": total_sessions, "total_messages": total_messages, "online_now": active.len(), "total_tokens": total_tokens }))
}

#[tauri::command]
async fn llm_get_all_users(state: tauri::State<'_, LlmAppState>) -> Result<serde_json::Value, String> {
    let ws_state = {
        let ws = state.web_server.lock().unwrap();
        ws.as_ref().and_then(|h| h.state.clone()).ok_or("Web server not running")?
    };
    let activity = ws_state.user_activity.read().await;
    let active = ws_state.active_connections.read().await;
    let users: Vec<serde_json::Value> = activity.values().map(|u| {
        serde_json::json!({ "user_id": u.user_id, "ip_address": u.ip_address, "total_messages": u.total_messages, "is_active": active.contains_key(&u.user_id), "total_tokens": u.total_tokens })
    }).collect();
    Ok(serde_json::json!(users))
}

#[tauri::command]
async fn llm_get_server_metrics(_state: tauri::State<'_, LlmAppState>) -> Result<serde_json::Value, String> {
    let mut sys = sysinfo::System::new_all();
    sys.refresh_memory();
    let total_memory = sys.total_memory() / 1024 / 1024;
    let used_memory = sys.used_memory() / 1024 / 1024;
    let memory_usage = if total_memory > 0 { (used_memory as f64 / total_memory as f64) * 100.0 } else { 0.0 };
    sys.refresh_cpu_all();
    tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    sys.refresh_cpu_all();
    let cpu_usage = sys.global_cpu_usage() as f64;
    Ok(serde_json::json!({ "cpu_usage": cpu_usage, "memory_usage": memory_usage, "total_memory_mb": total_memory, "used_memory_mb": used_memory }))
}

// ── API Provider Commands ─────────────────────────────────────────────────────

#[tauri::command]
async fn llm_get_provider_presets() -> Result<Vec<llm::api_providers::ApiProviderPreset>, String> {
    Ok(llm::api_providers::get_provider_presets())
}

/// List stored providers. Real API keys live in the OS keyring (see
/// `provider_secrets`) and are never sent back to the webview: providers with
/// a stored key are returned with the [`llm::api_providers::KEY_MASK`]
/// sentinel so the UI can show "key set" without ever seeing the secret.
#[tauri::command]
async fn llm_get_api_providers() -> Result<llm::api_providers::ApiProvidersConfig, String> {
    let mut config = llm::api_providers::ApiProvidersConfig::load();
    for provider in config.providers.iter_mut() {
        let id = provider.id.clone();
        let keys = tauri::async_runtime::spawn_blocking(move || {
            llm::provider_secrets::load_provider_keys(&id)
        })
        .await
        .unwrap_or_default();
        provider.api_key = if keys.is_empty() {
            String::new()
        } else {
            llm::api_providers::KEY_MASK.to_string()
        };
        provider.api_keys.clear();
    }
    Ok(config)
}

/// Save a provider. The real key (when supplied) is moved into the OS keyring
/// first; only the non-secret config is persisted to `api_providers.json`. A
/// masked/empty key means "keep the stored key" and leaves the keyring entry
/// untouched.
#[tauri::command]
async fn llm_save_api_provider(
    provider: llm::api_providers::ApiProviderConfig,
) -> Result<(), String> {
    let mut provider = provider;
    let id = provider.id.clone();

    let mut chain: Vec<String> = Vec::new();
    if !llm::api_providers::is_masked_or_empty(&provider.api_key) {
        chain.push(provider.api_key.clone());
    }
    for key in &provider.api_keys {
        if !llm::api_providers::is_masked_or_empty(key) && !chain.contains(key) {
            chain.push(key.clone());
        }
    }

    if !chain.is_empty() {
        tauri::async_runtime::spawn_blocking(move || {
            llm::provider_secrets::store_provider_keys(&id, &chain)
        })
        .await
        .map_err(|e| e.to_string())??;
    }

    // Never persist secrets to the settings file.
    provider.api_key.clear();
    provider.api_keys.clear();

    let mut config = llm::api_providers::ApiProvidersConfig::load();
    if let Some(existing) = config.providers.iter_mut().find(|p| p.id == provider.id) {
        *existing = provider;
    } else {
        config.providers.push(provider);
    }
    config.save()
}

/// Delete a provider config and its stored keyring secret. This is the
/// explicit user-facing removal path (unlike `unregister_provider_config`,
/// which is pure in-memory reconciliation and must not touch the keyring).
#[tauri::command]
async fn llm_delete_api_provider(provider_id: String) -> Result<(), String> {
    let mut config = llm::api_providers::ApiProvidersConfig::load();
    config.providers.retain(|p| p.id != provider_id);
    config.save()?;

    tauri::async_runtime::spawn_blocking(move || {
        llm::provider_secrets::delete_provider_keys(&provider_id)
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(())
}

/// Resolve the real API key for a provider from the OS keyring. Returns `None`
/// when no key is stored. The frontend calls this to get the actual secret for
/// AI SDK model construction (the in-memory provider only carries KEY_MASK).
#[tauri::command]
async fn llm_resolve_api_key(provider_id: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let keys = llm::provider_secrets::load_provider_keys(&provider_id);
        Ok(keys.into_iter().next())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn llm_test_api_provider(
    state: tauri::State<'_, LlmAppState>,
    provider: llm::api_providers::ApiProviderConfig,
) -> Result<llm::api_providers::ApiTestResult, String> {
    Ok(llm::api_providers::test_api_provider(&provider, &state.http_client).await)
}

#[tauri::command]
async fn llm_send_api_chat(
    state: tauri::State<'_, LlmAppState>,
    req: llm::api_providers::ApiChatRequest,
) -> Result<llm::api_providers::ApiChatResponse, String> {
    let config = llm::api_providers::ApiProvidersConfig::load();
    llm::api_providers::send_api_chat(&req, &config, &state.http_client).await
}

/// Streaming chat: emits `llm-api-chat-stream` Tauri events with JSON payloads
/// `{ provider_id, model, type }` where `type` is `"delta"` (with `delta`),
/// `"done"` (with `finish_reason` + `usage`) or `"error"` (with `error`).
/// Keys come from the keyring chain and are retried on 401/403/429.
#[tauri::command]
async fn llm_send_api_chat_stream(
    app: tauri::AppHandle,
    state: tauri::State<'_, LlmAppState>,
    req: llm::api_providers::ApiChatRequest,
) -> Result<(), String> {
    use std::sync::{Arc, Mutex};

    let providers = llm::api_providers::ApiProvidersConfig::load();
    let provider = providers
        .providers
        .iter()
        .find(|p| p.id == req.provider_id || p.provider_id == req.provider_id)
        .ok_or_else(|| format!("Provider '{}' not found", req.provider_id))?
        .clone();

    let config = llm::api_providers::build_provider_config(&provider)?;

    let body = serde_json::json!({
        "model": req.model,
        "messages": req.messages,
        "temperature": req.temperature.unwrap_or(0.7),
        "max_tokens": req.max_tokens.unwrap_or(4096),
        "stream": true,
    });

    let provider_id = req.provider_id.clone();
    let model = Arc::new(Mutex::new(req.model.clone()));
    let usage = Arc::new(Mutex::new(serde_json::Value::Null));
    let finish_reason = Arc::new(Mutex::new(None::<String>));
    let mut pending = String::new();

    let emit_payload = |payload: serde_json::Value| {
        let _ = app.emit("llm-api-chat-stream", payload);
    };

    let result = llm::remote_chat::chat_completions_stream(
        &state.http_client,
        &config,
        &body,
        |chunk| {
            pending.push_str(&chunk);
            while let Some(idx) = pending.find("\n\n") {
                let frame = pending[..idx].to_string();
                pending.drain(..idx + 2);
                for line in frame.lines() {
                    let line = line.trim();
                    let Some(data) = line.strip_prefix("data: ") else { continue };
                    if data == "[DONE]" {
                        continue;
                    }
                    let Ok(event) = serde_json::from_str::<serde_json::Value>(data) else {
                        continue;
                    };
                    if let Some(delta) = event["choices"][0]["delta"]["content"].as_str() {
                        emit_payload(serde_json::json!({
                            "provider_id": provider_id,
                            "type": "delta",
                            "delta": delta,
                        }));
                    }
                    if let Some(m) = event["model"].as_str() {
                        *model.lock().unwrap() = m.to_string();
                    }
                    if let Some(reason) = event["choices"][0]["finish_reason"].as_str() {
                        *finish_reason.lock().unwrap() = Some(reason.to_string());
                    }
                    if event["usage"].is_object() {
                        *usage.lock().unwrap() = event["usage"].clone();
                    }
                }
            }
        },
    )
    .await;

    if let Err(error) = result {
        emit_payload(serde_json::json!({
            "provider_id": provider_id,
            "type": "error",
            "error": error,
        }));
        return Ok(());
    }

    emit_payload(serde_json::json!({
        "provider_id": provider_id,
        "model": model.lock().unwrap().clone(),
        "type": "done",
        "finish_reason": finish_reason.lock().unwrap().clone().unwrap_or_else(|| "stop".into()),
        "usage": usage.lock().unwrap().clone(),
    }));
    Ok(())
}

// ── Open WebUI Commands ───────────────────────────────────────────────────────

#[tauri::command]
async fn llm_check_python(state: tauri::State<'_, OpenWebUIState>) -> Result<Option<String>, String> {
    state.manager.lock().await.check_python().await
}

#[tauri::command]
async fn llm_check_open_webui(state: tauri::State<'_, OpenWebUIState>) -> Result<bool, String> {
    state.manager.lock().await.check_open_webui().await
}

#[tauri::command]
async fn llm_install_full(app: tauri::AppHandle, state: tauri::State<'_, OpenWebUIState>) -> Result<(), String> {
    state.manager.lock().await.install_full(app).await
}

#[tauri::command]
async fn llm_start_open_webui(app: tauri::AppHandle, state: tauri::State<'_, OpenWebUIState>) -> Result<String, String> {
    state.manager.lock().await.start(app).await
}

#[tauri::command]
async fn llm_stop_open_webui(state: tauri::State<'_, OpenWebUIState>) -> Result<(), String> {
    state.manager.lock().await.stop().await
}

#[tauri::command]
async fn llm_get_open_webui_status(state: tauri::State<'_, OpenWebUIState>) -> Result<open_webui::OpenWebUIStatus, String> {
    Ok(state.manager.lock().await.get_status())
}

#[tauri::command]
async fn llm_get_open_webui_logs(state: tauri::State<'_, OpenWebUIState>) -> Result<Vec<String>, String> {
    Ok(state.manager.lock().await.get_logs())
}

#[tauri::command]
async fn llm_get_open_webui_disk_usage(state: tauri::State<'_, OpenWebUIState>) -> Result<open_webui::OpenWebUIDiskInfo, String> {
    Ok(state.manager.lock().await.get_disk_usage())
}

#[tauri::command]
async fn llm_uninstall_open_webui(app: tauri::AppHandle, state: tauri::State<'_, OpenWebUIState>) -> Result<(), String> {
    state.manager.lock().await.uninstall(app).await
}

#[tauri::command]
async fn llm_check_python_status(state: tauri::State<'_, OpenWebUIState>) -> Result<open_webui::PythonStatusInfo, String> {
    Ok(state.manager.lock().await.check_python_status().await)
}

#[tauri::command]
async fn llm_discover_python_versions(app: tauri::AppHandle, state: tauri::State<'_, OpenWebUIState>) -> Result<Vec<open_webui::PythonVersion>, String> {
    state.manager.lock().await.discover_versions(Some(&app)).await
}

#[tauri::command]
async fn llm_detect_platform(app: tauri::AppHandle, state: tauri::State<'_, OpenWebUIState>) -> Result<open_webui::PlatformInfo, String> {
    state.manager.lock().await.detect_platform(&app).await
}

#[tauri::command]
async fn llm_validate_prereqs(app: tauri::AppHandle, state: tauri::State<'_, OpenWebUIState>) -> Result<Vec<open_webui::PrereqCheck>, String> {
    state.manager.lock().await.validate_prerequisites(&app).await
}

#[tauri::command]
async fn llm_pause_installation(state: tauri::State<'_, OpenWebUIState>) -> Result<(), String> {
    state.manager.lock().await.pause().await
}

#[tauri::command]
async fn llm_resume_installation(app: tauri::AppHandle, state: tauri::State<'_, OpenWebUIState>) -> Result<(), String> {
    state.manager.lock().await.resume(app).await
}

pub fn run() {
    let llm_config = match LlmAppConfig::load() {
        Ok(c) => c,
        Err(_) => LlmAppConfig::default(),
    };
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .expect("Failed to build HTTP client");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .manage(DetectionState::new())
        .manage(ColorAnalysisState::default())
        .manage(EditorState::default())
        .manage(MultiSlideState::new())
        .manage(SegmentationState::default())
        .manage(ScientificWorkspaceState::default())
        .manage(WsiState::default())
        .manage(RoiState::default())
        .manage(ProjectState::default())
        .manage(JobManagerState::default())
        .manage(LlmAppState {
            config: Mutex::new(llm_config),
            server: server::new_server_state(),
            http_client,
            downloads: Mutex::new(HashMap::new()),
            web_server: Mutex::new(None),
        })
        .manage(OpenWebUIState {
            manager: tokio::sync::Mutex::new(open_webui::OpenWebUIManager::new()),
        })
        .manage(llm::mcp::MCPState::new())
        .manage(llm::remote_providers::ProviderState::default())
        .manage(WorkflowState {
            manager: std::sync::Arc::new(workflow::WorkflowManager::new()),
        })
        .invoke_handler(tauri::generate_handler![
            // Scientific Image & Data Integrity (Phase 1)
            sci_image_open,
            sci_image_get_asset,
            sci_image_list_assets,
            sci_image_get_pixel,
            sci_image_set_calibration,
            sci_image_get_histogram,
            sci_image_close_asset,
            // WSI Engine & Pyramidal Tile Streaming (Phase 2)
            wsi_open_slide,
            wsi_get_slide_info,
            wsi_get_tile,
            wsi_get_thumbnail,
            wsi_compute_visible_tiles,
            wsi_read_region,
            wsi_close_slide,
            wsi_get_cache_stats,
            // ROI Manager & Quantitative Measurements (Phase 3)
            roi_add,
            roi_list,
            roi_update,
            roi_delete,
            roi_clear,
            roi_measure,
            roi_boolean_operation,
            roi_export_geojson,
            roi_undo,
            roi_redo,
            roi_save_to_file,
            roi_load_from_file,
            // Project & Persistence (Phase 4 M4)
            project_create,
            project_open,
            project_save,
            project_get_current,
            project_add_image,
            // Histology & Stain Deconvolution (Phase 6 M6)
            histo_detect_tissue,
            histo_deconvolve,
            histo_extract_morphometry,
            // Job Engine & Background Processing (Phase 8 M8)
            job_list,
            job_get,
            job_cancel,
            // Export & Scientific Interoperability (Phase 9 M9)
            export_rois_ome_xml,
            export_rois_csv,
            // Image Processing & Scientific Filters (Phase 4)
            proc_apply_filter,
            proc_apply_adjustments,
            proc_distance_transform,
            proc_watershed_segmentation,
            proc_apply_threshold,
            // AI Segmentation & StarDist Polygonal Inference (Phase 5)
            ai_stardist_decode,
            ai_wsi_plan_tiles,
            ai_stardist_to_rois,
            // Multi-Image Registration & Alignment (Phase 6)
            reg_estimate_affine,
            reg_apply_transform,
            reg_evaluate_metrics,
            reg_compute_difference,
            // Spatial Analysis & Colocalization & Directionality (Phase 7)
            spatial_colocalization_analyze,
            spatial_colocalization_pdm,
            spatial_directionality_analyze,
            // Skeletonization & Filament Branch Analysis (Phase 8)
            skel_thin_mask,
            skel_analyze_graph,
            // Workflow Automation & Research Audit Trail (Phase 9)
            workflow_record_step,
            workflow_get_pipeline,
            workflow_clear_pipeline,
            workflow_generate_report,
            // Detection
            get_models_directory,
            load_detection_model,
            run_detection,
            draw_bounding_boxes,
            get_detection_results,
            export_detection_csv,
            list_models_in_directory,
            read_file_bytes,
            // Color Analysis
            load_color_image,
            analyze_dominant_colors,
            analyze_region,
            analyze_with_seed_color,
            replace_color,
            remove_color,
            apply_isolation,
            undo_action,
            get_color_at_pixel,
            find_cluster_for_pixel,
            deconvolve_stains,
            find_objects_for_color,
            generate_heatmap,
            inpaint_artifact,
            inpaint_single_contour,
            get_image_as_base64,
            get_quantitative_results,
            export_color_csv,
            // Editor
            load_editor_image,
            get_editor_image_base64,
            get_pixel_color,
            flood_fill,
            crop_image,
            rotate_image,
            apply_scale_bar,
            undo_editor,
            redo_editor,
            save_editor_image,
            update_image_from_canvas,
            get_image_dimensions,
            flip_image,
            rotate_90,
            resize_image,
            resize_canvas,
            create_new_canvas,
            get_system_fonts,
            // Workspace (agent folder browsing + image reading)
            list_directory,
            read_image_base64,
            // 3D Viewer
            save_scene,
            load_scene,
            // MultiSlide
            run_batch_detection,
            export_batch_csv,
            get_batch_image_preview,
            // Trainable
            get_feature_count,
            extract_features_from_image,
            train_segmentation_model,
            save_trained_model,
            load_trained_model,
            predict_with_model,
            export_yolo,
            export_pytorch,
            train_yolox_model,
            load_trainable_image,
            save_labelme_json,
            load_labelme_json,
            open_directory,
            get_label_file_path,
            check_label_exists,
            train_ssd_model,
            predict_ssd,
            // Segmentation - Scale
            calculate_scale_calibration,
            get_calibration_grid_data,
            update_grid_settings,
            get_current_calibration,
            // Segmentation - Threshold
            apply_threshold,
            apply_auto_threshold,
            apply_morphology,
            re_analyze_mask,
            create_threshold_overlay,
            // Segmentation - Smart
            generate_contour,
            smooth_smart_mask,
            calculate_smart_area,
            colorize_smart_mask,
            // Segmentation - Manual
            calculate_polygon_area,
            calculate_measurement_distance,
            compute_sobel,
            find_edge_near,
            // Segmentation - Projects
            init_segmentation_projects,
            create_segmentation_project,
            save_segmentation_project,
            load_segmentation_project,
            list_segmentation_projects,
            export_threshold_csv,
            get_segmentation_data_path,
            // LLM - LAN
            llm_get_lan_ip,
            // LLM - Hardware
            llm_get_system_info,
            llm_suggest_model_config,
            // LLM - Runtime
            llm_get_runtime_info,
            llm_check_latest_release,
            llm_download_runtime,
            llm_set_custom_runtime,
            llm_scan_custom_runtime,
            llm_set_custom_runtime_binary,
            llm_add_all_custom_runtime_binaries,
            llm_set_active_runtime,
            llm_delete_managed_runtime,
            llm_remove_custom_runtime,
            llm_set_auto_delete_runtimes,
            llm_get_available_backends,
            // LLM - Models
            llm_list_installed_models,
            llm_get_recommended_models,
            llm_get_known_owners,
            llm_get_preferred_owners,
            llm_set_preferred_owners,
            llm_validate_hf_owner,
            llm_search_hf_models,
            llm_get_hf_repo_files,
            llm_download_model,
            llm_delete_model,
            llm_abort_download,
            llm_get_model_dirs,
            llm_add_model_dir,
            llm_remove_model_dir,
            llm_set_download_dir,
            // LLM - Server
            llm_start_server,
            llm_stop_server,
            llm_get_server_status,
            llm_get_server_logs,
            llm_suggest_server_config,
            llm_open_chat_window,
            // LLM - Config
            llm_get_config,
            llm_toggle_favorite_model,
            llm_set_selected_model,
            // LLM - Presets
            llm_list_server_presets,
            llm_save_server_preset,
            llm_load_server_preset,
            llm_delete_server_preset,
            // LLM - Web Server
            llm_start_web_server,
            llm_stop_web_server,
            llm_get_web_server_status,
            // LLM - Monitoring
            llm_get_monitoring_stats,
            llm_get_all_users,
            llm_get_server_metrics,
            // LLM - API Providers
            llm_get_provider_presets,
            llm_get_api_providers,
            llm_save_api_provider,
            llm_delete_api_provider,
            llm_resolve_api_key,
            llm_test_api_provider,
            llm_send_api_chat,
            llm_send_api_chat_stream,
            // LLM - Remote Providers (Jan backend)
            llm::remote_providers::register_provider_config,
            llm::remote_providers::unregister_provider_config,
            llm::remote_providers::delete_provider_keys,
            llm::remote_providers::get_provider_keys,
            llm::remote_providers::get_provider_config,
            llm::remote_providers::list_provider_configs,
            llm::provider_secrets::set_secret,
            llm::provider_secrets::get_secret,
            // LLM - Open WebUI
            llm_check_python,
            llm_check_open_webui,
            llm_install_full,
            llm_start_open_webui,
            llm_stop_open_webui,
            llm_get_open_webui_status,
            llm_get_open_webui_logs,
            llm_get_open_webui_disk_usage,
            llm_uninstall_open_webui,
            llm_check_python_status,
            llm_discover_python_versions,
            llm_detect_platform,
            llm_validate_prereqs,
            llm_pause_installation,
            llm_resume_installation,
            // MCP
            llm::mcp::mcp_update_config,
            llm::mcp::mcp_restart_servers,
            llm::mcp::mcp_get_server_summaries,
            llm::mcp::mcp_get_tools,
            llm::mcp::mcp_get_tools_for_servers,
            llm::mcp::mcp_call_tool,
            llm::mcp::mcp_activate_server,
            llm::mcp::mcp_deactivate_server,
            // Clipboard
            llm::clipboard::read_clipboard_image,
            llm::clipboard::read_clipboard_text,
            llm::clipboard::get_os_username,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

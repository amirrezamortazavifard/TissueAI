use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

use crate::tools::segmentation::data_models::*;
use crate::tools::segmentation::manual;
use crate::tools::segmentation::morphology;
use crate::tools::segmentation::project_service::SegmentationProjectService;
use crate::tools::segmentation::scale;
use crate::tools::segmentation::smart;
use crate::tools::segmentation::threshold;

pub struct SegmentationState {
    pub project_service: Mutex<Option<SegmentationProjectService>>,
    pub current_calibration: Mutex<ScaleCalibrationInfo>,
    pub current_grid_settings: Mutex<CalibrationGridSettings>,
    pub last_binary_mask: Mutex<Option<Vec<Vec<bool>>>>,
    pub last_labeled_mask: Mutex<Option<Vec<Vec<i32>>>>,
}

impl Default for SegmentationState {
    fn default() -> Self {
        Self {
            project_service: Mutex::new(None),
            current_calibration: Mutex::new(ScaleCalibrationInfo::default()),
            current_grid_settings: Mutex::new(CalibrationGridSettings::default()),
            last_binary_mask: Mutex::new(None),
            last_labeled_mask: Mutex::new(None),
        }
    }
}

// ===================== SCALE COMMANDS =====================

#[tauri::command]
pub fn calculate_scale_calibration(
    start_x: f64,
    start_y: f64,
    end_x: f64,
    end_y: f64,
    known_value: f64,
    unit: String,
    state: State<'_, SegmentationState>,
) -> Result<ScaleCalibrationInfo, String> {
    let p1 = Point { x: start_x, y: start_y };
    let p2 = Point { x: end_x, y: end_y };
    let cal = scale::calculate_calibration(&p1, &p2, known_value, &unit);
    *state.current_calibration.lock().map_err(|e| e.to_string())? = cal.clone();
    Ok(cal)
}

#[tauri::command]
pub fn get_calibration_grid_data(
    settings: CalibrationGridSettings,
    image_width: f64,
    image_height: f64,
) -> Result<GridData, String> {
    Ok(scale::generate_grid(&settings, image_width, image_height))
}

#[tauri::command]
pub fn update_grid_settings(
    settings: CalibrationGridSettings,
    state: State<'_, SegmentationState>,
) -> Result<(), String> {
    *state.current_grid_settings.lock().map_err(|e| e.to_string())? = settings;
    Ok(())
}

// ===================== THRESHOLD COMMANDS =====================

#[tauri::command]
pub fn apply_threshold(
    image_data: Vec<u8>,
    width: usize,
    height: usize,
    hsv_ranges: HsvRanges,
    is_grayscale_mode: bool,
    grayscale_min: Option<u8>,
    grayscale_max: Option<u8>,
    min_object_size: usize,
    state: State<'_, SegmentationState>,
) -> Result<ThresholdAnalysisResult, String> {
    let calibration = state.current_calibration.lock().map_err(|e| e.to_string())?.clone();

    let result = threshold::perform_threshold_analysis(
        &image_data,
        width,
        height,
        &hsv_ranges,
        is_grayscale_mode,
        grayscale_min.zip(grayscale_max),
        min_object_size,
        &calibration,
    );

    *state.last_binary_mask.lock().map_err(|e| e.to_string())? = Some(result.binary_mask.clone());
    *state.last_labeled_mask.lock().map_err(|e| e.to_string())? = Some(result.labeled_mask.clone());

    Ok(result)
}

#[tauri::command]
pub fn apply_auto_threshold(
    image_data: Vec<u8>,
    width: usize,
    height: usize,
    method: AutoThresholdMethod,
    min_object_size: usize,
    state: State<'_, SegmentationState>,
) -> Result<ThresholdAnalysisResult, String> {
    let calibration = state.current_calibration.lock().map_err(|e| e.to_string())?.clone();

    let result = threshold::apply_auto_threshold(
        &image_data,
        width,
        height,
        &method,
        min_object_size,
        &calibration,
    );

    *state.last_binary_mask.lock().map_err(|e| e.to_string())? = Some(result.binary_mask.clone());
    *state.last_labeled_mask.lock().map_err(|e| e.to_string())? = Some(result.labeled_mask.clone());

    Ok(result)
}

#[tauri::command]
pub fn apply_morphology(
    operation: MorphologyOperation,
    width: usize,
    height: usize,
    state: State<'_, SegmentationState>,
) -> Result<ThresholdAnalysisResult, String> {
    let mask_guard = state.last_binary_mask.lock().map_err(|e| e.to_string())?;
    let old_mask = mask_guard.as_ref().ok_or("No binary mask available. Apply threshold first.")?;
    let calibration = state.current_calibration.lock().map_err(|e| e.to_string())?.clone();

    let new_mask = match operation {
        MorphologyOperation::Erode => morphology::erode(old_mask, width, height),
        MorphologyOperation::Dilate => morphology::dilate(old_mask, width, height),
        MorphologyOperation::Open => morphology::open(old_mask, width, height),
        MorphologyOperation::Close => morphology::close(old_mask, width, height),
    };

    drop(mask_guard);

    let result = threshold::analyze_binary_mask(&new_mask, width, height, 1, &calibration);

    *state.last_binary_mask.lock().map_err(|e| e.to_string())? = Some(result.binary_mask.clone());
    *state.last_labeled_mask.lock().map_err(|e| e.to_string())? = Some(result.labeled_mask.clone());

    Ok(result)
}

#[tauri::command]
pub fn re_analyze_mask(
    width: usize,
    height: usize,
    min_object_size: usize,
    state: State<'_, SegmentationState>,
) -> Result<ThresholdAnalysisResult, String> {
    let mask_guard = state.last_binary_mask.lock().map_err(|e| e.to_string())?;
    let mask = mask_guard.as_ref().ok_or("No binary mask available.")?;
    let calibration = state.current_calibration.lock().map_err(|e| e.to_string())?.clone();
    let mask_clone = mask.clone();
    drop(mask_guard);

    let result = threshold::analyze_binary_mask(&mask_clone, width, height, min_object_size, &calibration);
    Ok(result)
}

#[tauri::command]
pub fn create_threshold_overlay(
    highlight_label: Option<i32>,
    width: usize,
    height: usize,
    state: State<'_, SegmentationState>,
) -> Result<Vec<u8>, String> {
    let labeled_guard = state.last_labeled_mask.lock().map_err(|e| e.to_string())?;
    let labeled = labeled_guard.as_ref().ok_or("No labeled mask available.")?;
    let overlay = threshold::create_colored_overlay(labeled, width, height, highlight_label);
    Ok(overlay)
}

// ===================== SMART SEGMENTATION COMMANDS =====================

#[tauri::command]
pub fn generate_contour(
    mask: Vec<f32>,
    width: usize,
    height: usize,
) -> Result<Vec<ContourSegment>, String> {
    Ok(smart::generate_contour_segments(&mask, width, height, 0.5))
}

#[tauri::command]
pub fn smooth_smart_mask(
    mask: Vec<f32>,
    width: usize,
    height: usize,
) -> Result<Vec<f32>, String> {
    Ok(smart::smooth_mask(&mask, width, height))
}

#[tauri::command]
pub fn calculate_smart_area(
    mask: Vec<f32>,
    width: usize,
    height: usize,
    pixels_per_unit: f64,
    unit: String,
) -> Result<String, String> {
    let area = smart::calculate_mask_area(&mask, width, height, 0.5);
    Ok(smart::mask_area_to_real(area, pixels_per_unit, &unit))
}

#[tauri::command]
pub fn colorize_smart_mask(
    mask: Vec<f32>,
    width: usize,
    height: usize,
) -> Result<Vec<u8>, String> {
    Ok(smart::colorize_mask(&mask, width, height, 0.5))
}

// ===================== MANUAL COMMANDS =====================

#[tauri::command]
pub fn calculate_polygon_area(
    points: Vec<Point>,
    state: State<'_, SegmentationState>,
) -> Result<String, String> {
    let calibration = state.current_calibration.lock().map_err(|e| e.to_string())?.clone();
    let area = manual::polygon_area_real(&points, &calibration);
    Ok(manual::format_area(area, &calibration.unit_name))
}

#[tauri::command]
pub fn calculate_measurement_distance(
    start_x: f64,
    start_y: f64,
    end_x: f64,
    end_y: f64,
    state: State<'_, SegmentationState>,
) -> Result<String, String> {
    let calibration = state.current_calibration.lock().map_err(|e| e.to_string())?.clone();
    let p1 = Point { x: start_x, y: start_y };
    let p2 = Point { x: end_x, y: end_y };
    let dist = manual::measurement_distance(&p1, &p2, &calibration);
    Ok(manual::format_area(dist, &calibration.unit_name))
}

#[tauri::command]
pub fn compute_sobel(
    image_data: Vec<u8>,
    width: usize,
    height: usize,
) -> Result<Vec<Vec<f64>>, String> {
    let gray = manual::rgba_to_grayscale(&image_data, width, height);
    Ok(manual::compute_sobel_gradient(&gray, width, height))
}

#[tauri::command]
pub fn find_edge_near(
    gradient: Vec<Vec<f64>>,
    center_x: f64,
    center_y: f64,
    radius: f64,
    width: usize,
    height: usize,
) -> Result<Point, String> {
    Ok(manual::find_strongest_edge(&gradient, center_x, center_y, radius, width, height))
}

// ===================== PROJECT COMMANDS =====================

#[tauri::command]
pub fn init_segmentation_projects(
    data_path: String,
    state: State<'_, SegmentationState>,
) -> Result<(), String> {
    let service = SegmentationProjectService::new(PathBuf::from(data_path));
    *state.project_service.lock().map_err(|e| e.to_string())? = Some(service);
    Ok(())
}

#[tauri::command]
pub fn create_segmentation_project(
    image_path: String,
    state: State<'_, SegmentationState>,
) -> Result<SegmentationProject, String> {
    let guard = state.project_service.lock().map_err(|e| e.to_string())?;
    let service = guard.as_ref().ok_or("Project service not initialized")?;
    service.create_new_project(&image_path)
}

#[tauri::command]
pub fn save_segmentation_project(
    project: SegmentationProject,
    state: State<'_, SegmentationState>,
) -> Result<(), String> {
    let guard = state.project_service.lock().map_err(|e| e.to_string())?;
    let service = guard.as_ref().ok_or("Project service not initialized")?;
    service.save_project(&project)
}

#[tauri::command]
pub fn load_segmentation_project(
    project_id: String,
    state: State<'_, SegmentationState>,
) -> Result<SegmentationProject, String> {
    let guard = state.project_service.lock().map_err(|e| e.to_string())?;
    let service = guard.as_ref().ok_or("Project service not initialized")?;
    service.load_project(&project_id)
}

#[tauri::command]
pub fn list_segmentation_projects(
    state: State<'_, SegmentationState>,
) -> Result<Vec<SegmentationProject>, String> {
    let guard = state.project_service.lock().map_err(|e| e.to_string())?;
    let service = guard.as_ref().ok_or("Project service not initialized")?;
    Ok(service.get_all_projects())
}

#[tauri::command]
pub fn export_threshold_csv(
    results: Vec<ThresholdResultItem>,
    path: String,
    image_name: String,
    unit: String,
) -> Result<(), String> {
    SegmentationProjectService::export_threshold_csv(&results, &path, &image_name, &unit)
}

#[tauri::command]
pub fn get_segmentation_data_path() -> Result<String, String> {
    let home = dirs_next::data_local_dir().ok_or("Cannot find local data directory")?;
    let path = home.join("TissueAI").join("segmentation");
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_current_calibration(
    state: State<'_, SegmentationState>,
) -> Result<ScaleCalibrationInfo, String> {
    Ok(state.current_calibration.lock().map_err(|e| e.to_string())?.clone())
}

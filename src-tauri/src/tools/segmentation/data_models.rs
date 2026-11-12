use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScaleCalibrationInfo {
    pub pixels_per_unit: f64,
    pub unit_name: String,
}

impl Default for ScaleCalibrationInfo {
    fn default() -> Self {
        Self {
            pixels_per_unit: 1.0,
            unit_name: "px".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThresholdResultItem {
    pub display_index: usize,
    pub label: usize,
    pub area: f64,
    pub perimeter: f64,
    pub circularity: f64,
    pub centroid_x: f64,
    pub centroid_y: f64,
    pub bounding_x: i32,
    pub bounding_y: i32,
    pub bounding_width: i32,
    pub bounding_height: i32,
    pub calculated_area_with_unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentationItemInfo {
    pub index: usize,
    pub label: String,
    pub area: f64,
    pub calculated_area_with_unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManualPolygonData {
    pub name: String,
    pub points: Vec<Point>,
    pub calculated_area_with_unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalibrationGridSettings {
    pub is_enabled: bool,
    pub rows: u32,
    pub columns: u32,
    pub marker_color: String,
    pub marker_type: String,
}

impl Default for CalibrationGridSettings {
    fn default() -> Self {
        Self {
            is_enabled: false,
            rows: 10,
            columns: 10,
            marker_color: "Yellow".to_string(),
            marker_type: "+".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Measurement {
    pub start_x: f64,
    pub start_y: f64,
    pub end_x: f64,
    pub end_y: f64,
    pub pixel_distance: f64,
    pub real_distance: f64,
    pub unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentationProject {
    pub id: String,
    pub name: String,
    pub source_image_path: String,
    pub smart_model_name: Option<String>,
    pub smart_segmentation_result: Option<SmartSegmentationResult>,
    pub threshold_results: Option<ThresholdAnalysisResult>,
    pub manual_polygons: Option<Vec<ManualPolygonData>>,
    pub display_data: ProjectDisplayData,
    pub created_at: String,
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDisplayData {
    pub mode: String,
    pub object_count: usize,
    pub summary: String,
    pub processing_duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartSegmentationResult {
    pub model_name: String,
    pub detections: Vec<SmartDetection>,
    pub mask_width: u32,
    pub mask_height: u32,
    pub mask_pixels: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartDetection {
    pub index: usize,
    pub label: String,
    pub confidence: f32,
    pub area: f64,
    pub calculated_area_with_unit: String,
    pub box_left: f32,
    pub box_top: f32,
    pub box_right: f32,
    pub box_bottom: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThresholdAnalysisResult {
    pub results: Vec<ThresholdResultItem>,
    pub binary_mask: Vec<Vec<bool>>,
    pub labeled_mask: Vec<Vec<i32>>,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HsvRanges {
    pub h_min: u8,
    pub h_max: u8,
    pub s_min: u8,
    pub s_max: u8,
    pub v_min: u8,
    pub v_max: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageSize {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridData {
    pub lines: Vec<GridLine>,
    pub markers: Vec<GridMarker>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridLine {
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridMarker {
    pub x: f64,
    pub y: f64,
    pub marker_type: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaskResult {
    pub mask: Vec<f32>,
    pub width: u32,
    pub height: u32,
    pub area: f64,
    pub calculated_area_with_unit: String,
    pub contour_segments: Vec<ContourSegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContourSegment {
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YoloSegResult {
    pub detections: Vec<SmartDetection>,
    pub mask_width: u32,
    pub mask_height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AutoThresholdMethod {
    Otsu,
    Mean,
    Li,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MorphologyOperation {
    Erode,
    Dilate,
    Open,
    Close,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SamModelType {
    Mobile,
    Base,
    Large,
}

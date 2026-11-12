use std::path::PathBuf;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

use crate::tools::detection::bounding_box::BoundingBox;
use crate::tools::detection::yolo_model::YoloModel;

pub struct MultiSlideState {
    #[allow(dead_code)]
    pub cached_model: Mutex<Option<YoloModel>>,
}

impl MultiSlideState {
    pub fn new() -> Self {
        MultiSlideState {
            cached_model: Mutex::new(None),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchImageResult {
    pub file_path: String,
    pub file_name: String,
    pub detections: Vec<BoundingBox>,
    pub detection_count: usize,
    pub processing_time_ms: f64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchDetectionResult {
    pub results: Vec<BatchImageResult>,
    pub total_images: usize,
    pub total_detections: usize,
    pub total_time_ms: f64,
}

#[tauri::command]
pub fn run_batch_detection(
    image_paths: Vec<String>,
    model_path: String,
    confidence_threshold: f32,
    nms_threshold: f32,
) -> Result<BatchDetectionResult, String> {
    if image_paths.is_empty() {
        return Err("No images provided".to_string());
    }

    let mut model = YoloModel::from_file(&model_path)
        .map_err(|e| format!("Failed to load model: {}", e))?;

    let mut results = Vec::new();
    let mut total_detections: usize = 0;
    let mut total_time_ms: f64 = 0.0;

    for path in &image_paths {
        let file_name = PathBuf::from(path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        match model.detect_objects(path, confidence_threshold, nms_threshold) {
            Ok(result) => {
                let count = result.detections.len();
                total_detections += count;
                total_time_ms += result.processing_time_ms;

                results.push(BatchImageResult {
                    file_path: result.file_path,
                    file_name,
                    detection_count: count,
                    processing_time_ms: result.processing_time_ms,
                    detections: result.detections,
                    status: "completed".to_string(),
                });
            }
            Err(e) => {
                results.push(BatchImageResult {
                    file_path: path.clone(),
                    file_name,
                    detection_count: 0,
                    processing_time_ms: 0.0,
                    detections: Vec::new(),
                    status: format!("error: {}", e),
                });
            }
        }
    }

    Ok(BatchDetectionResult {
        total_images: image_paths.len(),
        total_detections,
        total_time_ms,
        results,
    })
}

#[tauri::command]
pub fn export_batch_csv(results: Vec<BatchImageResult>) -> Result<String, String> {
    let mut csv = String::from("ImageName,TotalDetectionsInImage,DetectionTime(ms),DetectionID,ClassName,Confidence,Box_X,Box_Y,Box_Width,Box_Height\n");

    for result in &results {
        for (i, det) in result.detections.iter().enumerate() {
            csv.push_str(&format!(
                "{},{},{},{},{},{:.4},{:.2},{:.2},{:.2},{:.2}\n",
                result.file_name,
                result.detection_count,
                result.processing_time_ms,
                i + 1,
                det.class_name,
                det.confidence,
                det.x,
                det.y,
                det.width,
                det.height
            ));
        }
    }

    Ok(csv)
}

#[tauri::command]
pub fn get_batch_image_preview(image_path: String) -> Result<String, String> {
    let img = image::open(&image_path)
        .map_err(|e| format!("Failed to open image: {}", e))?;

    let max_size = 200u32;
    let resized = img.resize(max_size, max_size, image::imageops::FilterType::Triangle);

    let mut buffer: Vec<u8> = Vec::new();
    let encoder = image::codecs::jpeg::JpegEncoder::new(&mut buffer);
    image::ImageEncoder::write_image(
        encoder,
        resized.to_rgb8().as_raw(),
        resized.width(),
        resized.height(),
        image::ExtendedColorType::Rgb8,
    )
    .map_err(|e| format!("Failed to encode JPEG: {}", e))?;

    use base64::Engine;
    let base64_string = base64::engine::general_purpose::STANDARD.encode(&buffer);

    Ok(format!("data:image/jpeg;base64,{}", base64_string))
}

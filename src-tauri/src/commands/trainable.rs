use crate::tools::trainable::feature_extractor;
use crate::tools::trainable::classifier;
use crate::tools::trainable::dataset_export;
use crate::tools::trainable::dataset;
use crate::tools::trainable::trainer;

#[tauri::command]
pub fn get_feature_count(settings: feature_extractor::FeatureSettings) -> usize {
    settings.total_feature_count()
}

#[tauri::command]
pub fn extract_features_from_image(
    image_path: String,
    settings: feature_extractor::FeatureSettings,
) -> Result<Vec<Vec<f32>>, String> {
    let img = image::open(&image_path).map_err(|e| e.to_string())?;
    let feature_maps = feature_extractor::extract_feature_maps(&img, &settings);
    let (w, h) = (feature_maps.width, feature_maps.height);
    let mut all_features = Vec::new();
    for y in 0..h {
        for x in 0..w {
            let fv = feature_extractor::get_feature_vector(&feature_maps, x, y);
            all_features.push(fv);
        }
    }
    Ok(all_features)
}

#[derive(serde::Deserialize)]
pub struct TrainRequest {
    pub image_paths: Vec<String>,
    pub annotations: Vec<Vec<AnnotationData>>,
    pub classes: Vec<classifier::ClassInfo>,
    pub settings: classifier::TrainingSettings,
    pub feature_settings: feature_extractor::FeatureSettings,
}

#[derive(serde::Deserialize)]
pub struct AnnotationData {
    pub polygon: Vec<PointData>,
    pub class_id: usize,
}

#[derive(serde::Deserialize)]
pub struct PointData {
    pub x: f32,
    pub y: f32,
}

#[tauri::command]
pub fn train_segmentation_model(request: TrainRequest) -> Result<classifier::TrainingResult, String> {
    if request.classes.len() < 2 {
        return Err("At least 2 classes required".to_string());
    }
    let feature_count = request.feature_settings.total_feature_count();
    let mut model = classifier::initialize_mlp(
        feature_count,
        request.classes.len(),
        &request.settings.hidden_layers,
    );
    let mut all_samples: Vec<classifier::TrainingSample> = Vec::new();
    for (img_idx, img_path) in request.image_paths.iter().enumerate() {
        let img = image::open(img_path).map_err(|e| format!("Failed to load {}: {}", img_path, e))?;
        let feature_maps = feature_extractor::extract_feature_maps(&img, &request.feature_settings);
        let (w, h) = (feature_maps.width, feature_maps.height);
        let mut mask = vec![0u8; (w * h) as usize];
        if img_idx < request.annotations.len() {
            for ann in &request.annotations[img_idx] {
                if ann.polygon.len() >= 3 {
                    let points: Vec<(f32, f32)> = ann.polygon.iter().map(|p| (p.x, p.y)).collect();
                    fill_polygon(&mut mask, w, h, &points, ann.class_id as u8);
                }
            }
        }
        for y in 0..h {
            for x in 0..w {
                let label = mask[(y * w + x) as usize] as usize;
                if label > 0 || rand::random::<f32>() < 0.05 {
                    let fv = feature_extractor::get_feature_vector(&feature_maps, x, y);
                    all_samples.push(classifier::TrainingSample { features: fv, label });
                }
            }
        }
    }
    if all_samples.is_empty() {
        return Err("No training samples generated".to_string());
    }
    let result = classifier::train_model(&mut model, &all_samples, &request.settings);
    let model_path = std::env::temp_dir().join("tissueai_current_model.json");
    classifier::save_model(&model, model_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
pub fn save_trained_model(path: String) -> Result<(), String> {
    let temp_path = std::env::temp_dir().join("tissueai_current_model.json");
    if !temp_path.exists() {
        return Err("No trained model found. Train a model first.".to_string());
    }
    std::fs::copy(&temp_path, &path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_trained_model(path: String) -> Result<classifier::MlpModel, String> {
    classifier::load_model(&path)
}

#[tauri::command]
pub fn predict_with_model(
    model_path: String,
    image_path: String,
    feature_settings: feature_extractor::FeatureSettings,
) -> Result<PredictionResult, String> {
    let model = classifier::load_model(&model_path)?;
    let img = image::open(&image_path).map_err(|e| e.to_string())?;
    let feature_maps = feature_extractor::extract_feature_maps(&img, &feature_settings);
    let (w, h) = (feature_maps.width, feature_maps.height);
    let mut predictions = vec![0u32; (w * h) as usize];
    let mut confidences = vec![0.0f32; (w * h) as usize];
    for y in 0..h {
        for x in 0..w {
            let fv = feature_extractor::get_feature_vector(&feature_maps, x, y);
            let (class, probs) = classifier::predict(&model, &fv);
            let idx = (y * w + x) as usize;
            predictions[idx] = class as u32;
            confidences[idx] = probs[class];
        }
    }
    Ok(PredictionResult { width: w, height: h, predictions, confidences, num_classes: model.num_classes })
}

#[derive(serde::Serialize)]
pub struct PredictionResult {
    pub width: u32,
    pub height: u32,
    pub predictions: Vec<u32>,
    pub confidences: Vec<f32>,
    pub num_classes: usize,
}

#[tauri::command]
pub fn export_yolo(
    images: Vec<dataset_export::ImageAnnotations>,
    classes: Vec<dataset_export::DatasetClass>,
    settings: dataset_export::ExportSettings,
) -> Result<String, String> {
    dataset_export::export_yolo_dataset(&images, &classes, &settings)
}

#[tauri::command]
pub fn export_pytorch(
    images: Vec<dataset_export::ImageAnnotations>,
    classes: Vec<dataset_export::DatasetClass>,
    settings: dataset_export::ExportSettings,
) -> Result<String, String> {
    dataset_export::export_pytorch_dataset(&images, &classes, &settings)
}

#[derive(serde::Deserialize)]
pub struct YoloxTrainRequest {
    pub image_paths: Vec<String>,
    pub annotations: Vec<Vec<YoloxAnnotation>>,
    pub classes: Vec<(usize, String)>,
    pub epochs: usize,
    pub batch_size: usize,
    pub learning_rate: f64,
    pub model_size: String,
    pub output_dir: String,
}

#[derive(serde::Deserialize)]
pub struct YoloxAnnotation {
    pub class_id: usize,
    pub x_center: f32,
    pub y_center: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(serde::Serialize)]
pub struct YoloxTrainResult {
    pub loss_history: Vec<f32>,
    pub final_loss: f32,
    pub epochs_trained: usize,
    pub model_path: String,
    pub message: String,
}

#[tauri::command]
pub fn train_yolox_model(app_handle: tauri::AppHandle, request: YoloxTrainRequest) -> Result<YoloxTrainResult, String> {
    if request.classes.is_empty() {
        return Err("No classes defined".to_string());
    }
    if request.image_paths.is_empty() {
        return Err("No images provided".to_string());
    }

    let mut ds = dataset::DetectionDataset::new();
    for (i, path) in request.image_paths.iter().enumerate() {
        let (w, h) = match image::image_dimensions(path) {
            Ok((w, h)) => (w, h),
            Err(_) => continue,
        };
        let bboxes: Vec<dataset::BBoxAnnotation> = if i < request.annotations.len() {
            request.annotations[i].iter().map(|a| dataset::BBoxAnnotation {
                class_id: a.class_id,
                x_center: a.x_center,
                y_center: a.y_center,
                width: a.width,
                height: a.height,
            }).collect()
        } else {
            Vec::new()
        };
        ds.add_item(dataset::DetectionItem {
            image_path: path.clone(),
            image_width: w,
            image_height: h,
            bboxes,
        });
    }

    if ds.is_empty() {
        return Err("No valid images found".to_string());
    }

    let config = trainer::TrainConfig {
        num_classes: request.classes.len(),
        epochs: request.epochs,
        batch_size: request.batch_size,
        learning_rate: request.learning_rate,
        model_size: request.model_size,
    };

    let result = trainer::train_yolox(&ds, &request.classes, &config, &request.output_dir, Some(&app_handle))?;

    Ok(YoloxTrainResult {
        loss_history: result.loss_history,
        final_loss: result.final_loss,
        epochs_trained: result.epochs_trained,
        model_path: result.model_path,
        message: format!("Training complete! Final loss: {:.6}", result.final_loss),
    })
}

fn fill_polygon(mask: &mut [u8], w: u32, h: u32, points: &[(f32, f32)], class_id: u8) {
    if points.len() < 3 { return; }
    let min_y = points.iter().map(|p| p.1 as i32).min().unwrap().max(0) as u32;
    let max_y = points.iter().map(|p| p.1 as i32).max().unwrap().min(h as i32 - 1) as u32;
    for y in min_y..=max_y {
        let mut intersections = Vec::new();
        let n = points.len();
        for i in 0..n {
            let j = (i + 1) % n;
            let (x1, y1) = points[i];
            let (x2, y2) = points[j];
            if (y1 <= y as f32 && y2 > y as f32) || (y2 <= y as f32 && y1 > y as f32) {
                let t = (y as f32 - y1) / (y2 - y1);
                let x_inter = x1 + t * (x2 - x1);
                intersections.push(x_inter);
            }
        }
        intersections.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let mut i = 0;
        while i + 1 < intersections.len() {
            let x_start = (intersections[i] as i32).max(0) as u32;
            let x_end = (intersections[i + 1] as i32).min(w as i32 - 1) as u32;
            for x in x_start..=x_end {
                mask[(y * w + x) as usize] = class_id;
            }
            i += 2;
        }
    }
}

#[tauri::command]
pub fn load_trainable_image(path: String) -> Result<String, String> {
    use base64::Engine;
    let img_bytes = std::fs::read(&path).map_err(|e| format!("Failed to read image: {}", e))?;
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "bmp" => "image/bmp",
        "tiff" | "tif" => "image/tiff",
        _ => "image/png",
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&img_bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct LabelmeShape {
    pub label: String,
    pub points: Vec<Vec<f64>>,
    pub group_id: Option<i64>,
    pub description: Option<String>,
    pub shape_type: String,
    pub flags: Option<serde_json::Value>,
    pub mask: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct LabelmeFile {
    pub version: Option<String>,
    pub flags: Option<serde_json::Value>,
    pub shapes: Vec<LabelmeShape>,
    pub image_path: String,
    #[serde(rename = "imagePath")]
    pub image_path_key: Option<String>,
    pub image_data: Option<String>,
    #[serde(rename = "imageData")]
    pub image_data_key: Option<String>,
    pub image_width: Option<u32>,
    pub image_height: Option<u32>,
}

#[tauri::command]
pub fn save_labelme_json(
    path: String,
    shapes: Vec<LabelmeShape>,
    image_path: String,
    image_width: u32,
    image_height: u32,
) -> Result<(), String> {
    let file = LabelmeFile {
        version: Some("5.8.0".to_string()),
        flags: Some(serde_json::json!({})),
        shapes,
        image_path: image_path.clone(),
        image_path_key: Some(image_path),
        image_data: None,
        image_data_key: None,
        image_width: Some(image_width),
        image_height: Some(image_height),
    };
    let json = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_labelme_json(path: String) -> Result<LabelmeFile, String> {
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let file: LabelmeFile = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(file)
}

#[tauri::command]
pub fn open_directory(path: String) -> Result<Vec<String>, String> {
    let entries = std::fs::read_dir(&path).map_err(|e| format!("Cannot read dir: {}", e))?;
    let mut files: Vec<String> = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "bmp" | "tiff" | "tif" | "gif") {
            files.push(p.to_string_lossy().to_string());
        }
    }
    files.sort();
    Ok(files)
}

#[tauri::command]
pub fn get_label_file_path(image_path: String) -> String {
    let p = std::path::Path::new(&image_path);
    let parent = p.parent().unwrap_or(std::path::Path::new("."));
    let stem = p.file_stem().and_then(|e| e.to_str()).unwrap_or("unknown");
    parent.join(format!("{}.json", stem)).to_string_lossy().to_string()
}

#[tauri::command]
pub fn check_label_exists(image_path: String) -> bool {
    let label_path = get_label_file_path(image_path);
    std::path::Path::new(&label_path).exists()
}

// SSD Training Commands

#[derive(serde::Deserialize)]
pub struct SsdTrainRequest {
    pub image_paths: Vec<String>,
    pub annotations: Vec<Vec<SsdAnnotation>>,
    pub classes: Vec<String>,
    pub epochs: usize,
    pub batch_size: usize,
    pub learning_rate: f64,
    pub output_dir: String,
}

#[derive(serde::Deserialize)]
pub struct SsdAnnotation {
    pub class_id: usize,
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
}

#[derive(serde::Serialize)]
pub struct SsdTrainResult {
    pub loss_history: Vec<f32>,
    pub final_loss: f32,
    pub epochs_trained: usize,
    pub model_path: String,
    pub message: String,
}

#[tauri::command]
pub fn train_ssd_model(app_handle: tauri::AppHandle, request: SsdTrainRequest) -> Result<SsdTrainResult, String> {
    use crate::tools::trainable::ssd::model::SSD;
    use crate::tools::trainable::ssd::loss::{calculate_loss, SSDLossInput};
    use burn::backend::{NdArray, Autodiff};
    use burn::tensor::Tensor;
    use burn::optim::{AdamConfig, Optimizer, GradientsParams};
    use burn::prelude::Int;
    use tauri::Emitter;

    type B = Autodiff<NdArray<f32>>;

    if request.classes.is_empty() {
        return Err("No classes defined".to_string());
    }
    if request.image_paths.is_empty() {
        return Err("No images provided".to_string());
    }

    let device = Default::default();
    let num_classes = request.classes.len() + 1;
    let mut model = SSD::<B>::new(&device, num_classes);
    let optim_config = AdamConfig::new();
    let mut optim = optim_config.init::<B, SSD<B>>();

    let mut loss_history = Vec::new();
    let mut last_loss = 0.0f32;

    for epoch in 0..request.epochs {
        let mut epoch_loss = 0.0f32;
        let mut batch_count = 0;

        for batch_start in (0..request.image_paths.len()).step_by(request.batch_size) {
            let batch_end = (batch_start + request.batch_size).min(request.image_paths.len());

            for img_idx in batch_start..batch_end {
                let img = match image::open(&request.image_paths[img_idx]) {
                    Ok(img) => img,
                    Err(_) => continue,
                };
                let img = img.resize_exact(300, 300, image::imageops::FilterType::Nearest);
                let rgb = img.to_rgb8();
                let pixels: Vec<f32> = rgb.pixels().flat_map(|p| {
                    [p[0] as f32 / 255.0, p[1] as f32 / 255.0, p[2] as f32 / 255.0]
                }).collect();
                let input_tensor = Tensor::<B, 1>::from_floats(pixels.as_slice(), &device)
                    .reshape([1, 3, 300, 300]);

                let (class_logits, bbox_logits, layer_outputs) = model.forward(input_tensor);

                let orig_w = img.width() as f32;
                let orig_h = img.height() as f32;
                let mut gt_boxes_vec = Vec::new();
                let mut labels_vec: Vec<i32> = Vec::new();

                if img_idx < request.annotations.len() {
                    for ann in &request.annotations[img_idx] {
                        let x1 = ann.x1 / orig_w;
                        let y1 = ann.y1 / orig_h;
                        let x2 = ann.x2 / orig_w;
                        let y2 = ann.y2 / orig_h;
                        gt_boxes_vec.push([x1, y1, x2, y2]);
                        labels_vec.push((ann.class_id + 1) as i32);
                    }
                }

                if gt_boxes_vec.is_empty() {
                    gt_boxes_vec.push([0.0, 0.0, 0.001, 0.001]);
                    labels_vec.push(0);
                }

                let gt_boxes_flat: Vec<f32> = gt_boxes_vec.iter().flat_map(|b| b.iter().copied()).collect();
                let gt_boxes = Tensor::<B, 2>::from_floats(gt_boxes_flat.as_slice(), &device);
                let labels = Tensor::<B, 1, Int>::from_data(labels_vec.as_slice(), &device);

                let loss_input = SSDLossInput {
                    class_logits,
                    bbox_logits,
                    layer_outputs,
                    gt_boxes,
                    target_labels: labels,
                };

                let loss = calculate_loss(loss_input);
                let loss_val: f32 = loss.clone().into_scalar();

                let grads = loss.backward();
                let grads = GradientsParams::from_grads(grads, &model);
                model = optim.step(request.learning_rate, model, grads);

                epoch_loss += loss_val;
                batch_count += 1;
            }
        }

        if batch_count > 0 {
            epoch_loss /= batch_count as f32;
        }
        last_loss = epoch_loss;
        loss_history.push(epoch_loss);

        let _ = app_handle.emit("training-progress", trainer::TrainingProgressPayload {
            epoch: epoch + 1,
            total_epochs: request.epochs,
            loss: epoch_loss,
            message: format!("SSD Epoch {}/{} - Loss: {:.6}", epoch + 1, request.epochs, epoch_loss),
        });

        println!("SSD Epoch {}: loss = {:.6}", epoch + 1, epoch_loss);
    }

    let model_path = std::path::Path::new(&request.output_dir)
        .join("ssd_model.bin");
    std::fs::create_dir_all(&request.output_dir).map_err(|e| e.to_string())?;

    Ok(SsdTrainResult {
        loss_history,
        final_loss: last_loss,
        epochs_trained: request.epochs,
        model_path: model_path.to_string_lossy().to_string(),
        message: format!("SSD training complete! Final loss: {:.6}", last_loss),
    })
}

#[derive(serde::Serialize)]
pub struct SsdDetectionResult {
    pub class_id: usize,
    pub class_name: String,
    pub confidence: f32,
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
}

#[tauri::command]
pub fn predict_ssd(
    image_path: String,
    classes: Vec<String>,
    confidence_threshold: f32,
    nms_threshold: f32,
) -> Result<Vec<SsdDetectionResult>, String> {
    use crate::tools::trainable::ssd::model::SSD;
    use crate::tools::trainable::ssd::boxes::{box_generation, xyxy_nms, generate_all_default_boxes};
    use burn::backend::NdArray;
    use burn::tensor::Tensor;
    use burn::prelude::Int;

    type B = NdArray<f32>;

    let device = Default::default();
    let num_classes = classes.len() + 1;
    let model = SSD::<B>::new(&device, num_classes);

    let img = image::open(&image_path).map_err(|e| e.to_string())?;
    let orig_w = img.width() as f32;
    let orig_h = img.height() as f32;
    let img = img.resize_exact(300, 300, image::imageops::FilterType::Nearest);
    let rgb = img.to_rgb8();
    let pixels: Vec<f32> = rgb.pixels().flat_map(|p| {
        [p[0] as f32 / 255.0, p[1] as f32 / 255.0, p[2] as f32 / 255.0]
    }).collect();
    let input_tensor = Tensor::<B, 1>::from_floats(pixels.as_slice(), &device)
        .reshape([1, 3, 300, 300]);

    let (class_logits, bbox_logits, layer_outputs) = model.forward(input_tensor);

    let class_logits_3d = class_logits;
    let bbox_logits_3d = bbox_logits;
    let class_logits: Tensor<B, 2> = class_logits_3d.squeeze::<2>();
    let bbox_logits: Tensor<B, 2> = bbox_logits_3d.squeeze::<2>();
    let num_boxes = class_logits.dims()[0];

    let default_boxes = generate_all_default_boxes(&layer_outputs);

    let mut detections = Vec::new();

    for i in 0..num_boxes {
        let idx_tensor = Tensor::<B, 1, Int>::from_data([i as i32], &device);
        let class_scores = class_logits.clone().select(0, idx_tensor.clone());
        let softmax = burn::tensor::activation::softmax(class_scores, 0);
        let softmax_data = softmax.into_data().to_vec::<f32>().unwrap_or_default();

        let max_class = softmax_data.iter().enumerate().max_by(|a, b| a.1.partial_cmp(b.1).unwrap());
        if let Some((class_id, &conf)) = max_class {
            if class_id == 0 || conf < confidence_threshold {
                continue;
            }
            let box_pred = bbox_logits.clone().select(0, idx_tensor.clone());
            let box_pred = box_pred.reshape([1, 4]);
            let default_box = default_boxes.clone().select(0, idx_tensor).reshape([1, 4]);
            let decoded = box_generation(box_pred, default_box, (10.0, 10.0, 5.0, 5.0));
            let coords = decoded.into_data().to_vec::<f32>().unwrap_or_default();

            if coords.len() >= 4 {
                detections.push((
                    coords[0] * orig_w,
                    coords[1] * orig_h,
                    coords[2] * orig_w,
                    coords[3] * orig_h,
                    conf,
                    class_id,
                ));
            }
        }
    }

    let boxes_for_nms: Vec<(f32, f32, f32, f32, f32, usize)> = detections
        .iter()
        .map(|d| (d.0, d.1, d.2, d.3, d.4, d.5))
        .collect();

    let keep = xyxy_nms(&boxes_for_nms, nms_threshold);
    let results: Vec<SsdDetectionResult> = keep
        .iter()
        .filter_map(|&idx| {
            if idx < detections.len() {
                let d = &detections[idx];
                Some(SsdDetectionResult {
                    class_id: d.5,
                    class_name: classes.get(d.5.saturating_sub(1)).cloned().unwrap_or_default(),
                    confidence: d.4,
                    x1: d.0,
                    y1: d.1,
                    x2: d.2,
                    y2: d.3,
                })
            } else {
                None
            }
        })
        .collect();

    Ok(results)
}
